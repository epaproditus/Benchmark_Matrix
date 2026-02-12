import { NextResponse } from 'next/server';
import { connectToDatabase } from '../../../lib/db';
import fs from 'fs/promises';
import path from 'path';
import type mysql from 'mysql2/promise';

// Load config
async function getConfig() {
  const configPath = path.join(process.cwd(), 'src', 'data', 'thresholds.json');
  try {
    const data = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Failed to load thresholds config', error);
    return null;
  }
}

// Helper to get level SQL
function getLevelSql(column: string, thresholds: { label: string, min: number, max: number }[]) {
  if (!thresholds || thresholds.length === 0) return `'Unknown'`;
  let sql = `(CASE `;
  for (const t of thresholds) {
    sql += `WHEN ${column} >= ${t.min} AND ${column} <= ${t.max} THEN '${t.label}' `;
  }
  sql += `ELSE 'Unknown' END)`;
  return sql;
}

function hasOwn<T extends object>(obj: T, key: keyof T): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function validateScoreRange(fieldName: string, value: unknown) {
  if (value === undefined || value === null) return;
  if (typeof value !== 'number' || Number.isNaN(value) || value < 0 || value > 100) {
    throw new Error(`${fieldName} must be a number between 0 and 100.`);
  }
}

interface PatchRequestBody {
  localId: string;
  firstName?: string | null;
  lastName?: string | null;
  staarScore?: number | null;
  fallScore?: number | null;
  springScore?: number | null;
}

export async function GET() {
  let connection: mysql.PoolConnection | null = null;
  try {
    connection = await connectToDatabase();

    const config = await getConfig();
    const mathPreviousThresholds = config?.thresholds?.math?.previous || [];
    const mathCurrentThresholds = config?.thresholds?.math?.current || [];

    const staarLevelSql = getLevelSql('StaarScore', mathPreviousThresholds);
    const fallLevelSql = getLevelSql('FallScore', mathCurrentThresholds);
    const springLevelSql = getLevelSql('SpringScore', mathCurrentThresholds);

    const baseQuery = `
      WITH LocalIds AS (
        SELECT \`Local Id\` AS LocalId FROM spring_matrix_data
        UNION
        SELECT LocalId FROM fall_performance
        UNION
        SELECT LocalId FROM previous_performance
      )
      SELECT
        ids.LocalId AS LocalId,
        COALESCE(s.\`Last Name\`, f.LastName, p.LastName) as LastName,
        COALESCE(s.\`First Name\`, f.FirstName, p.FirstName) as FirstName,
        COALESCE(p.Score, s.\`STAAR MA07 Percent Score\`) as StaarScore,
        f.Score as FallScore,
        s.\`Benchmark PercentScore\` as SpringScore,
        COALESCE(s.Grade, 'N/A') as Grade,
        COALESCE(s.\`Benchmark Teacher\`, 'N/A') as Teacher
      FROM LocalIds ids
      LEFT JOIN spring_matrix_data s ON ids.LocalId = s.\`Local Id\`
      LEFT JOIN fall_performance f ON ids.LocalId = f.LocalId
      LEFT JOIN previous_performance p ON ids.LocalId = p.LocalId
    `;

    // Wrap in CTE to apply level calculation on existing columns
    const query = `
      WITH AllScores AS (${baseQuery})
      SELECT 
        *,
        ${staarLevelSql} as StaarLevel,
        ${fallLevelSql} as FallLevel,
        ${springLevelSql} as SpringLevel
      FROM AllScores
      ORDER BY LastName, FirstName
    `;

    const [rows] = await connection.execute(query);
    return NextResponse.json(rows);
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  } finally {
    if (connection) await connection.release();
  }
}

export async function PATCH(request: Request) {
  let connection: mysql.PoolConnection | null = null;
  try {
    const body = (await request.json()) as PatchRequestBody;
    if (!body?.localId || !body.localId.trim()) {
      return NextResponse.json({ error: 'localId is required' }, { status: 400 });
    }

    validateScoreRange('staarScore', body.staarScore);
    validateScoreRange('fallScore', body.fallScore);
    validateScoreRange('springScore', body.springScore);

    const hasStaar = hasOwn(body, 'staarScore');
    const hasFall = hasOwn(body, 'fallScore');
    const hasSpring = hasOwn(body, 'springScore');

    if (!hasStaar && !hasFall && !hasSpring) {
      return NextResponse.json({ error: 'No score fields provided' }, { status: 400 });
    }

    const localId = body.localId.trim();
    connection = await connectToDatabase();
    await connection.beginTransaction();

    const [nameRows] = await connection.execute(
      `
        SELECT FirstName, LastName
        FROM (
          SELECT \`First Name\` as FirstName, \`Last Name\` as LastName
          FROM spring_matrix_data
          WHERE \`Local Id\` = ?
          UNION ALL
          SELECT FirstName, LastName
          FROM fall_performance
          WHERE LocalId = ?
          UNION ALL
          SELECT FirstName, LastName
          FROM previous_performance
          WHERE LocalId = ?
        ) all_names
        WHERE FirstName IS NOT NULL OR LastName IS NOT NULL
        LIMIT 1
      `,
      [localId, localId, localId],
    );

    const existingName = Array.isArray(nameRows) && nameRows.length > 0 ? (nameRows[0] as { FirstName?: string | null; LastName?: string | null }) : null;
    const firstName = body.firstName ?? existingName?.FirstName ?? null;
    const lastName = body.lastName ?? existingName?.LastName ?? null;

    if (hasStaar) {
      await connection.execute(
        `
          INSERT INTO previous_performance (LocalId, FirstName, LastName, Score)
          VALUES (?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            Score = VALUES(Score),
            FirstName = COALESCE(VALUES(FirstName), FirstName),
            LastName = COALESCE(VALUES(LastName), LastName)
        `,
        [localId, firstName, lastName, body.staarScore ?? null],
      );
    }

    if (hasFall) {
      await connection.execute(
        `
          INSERT INTO fall_performance (LocalId, FirstName, LastName, Score)
          VALUES (?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            Score = VALUES(Score),
            FirstName = COALESCE(VALUES(FirstName), FirstName),
            LastName = COALESCE(VALUES(LastName), LastName)
        `,
        [localId, firstName, lastName, body.fallScore ?? null],
      );
    }

    if (hasSpring || hasStaar) {
      const columns = ['`Local Id`', '`First Name`', '`Last Name`'];
      const values: Array<string | number | null> = [localId, firstName, lastName];
      const placeholders = ['?', '?', '?'];
      const updates = [
        '`First Name` = COALESCE(VALUES(`First Name`), `First Name`)',
        '`Last Name` = COALESCE(VALUES(`Last Name`), `Last Name`)',
      ];

      if (hasSpring) {
        columns.push('`Benchmark PercentScore`');
        placeholders.push('?');
        values.push(body.springScore ?? null);
        updates.push('`Benchmark PercentScore` = VALUES(`Benchmark PercentScore`)');
      }

      if (hasStaar) {
        columns.push('`STAAR MA07 Percent Score`');
        placeholders.push('?');
        values.push(body.staarScore ?? null);
        updates.push('`STAAR MA07 Percent Score` = VALUES(`STAAR MA07 Percent Score`)');
      }

      await connection.execute(
        `
          INSERT INTO spring_matrix_data (${columns.join(', ')})
          VALUES (${placeholders.join(', ')})
          ON DUPLICATE KEY UPDATE
            ${updates.join(', ')}
        `,
        values,
      );
    }

    await connection.commit();
    return NextResponse.json({
      success: true,
      localId,
      updated: {
        staar: hasStaar,
        fall: hasFall,
        spring: hasSpring,
      },
    });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error('Patch error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to update scores' }, { status: 500 });
  } finally {
    if (connection) await connection.release();
  }
}

export async function DELETE(request: Request) {
  let connection: mysql.PoolConnection | null = null;
  try {
    const { localId } = await request.json();
    if (!localId) {
      return NextResponse.json({ error: 'LocalId required' }, { status: 400 });
    }

    connection = await connectToDatabase();

    // Delete from all tables
    await connection.execute('DELETE FROM spring_matrix_data WHERE `Local Id` = ?', [localId]);
    await connection.execute('DELETE FROM fall_performance WHERE LocalId = ?', [localId]);
    await connection.execute('DELETE FROM previous_performance WHERE LocalId = ?', [localId]);
    await connection.execute('DELETE FROM rla_data7 WHERE LocalId = ?', [localId]);
    await connection.execute('DELETE FROM rla_data8 WHERE LocalId = ?', [localId]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete error:', error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  } finally {
    if (connection) await connection.release();
  }
}

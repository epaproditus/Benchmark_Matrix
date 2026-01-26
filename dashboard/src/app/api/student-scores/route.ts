import { NextResponse } from 'next/server';
import { connectToDatabase } from '../../../lib/db';
import fs from 'fs/promises';
import path from 'path';

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

export async function GET() {
  let connection;
  try {
    connection = await connectToDatabase();

    const config = await getConfig();
    const mathPreviousThresholds = config?.thresholds?.math?.previous || [];
    const mathCurrentThresholds = config?.thresholds?.math?.current || [];

    const staarLevelSql = getLevelSql('StaarScore', mathPreviousThresholds);
    const fallLevelSql = getLevelSql('FallScore', mathCurrentThresholds);
    const springLevelSql = getLevelSql('SpringScore', mathCurrentThresholds);

    const baseQuery = `
      SELECT DISTINCT
        COALESCE(s.\`Local Id\`, f.LocalId, p.LocalId) as LocalId,
        COALESCE(s.\`Last Name\`, f.LastName, p.LastName) as LastName,
        COALESCE(s.\`First Name\`, f.FirstName, p.FirstName) as FirstName,
        COALESCE(p.Score, s.\`STAAR MA07 Percent Score\`) as StaarScore,
        f.Score as FallScore,
        s.\`Benchmark PercentScore\` as SpringScore,
        COALESCE(s.Grade, '7') as Grade,
        COALESCE(s.\`Benchmark Teacher\`, 'Unknown') as Teacher
      FROM spring_matrix_data s
      LEFT JOIN fall_performance f ON s.\`Local Id\` = f.LocalId
      LEFT JOIN previous_performance p ON s.\`Local Id\` = p.LocalId
      
      UNION
      
      SELECT DISTINCT
        COALESCE(s.\`Local Id\`, f.LocalId, p.LocalId) as LocalId,
        COALESCE(s.\`Last Name\`, f.LastName, p.LastName) as LastName,
        COALESCE(s.\`First Name\`, f.FirstName, p.FirstName) as FirstName,
        COALESCE(p.Score, s.\`STAAR MA07 Percent Score\`) as StaarScore,
        f.Score as FallScore,
        s.\`Benchmark PercentScore\` as SpringScore,
        'N/A' as Grade,
        'N/A' as Teacher
      FROM fall_performance f
      LEFT JOIN spring_matrix_data s ON f.LocalId = s.\`Local Id\`
      LEFT JOIN previous_performance p ON f.LocalId = p.LocalId
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

export async function DELETE(request: Request) {
  let connection;
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

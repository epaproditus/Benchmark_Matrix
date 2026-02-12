import { NextResponse } from 'next/server';
import { connectToDatabase } from '../../../lib/db';
import { DatabaseParams } from '../../../types/api';
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

// Helper to get level SQL using COALESCE for previous performance priority
function getLevelSql(column: string, thresholds: { label: string, min: number, max: number }[], useOverride = false) {
  if (!thresholds || thresholds.length === 0) return `'Unknown'`;

  // If useOverride is true, we expect 'column' to be the fallback, and we check 'pp_score' first
  const targetCol = useOverride ? `COALESCE(pp_score, ${column})` : column;

  let sql = `(CASE `;
  for (const t of thresholds) {
    sql += `WHEN ${targetCol} >= ${t.min} AND ${targetCol} <= ${t.max} THEN '${t.label}' `;
  }
  sql += `ELSE 'Unknown' END)`;
  return sql;
}

// Helper to get group number SQL
function getGroupNumberSql(staarCol: string, benchCol: string) {
  return `(CASE 
    WHEN ${staarCol} = 'Did Not Meet Low' AND ${benchCol} = 'Did Not Meet Low' THEN 1
    WHEN ${staarCol} = 'Did Not Meet Low' AND ${benchCol} = 'Did Not Meet High' THEN 2
    WHEN ${staarCol} = 'Did Not Meet Low' AND ${benchCol} = 'Approaches Low' THEN 3
    WHEN ${staarCol} = 'Did Not Meet Low' AND ${benchCol} = 'Approaches High' THEN 4
    WHEN ${staarCol} = 'Did Not Meet Low' AND ${benchCol} = 'Meets' THEN 5
    WHEN ${staarCol} = 'Did Not Meet Low' AND ${benchCol} = 'Masters' THEN 6
    
    WHEN ${staarCol} = 'Did Not Meet High' AND ${benchCol} = 'Did Not Meet Low' THEN 7
    WHEN ${staarCol} = 'Did Not Meet High' AND ${benchCol} = 'Did Not Meet High' THEN 8
    WHEN ${staarCol} = 'Did Not Meet High' AND ${benchCol} = 'Approaches Low' THEN 9
    WHEN ${staarCol} = 'Did Not Meet High' AND ${benchCol} = 'Approaches High' THEN 10
    WHEN ${staarCol} = 'Did Not Meet High' AND ${benchCol} = 'Meets' THEN 11
    WHEN ${staarCol} = 'Did Not Meet High' AND ${benchCol} = 'Masters' THEN 12
    
    WHEN ${staarCol} = 'Approaches Low' AND ${benchCol} = 'Did Not Meet Low' THEN 13
    WHEN ${staarCol} = 'Approaches Low' AND ${benchCol} = 'Did Not Meet High' THEN 14
    WHEN ${staarCol} = 'Approaches Low' AND ${benchCol} = 'Approaches Low' THEN 15
    WHEN ${staarCol} = 'Approaches Low' AND ${benchCol} = 'Approaches High' THEN 16
    WHEN ${staarCol} = 'Approaches Low' AND ${benchCol} = 'Meets' THEN 17
    WHEN ${staarCol} = 'Approaches Low' AND ${benchCol} = 'Masters' THEN 18
    
    WHEN ${staarCol} = 'Approaches High' AND ${benchCol} = 'Did Not Meet Low' THEN 19
    WHEN ${staarCol} = 'Approaches High' AND ${benchCol} = 'Did Not Meet High' THEN 20
    WHEN ${staarCol} = 'Approaches High' AND ${benchCol} = 'Approaches Low' THEN 21
    WHEN ${staarCol} = 'Approaches High' AND ${benchCol} = 'Approaches High' THEN 22
    WHEN ${staarCol} = 'Approaches High' AND ${benchCol} = 'Meets' THEN 23
    WHEN ${staarCol} = 'Approaches High' AND ${benchCol} = 'Masters' THEN 24
    
    WHEN ${staarCol} = 'Meets' AND ${benchCol} = 'Did Not Meet Low' THEN 25
    WHEN ${staarCol} = 'Meets' AND ${benchCol} = 'Did Not Meet High' THEN 26
    WHEN ${staarCol} = 'Meets' AND ${benchCol} = 'Approaches Low' THEN 27
    WHEN ${staarCol} = 'Meets' AND ${benchCol} = 'Approaches High' THEN 28
    WHEN ${staarCol} = 'Meets' AND ${benchCol} = 'Meets' THEN 29
    WHEN ${staarCol} = 'Meets' AND ${benchCol} = 'Masters' THEN 30
    
    WHEN ${staarCol} = 'Masters' AND ${benchCol} = 'Did Not Meet Low' THEN 31
    WHEN ${staarCol} = 'Masters' AND ${benchCol} = 'Did Not Meet High' THEN 32
    WHEN ${staarCol} = 'Masters' AND ${benchCol} = 'Approaches Low' THEN 33
    WHEN ${staarCol} = 'Masters' AND ${benchCol} = 'Approaches High' THEN 34
    WHEN ${staarCol} = 'Masters' AND ${benchCol} = 'Meets' THEN 35
    WHEN ${staarCol} = 'Masters' AND ${benchCol} = 'Masters' THEN 36
    
    ELSE 0
  END)`;
}

export async function GET(request: Request) {
  let connection;
  const { searchParams } = new URL(request.url);

  const teacher = searchParams.get('teacher');
  const grade = searchParams.get('grade');
  const version = searchParams.get('version') || 'spring';
  const subject = searchParams.get('subject') || 'math';

  const config = await getConfig();
  const mathPreviousThresholds = config?.thresholds?.math?.previous || [];
  const mathCurrentThresholds = config?.thresholds?.math?.current || [];
  const rlaPreviousThresholds = config?.thresholds?.rla?.previous || [];
  const rlaCurrentThresholds = config?.thresholds?.rla?.current || [];

  // Y-axis uses previous STAAR from previous_performance (pp_score)
  const mathStaarSql = getLevelSql('COALESCE(pp_score, 0)', mathPreviousThresholds, false);
  const mathBenchSql = getLevelSql('`Benchmark PercentScore`', mathCurrentThresholds, false);

  const rlaStaarSql = getLevelSql('COALESCE(pp_score, 0)', rlaPreviousThresholds, false);
  const rlaBenchSql = getLevelSql('Benchmark_Score', rlaCurrentThresholds, false);

  try {
    connection = await connectToDatabase();

    // Define staarQuery based on parameters
    let staarQuery = '';

    if (!grade) {
      // No grade filter - combine data from both grades
      if (subject === 'rla') {
        staarQuery = `
            SELECT 
              ${rlaStaarSql} as level,
              COUNT(*) as total
            FROM (
              SELECT base.*, pp.Score as pp_score
              FROM (
                SELECT * FROM rla_data7
                UNION ALL
                SELECT * FROM rla_data8
              ) base
              LEFT JOIN previous_performance pp ON base.LocalId = pp.LocalId
            ) combined
            WHERE 1=1
            ${teacher ? 'AND Teacher = ?' : ''}
            GROUP BY level
          `;
      } else if (subject === 'campus') {
        staarQuery = `
            SELECT 
              staar_level as level,
              CAST(SUM(total) AS SIGNED) as total
            FROM (
              SELECT 
                ${mathStaarSql} as staar_level,
                COUNT(*) as total
              FROM (
                SELECT base.*, pp.Score as pp_score
                FROM (
                    SELECT * FROM spring_matrix_data
                    ${version === 'spring' ? 'WHERE `Local Id` NOT IN (SELECT LocalID FROM spralg1)' : ''}
                    UNION ALL
                    SELECT * FROM spring7_matrix_view
                ) base
                LEFT JOIN previous_performance pp ON base.\`Local Id\` = pp.LocalId
              ) math_combined
              GROUP BY staar_level
              
              UNION ALL
              
              SELECT 
                ${rlaStaarSql} as staar_level,
                COUNT(*) as total
              FROM (
                SELECT base.*, pp.Score as pp_score
                FROM (
                    SELECT * FROM rla_data7
                    UNION ALL
                    SELECT * FROM rla_data8
                ) base
                LEFT JOIN previous_performance pp ON base.LocalId = pp.LocalId
              ) rla_combined
              GROUP BY staar_level
            ) combined
            GROUP BY staar_level
          `;
      } else {
        // Math (Spring/Default)
        staarQuery = `
            SELECT 
              ${mathStaarSql} as level,
              COUNT(*) as total
            FROM (
              SELECT base.*, pp.Score as pp_score
              FROM (
                  SELECT * FROM spring_matrix_data
                  ${version === 'spring' ? 'WHERE `Local Id` NOT IN (SELECT LocalID FROM spralg1)' : ''}
                  UNION ALL
                  SELECT * FROM spring7_matrix_view
              ) base
              LEFT JOIN previous_performance pp ON base.\`Local Id\` = pp.LocalId
            ) combined
            WHERE 1=1
            ${teacher ? 'AND TRIM(`Benchmark Teacher`) = ?' : ''}
            GROUP BY level
          `;
      }
    } else {
      // Grade Exists
      if (subject === 'rla') {
        staarQuery = `
          SELECT 
            ${rlaStaarSql} as level,
            COUNT(*) as total
          FROM (
             SELECT base.*, pp.Score as pp_score
             FROM ${grade === '7' ? 'rla_data7' : 'rla_data8'} base
             LEFT JOIN previous_performance pp ON base.LocalId = pp.LocalId
          ) combined
          WHERE 1=1
          ${teacher ? 'AND Teacher = ?' : ''}
          GROUP BY level
        `;
      } else {
        // Math
        staarQuery = `
          SELECT 
            ${mathStaarSql} as level,
            COUNT(*) as total
          FROM (
            SELECT base.*, pp.Score as pp_score
            FROM ${grade === '7' ? 'spring7_matrix_view' : 'spring_matrix_data'} base
            LEFT JOIN previous_performance pp ON base.${subject === 'rla' ? 'LocalId' : '`Local Id`'} = pp.LocalId
          ) combined
          WHERE 1=1
          ${grade ? 'AND Grade = ?' : ''}
          ${teacher ? `AND ${subject === 'rla' ? 'Teacher' : '`Benchmark Teacher`'} = ?` : ''}
          ${version === 'spring' && subject !== 'rla' ? 'AND `Local Id` NOT IN (SELECT LocalID FROM spralg1)' : ''}
          GROUP BY level
        `;
      }
    }

    // OVERRIDE: If version is 'fall', use our new fall_performance table
    // This allows the manually imported data to drive the Matrix X-Axis
    if (version === 'fall') {
      const fallLevelSql = getLevelSql('Score', subject === 'math' ? mathCurrentThresholds : rlaCurrentThresholds, false);

      staarQuery = `
          SELECT 
            ${fallLevelSql} as level,
            COUNT(*) as total
          FROM (
             SELECT 
               fp.LocalId, 
               fp.Score, 
               pp.Score as pp_score 
             FROM fall_performance fp
             LEFT JOIN previous_performance pp ON fp.LocalId = pp.LocalId
             WHERE 1=1 
             -- We can filter by subject inside fall_performance if we had it populated (currently null)
             -- ${subject ? 'AND (fp.Subject IS NULL OR fp.Subject = ?)' : ''}
          ) combined
          GROUP BY level
        `;
    }

    let query = '';
    if (!grade) {
      // No grade filter - combine data from both grades
      if (subject === 'campus') {
        // Campus view combines both math and RLA data
        query = `
          WITH MathCalculated AS (
            SELECT 
              ${mathStaarSql} as staar_level,
              ${mathBenchSql} as benchmark_level
            FROM (
              SELECT base.*, pp.Score as pp_score 
              FROM (
                SELECT * FROM spring_matrix_data 
                ${version === 'spring' ? 'WHERE `Local Id` NOT IN (SELECT LocalID FROM spralg1)' : ''}
                UNION ALL
                SELECT * FROM spring7_matrix_view
              ) base
              LEFT JOIN previous_performance pp ON base.\`Local Id\` = pp.LocalId
            ) math_combined
          ),
          MathData AS (
            SELECT
              staar_level,
              benchmark_level,
              COUNT(*) as student_count,
              ${getGroupNumberSql('staar_level', 'benchmark_level')} as group_number
            FROM MathCalculated
            GROUP BY 
              staar_level,
              benchmark_level
          ),
          RLAData AS (
            SELECT 
              ${rlaStaarSql} as staar_level,
              ${rlaBenchSql} as benchmark_level,
              COUNT(*) as student_count,
              Group_Number as group_number
            FROM (
              SELECT base.*, pp.Score as pp_score 
              FROM (
                SELECT * FROM rla_data7
                UNION ALL
                SELECT * FROM rla_data8
              ) base
              LEFT JOIN previous_performance pp ON base.LocalId = pp.LocalId
            ) rla_combined
            GROUP BY 
              staar_level,
              benchmark_level,
              Group_Number
          )
          SELECT 
            staar_level,
            benchmark_level,
            CAST(SUM(student_count) AS SIGNED) as student_count,
            group_number
          FROM (
            SELECT * FROM MathData
            UNION ALL
            SELECT * FROM RLAData
          ) combined
          GROUP BY 
            staar_level,
            benchmark_level,
            group_number
        `;
        const [result] = await connection.execute(query, grade ? [grade] : []);
        const [staarTotals] = await connection.execute(staarQuery, teacher ? [teacher] : []);
        await connection.release();
        return NextResponse.json({
          matrixData: result,
          staarTotals
        });
      } else if (subject === 'rla') {
        query = `
          SELECT 
            ${rlaStaarSql} as staar_level,
            ${rlaBenchSql} as benchmark_level,
            COUNT(*) as student_count,
            Group_Number as group_number
          FROM (
             SELECT base.*, pp.Score as pp_score 
             FROM (
                SELECT * FROM rla_data7
                UNION ALL
                SELECT * FROM rla_data8
             ) base
             LEFT JOIN previous_performance pp ON base.LocalId = pp.LocalId
          ) combined
          WHERE 1=1
          ${teacher ? 'AND Teacher = ?' : ''}
          GROUP BY staar_level, benchmark_level, group_number
        `;
      } else {
        if (version === 'spring' || version === 'spring-algebra') {
          query = `
            WITH Calculated AS (
              SELECT 
                ${mathStaarSql} as staar_level,
                ${mathBenchSql} as benchmark_level
              FROM (
                SELECT base.*, pp.Score as pp_score 
                FROM (
                  SELECT * FROM spring_matrix_data 
                  ${version === 'spring' ? 'WHERE `Local Id` NOT IN (SELECT LocalID FROM spralg1)' : ''}
                  UNION ALL
                  SELECT * FROM spring7_matrix_view
                ) base
                LEFT JOIN previous_performance pp ON base.\`Local Id\` = pp.LocalId
              ) t1
              WHERE 1=1
              ${teacher ? 'AND `Benchmark Teacher` = ?' : ''}
            )
            SELECT
              staar_level,
              benchmark_level,
              COUNT(*) as student_count,
              ${getGroupNumberSql('staar_level', 'benchmark_level')} as group_number
            FROM Calculated
            GROUP BY staar_level, benchmark_level
          `;
        }
      }
    } else {
      // Single grade filter logic omitted for brevity as it follows same pattern, 
      // but since we are overwriting, we MUST include it.
      // Re-implementing single grade logic with JOINs:

      if (subject === 'campus') {
        const mathTable = grade === '7' ? 'spring7_matrix_view' : 'spring_matrix_data';
        const rlaTable = grade === '7' ? 'rla_data7' : 'rla_data8';

        query = `
          WITH MathCalculated AS (
            SELECT 
              ${mathStaarSql} as staar_level,
              ${mathBenchSql} as benchmark_level
            FROM (
                SELECT base.*, pp.Score as pp_score
                FROM ${mathTable} base
                LEFT JOIN previous_performance pp ON base.\`Local Id\` = pp.LocalId
            ) m
            WHERE Grade = ?
            ${version === 'spring' ? 'AND `Local Id` NOT IN (SELECT LocalID FROM spralg1)' : ''}
          ),
          MathData AS (
            SELECT
              staar_level,
              benchmark_level,
              COUNT(*) as student_count,
              ${getGroupNumberSql('staar_level', 'benchmark_level')} as group_number
            FROM MathCalculated
            GROUP BY 
              staar_level,
              benchmark_level
          ),
          RLAData AS (
            SELECT 
              ${rlaStaarSql} as staar_level,
              Benchmark_Performance as benchmark_level,
              COUNT(*) as student_count,
              Group_Number as group_number
            FROM (
                SELECT base.*, pp.Score as pp_score
                FROM ${rlaTable} base
                LEFT JOIN previous_performance pp ON base.LocalId = pp.LocalId
            ) r
            GROUP BY 
              staar_level,
              benchmark_level,
              Group_Number
          )
          SELECT 
            staar_level,
            benchmark_level,
            CAST(SUM(student_count) AS SIGNED) as student_count,
            group_number
          FROM (
            SELECT * FROM MathData
            UNION ALL
            SELECT * FROM RLAData
          ) combined
          GROUP BY 
            staar_level,
            benchmark_level,
            group_number
          ORDER BY 
            FIELD(staar_level, 'Did Not Meet Low', 'Did Not Meet High', 'Approaches Low', 'Approaches High', 'Meets', 'Masters'),
            FIELD(benchmark_level, 'Did Not Meet Low', 'Did Not Meet High', 'Approaches Low', 'Approaches High', 'Meets', 'Masters')
        `;

        // ... handlers
        if (teacher) {
          const [result] = await connection.execute(query, [grade, teacher]);
          const [staarTotals] = await connection.execute(staarQuery, [grade, teacher]);
          await connection.release();
          return NextResponse.json({
            matrixData: result,
            staarTotals
          });
        } else {
          const [result] = await connection.execute(query, [grade]);
          const [staarTotals] = await connection.execute(staarQuery, [grade]);
          await connection.release();
          return NextResponse.json({
            matrixData: result,
            staarTotals
          });
        }
      } else if (subject === 'rla') {
        const tableName = grade === '7' ? 'rla_data7' : 'rla_data8';
        query = `
          SELECT
            ${rlaStaarSql} as staar_level,
            ${rlaBenchSql} as benchmark_level,
            COUNT(*) as student_count,
            Group_Number as group_number
          FROM (
             SELECT base.*, pp.Score as pp_score
             FROM ${tableName} base
             LEFT JOIN previous_performance pp ON base.LocalId = pp.LocalId
          ) combined
          WHERE 1=1
          ${teacher ? 'AND Teacher = ?' : ''}
          GROUP BY staar_level, benchmark_level, Group_Number
        `;
      } else {
        // Math fallback for single grade
        const tableName = grade === '7' ? 'spring7_matrix_view' : 'spring_matrix_data';
        query = `
          WITH Calculated AS (
            SELECT
              ${mathStaarSql} as staar_level,
              ${mathBenchSql} as benchmark_level
            FROM (
               SELECT base.*, pp.Score as pp_score
               FROM ${tableName} base
               LEFT JOIN previous_performance pp ON base.\`Local Id\` = pp.LocalId
            ) combined
            WHERE 1=1
            ${teacher ? 'AND `Benchmark Teacher` = ?' : ''}
            ${version === 'spring' ? 'AND `Local Id` NOT IN (SELECT LocalID FROM spralg1)' : ''}
          )
          SELECT
            staar_level,
            benchmark_level,
            COUNT(*) as student_count,
            ${getGroupNumberSql('staar_level', 'benchmark_level')} as group_number
          FROM Calculated
          GROUP BY staar_level, benchmark_level
        `;
      }
    }

    // OVERRIDE FOR FALL: Use fall_performance table if version is 'fall'
    if (version === 'fall') {
      // Use Math thresholds for 'campus' view to match frontend default
      const useRla = subject === 'rla';
      const fallBenchSql = getLevelSql('fp.Score', useRla ? rlaCurrentThresholds : mathCurrentThresholds, false);
      const fallStaarSql = getLevelSql('COALESCE(pp.Score, 0)', useRla ? rlaPreviousThresholds : mathPreviousThresholds, false);


      // Use CTE to calculate levels first, then map to groups
      query = `
        WITH Calculated AS(
            SELECT 
             ${fallStaarSql} as staar_level,
            ${fallBenchSql} as benchmark_level
           FROM fall_performance fp
           LEFT JOIN previous_performance pp ON fp.LocalId = pp.LocalId
           WHERE 1 = 1
          )
          SELECT
          staar_level,
            benchmark_level,
            COUNT(*) as student_count,
            CASE 
            WHEN staar_level = 'Did Not Meet Low' AND benchmark_level = 'Did Not Meet Low' THEN 1
            WHEN staar_level = 'Did Not Meet Low' AND benchmark_level = 'Did Not Meet High' THEN 2
            WHEN staar_level = 'Did Not Meet Low' AND benchmark_level = 'Approaches Low' THEN 3
            WHEN staar_level = 'Did Not Meet Low' AND benchmark_level = 'Approaches High' THEN 4
            WHEN staar_level = 'Did Not Meet Low' AND benchmark_level = 'Meets' THEN 5
            WHEN staar_level = 'Did Not Meet Low' AND benchmark_level = 'Masters' THEN 6
            
            WHEN staar_level = 'Did Not Meet High' AND benchmark_level = 'Did Not Meet Low' THEN 7
            WHEN staar_level = 'Did Not Meet High' AND benchmark_level = 'Did Not Meet High' THEN 8
            WHEN staar_level = 'Did Not Meet High' AND benchmark_level = 'Approaches Low' THEN 9
            WHEN staar_level = 'Did Not Meet High' AND benchmark_level = 'Approaches High' THEN 10
            WHEN staar_level = 'Did Not Meet High' AND benchmark_level = 'Meets' THEN 11
            WHEN staar_level = 'Did Not Meet High' AND benchmark_level = 'Masters' THEN 12
            
            WHEN staar_level = 'Approaches Low' AND benchmark_level = 'Did Not Meet Low' THEN 13
            WHEN staar_level = 'Approaches Low' AND benchmark_level = 'Did Not Meet High' THEN 14
            WHEN staar_level = 'Approaches Low' AND benchmark_level = 'Approaches Low' THEN 15
            WHEN staar_level = 'Approaches Low' AND benchmark_level = 'Approaches High' THEN 16
            WHEN staar_level = 'Approaches Low' AND benchmark_level = 'Meets' THEN 17
            WHEN staar_level = 'Approaches Low' AND benchmark_level = 'Masters' THEN 18
            
            WHEN staar_level = 'Approaches High' AND benchmark_level = 'Did Not Meet Low' THEN 19
            WHEN staar_level = 'Approaches High' AND benchmark_level = 'Did Not Meet High' THEN 20
            WHEN staar_level = 'Approaches High' AND benchmark_level = 'Approaches Low' THEN 21
            WHEN staar_level = 'Approaches High' AND benchmark_level = 'Approaches High' THEN 22
            WHEN staar_level = 'Approaches High' AND benchmark_level = 'Meets' THEN 23
            WHEN staar_level = 'Approaches High' AND benchmark_level = 'Masters' THEN 24
            
            WHEN staar_level = 'Meets' AND benchmark_level = 'Did Not Meet Low' THEN 25
            WHEN staar_level = 'Meets' AND benchmark_level = 'Did Not Meet High' THEN 26
            WHEN staar_level = 'Meets' AND benchmark_level = 'Approaches Low' THEN 27
            WHEN staar_level = 'Meets' AND benchmark_level = 'Approaches High' THEN 28
            WHEN staar_level = 'Meets' AND benchmark_level = 'Meets' THEN 29
            WHEN staar_level = 'Meets' AND benchmark_level = 'Masters' THEN 30
            
            WHEN staar_level = 'Masters' AND benchmark_level = 'Did Not Meet Low' THEN 31
            WHEN staar_level = 'Masters' AND benchmark_level = 'Did Not Meet High' THEN 32
            WHEN staar_level = 'Masters' AND benchmark_level = 'Approaches Low' THEN 33
            WHEN staar_level = 'Masters' AND benchmark_level = 'Approaches High' THEN 34
            WHEN staar_level = 'Masters' AND benchmark_level = 'Meets' THEN 35
            WHEN staar_level = 'Masters' AND benchmark_level = 'Masters' THEN 36
            
            ELSE 0
          END as group_number
        FROM Calculated
        GROUP BY staar_level, benchmark_level
            `;

      // Also update staarQuery to reflect the Fall population
      staarQuery = `
          SELECT 
            ${fallStaarSql} as level,
            COUNT(*) as total
          FROM fall_performance fp
          LEFT JOIN previous_performance pp ON fp.LocalId = pp.LocalId
          GROUP BY level
       `;
    }

    const queryParams1 = [];
    if (version !== 'fall') {
      if (grade && subject !== 'campus') queryParams1.push(grade);
      if (teacher) queryParams1.push(teacher);
    }

    const [matrixData] = await connection.execute(query, queryParams1);

    const staarParams = [];
    if (version !== 'fall') {
      if (grade && subject !== 'campus') staarParams.push(grade);
      if (teacher) staarParams.push(teacher);
    }
    const [staarTotals] = await connection.execute(staarQuery, staarParams);

    await connection.release();

    return NextResponse.json({
      matrixData,
      staarTotals
    });

  } catch (error) {
    if (connection) connection.release();
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let connection;
  try {
    const {
      subject = 'math',
      staar_level,
      benchmark_level,
      group_number,
      teacher,
      grade,
      version = 'spring',
      search
    } = await request.json();

    let params: DatabaseParams = [];
    let query = '';

    const config = await getConfig();
    const mathPreviousThresholds = config?.thresholds?.math?.previous || [];
    const mathCurrentThresholds = config?.thresholds?.math?.current || [];
    const rlaPreviousThresholds = config?.thresholds?.rla?.previous || [];
    const rlaCurrentThresholds = config?.thresholds?.rla?.current || [];

    const mathStaarSql = getLevelSql('COALESCE(m.pp_score, m.`STAAR MA07 Percent Score`)', mathPreviousThresholds, false);
    const mathBenchSql = getLevelSql('m.`Benchmark PercentScore`', mathCurrentThresholds, false);
    const mathGroupSql = getGroupNumberSql(mathStaarSql, mathBenchSql);

    const rlaStaarSql = getLevelSql('COALESCE(m.pp_score, m.STAAR_Score)', rlaPreviousThresholds, false);
    const rlaBenchSql = getLevelSql('m.Benchmark_Score', rlaCurrentThresholds, false);
    const joinedRlaStaarSql = getLevelSql('COALESCE(r.pp_score, r.STAAR_Score)', rlaPreviousThresholds, false);
    const joinedRlaBenchSql = getLevelSql('r.Benchmark_Score', rlaCurrentThresholds, false);

    connection = await connectToDatabase();

    // Handle search case
    // Handle search case
    if (search) {
      const whereClause = [];
      params = [];

      whereClause.push('(m.`First Name` LIKE ? OR m.`Last Name` LIKE ? OR m.`Local Id` LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);

      if (teacher) {
        whereClause.push(`m.${subject === 'rla' ? 'Teacher' : '`Benchmark Teacher`'} = ?`);
        params.push(teacher);
      }
      if (grade) {
        whereClause.push('m.Grade = ?');
        params.push(grade);
      }

      // Dynamic SQL for levels (Fall only)
      const fallBenchSql = getLevelSql('m.`Benchmark PercentScore`', subject === 'rla' ? rlaCurrentThresholds : mathCurrentThresholds, false);
      const fallStaarSql = getLevelSql('COALESCE(pp.Score, 0)', subject === 'rla' ? rlaPreviousThresholds : mathPreviousThresholds, false);

      const groupNumCalc = getGroupNumberSql('staar_level', 'benchmark_level');

      query = `
        WITH SearchSource AS (
             SELECT DISTINCT
              m.\`First Name\`,
              m.\`Last Name\`,
              m.Grade,
              m.Campus,
              m.\`Local Id\` as local_id,
              m.\`Benchmark Teacher\` as Teacher,
              
              -- Math/Main scores
              COALESCE(pp.Score, m.\`STAAR MA07 Percent Score\`) as staar_score,
              ${version === 'fall' ? fallStaarSql : 'm.`2024 STAAR Performance`'} as staar_level,
              
              m.\`Benchmark PercentScore\` as benchmark_score,
              ${version === 'fall' ? fallBenchSql : 'm.`2024-25 Benchmark Performance`'} as benchmark_level,
              
              m.\`Group #\` as original_group_number,

              fp_all.Score as fall_benchmark_score,
              sp_all.\`Benchmark PercentScore\` as spring_benchmark_score,

              -- RLA scores
              COALESCE(pp2.Score, r.STAAR_Score) as rla_staar_score,
              r.STAAR_Performance as rla_staar_level,
              r.Benchmark_Score as rla_benchmark_score,
              r.Benchmark_Performance as rla_benchmark_level,
              r.Group_Number as rla_group_number

            FROM (
              ${version === 'fall' ? `
                SELECT 
                  LocalId as \`Local Id\`, 
                  FirstName as \`First Name\`, 
                  LastName as \`Last Name\`, 
                  Score as \`Benchmark PercentScore\`, 
                  Subject,
                  NULL as \`Benchmark Teacher\`, 
                  NULL as Grade, 
                  NULL as Campus,
                  NULL as \`STAAR MA07 Percent Score\`,
                  NULL as \`2024 STAAR Performance\`,
                  NULL as \`2024-25 Benchmark Performance\`,
                  NULL as \`Group #\`
                FROM fall_performance
              ` : `
                SELECT * FROM spring_matrix_data
                ${version === 'spring' ? 'WHERE `Local Id` NOT IN (SELECT LocalID FROM spralg1)' : ''}
                UNION ALL
                SELECT * FROM spring7_matrix_view
              `}
            ) m
            LEFT JOIN(
              SELECT * FROM rla_data7
              UNION ALL
              SELECT * FROM rla_data8
            ) r ON m.\`Local Id\` = r.LocalId
            LEFT JOIN previous_performance pp ON m.\`Local Id\` = pp.LocalId
            LEFT JOIN previous_performance pp2 ON r.LocalId = pp2.LocalId
            LEFT JOIN fall_performance fp_all ON m.\`Local Id\` = fp_all.LocalId
            LEFT JOIN spring_matrix_data sp_all ON m.\`Local Id\` = sp_all.\`Local Id\`
            WHERE ${whereClause.join(' AND ')}
            ORDER BY m.\`Last Name\`, m.\`First Name\`
            LIMIT 10
        )
        SELECT 
          *,
          ${version === 'fall' ? groupNumCalc : 'original_group_number'} as group_number
        FROM SearchSource
      `;

      const [students] = await connection.execute(query, params);
      await connection.release();
      return NextResponse.json({ students });
    }

    // Handle cell click case
    // Relaxed check: group_number might be 0 or undefined but we can still query based on levels
    else if (staar_level && benchmark_level) {
      if (version === 'fall') {
        const useRla = subject === 'rla';
        const fallBenchSql = getLevelSql('fp.Score', useRla ? rlaCurrentThresholds : mathCurrentThresholds, false);
        const fallStaarSql = getLevelSql('COALESCE(pp.Score, 0)', useRla ? rlaPreviousThresholds : mathPreviousThresholds, false);

        params = [staar_level, benchmark_level];

        query = `
          WITH Calculated AS (
            SELECT DISTINCT
              COALESCE(fp.FirstName, pp.FirstName) as 'First Name',
              COALESCE(fp.LastName, pp.LastName) as 'Last Name',
              'N/A' as Grade,
              'N/A' as Campus,
              fp.LocalId as local_id,
              'N/A' as Teacher,
              COALESCE(pp.Score, 0) as staar_score,
              ${fallStaarSql} as staar_level,
              fp.Score as benchmark_score,
              ${fallBenchSql} as benchmark_level
            FROM fall_performance fp
            LEFT JOIN previous_performance pp ON fp.LocalId = pp.LocalId
          )
          SELECT *,
            CASE 
                WHEN staar_level = 'Did Not Meet Low' AND benchmark_level = 'Did Not Meet Low' THEN 1
                WHEN staar_level = 'Did Not Meet Low' AND benchmark_level = 'Did Not Meet High' THEN 2
                WHEN staar_level = 'Did Not Meet Low' AND benchmark_level = 'Approaches Low' THEN 3
                WHEN staar_level = 'Did Not Meet Low' AND benchmark_level = 'Approaches High' THEN 4
                WHEN staar_level = 'Did Not Meet Low' AND benchmark_level = 'Meets' THEN 5
                WHEN staar_level = 'Did Not Meet Low' AND benchmark_level = 'Masters' THEN 6
                
                WHEN staar_level = 'Did Not Meet High' AND benchmark_level = 'Did Not Meet Low' THEN 7
                WHEN staar_level = 'Did Not Meet High' AND benchmark_level = 'Did Not Meet High' THEN 8
                WHEN staar_level = 'Did Not Meet High' AND benchmark_level = 'Approaches Low' THEN 9
                WHEN staar_level = 'Did Not Meet High' AND benchmark_level = 'Approaches High' THEN 10
                WHEN staar_level = 'Did Not Meet High' AND benchmark_level = 'Meets' THEN 11
                WHEN staar_level = 'Did Not Meet High' AND benchmark_level = 'Masters' THEN 12
                
                WHEN staar_level = 'Approaches Low' AND benchmark_level = 'Did Not Meet Low' THEN 13
                WHEN staar_level = 'Approaches Low' AND benchmark_level = 'Did Not Meet High' THEN 14
                WHEN staar_level = 'Approaches Low' AND benchmark_level = 'Approaches Low' THEN 15
                WHEN staar_level = 'Approaches Low' AND benchmark_level = 'Approaches High' THEN 16
                WHEN staar_level = 'Approaches Low' AND benchmark_level = 'Meets' THEN 17
                WHEN staar_level = 'Approaches Low' AND benchmark_level = 'Masters' THEN 18
                
                WHEN staar_level = 'Approaches High' AND benchmark_level = 'Did Not Meet Low' THEN 19
                WHEN staar_level = 'Approaches High' AND benchmark_level = 'Did Not Meet High' THEN 20
                WHEN staar_level = 'Approaches High' AND benchmark_level = 'Approaches Low' THEN 21
                WHEN staar_level = 'Approaches High' AND benchmark_level = 'Approaches High' THEN 22
                WHEN staar_level = 'Approaches High' AND benchmark_level = 'Meets' THEN 23
                WHEN staar_level = 'Approaches High' AND benchmark_level = 'Masters' THEN 24
                
                WHEN staar_level = 'Meets' AND benchmark_level = 'Did Not Meet Low' THEN 25
                WHEN staar_level = 'Meets' AND benchmark_level = 'Did Not Meet High' THEN 26
                WHEN staar_level = 'Meets' AND benchmark_level = 'Approaches Low' THEN 27
                WHEN staar_level = 'Meets' AND benchmark_level = 'Approaches High' THEN 28
                WHEN staar_level = 'Meets' AND benchmark_level = 'Meets' THEN 29
                WHEN staar_level = 'Meets' AND benchmark_level = 'Masters' THEN 30
                
                WHEN staar_level = 'Masters' AND benchmark_level = 'Did Not Meet Low' THEN 31
                WHEN staar_level = 'Masters' AND benchmark_level = 'Did Not Meet High' THEN 32
                WHEN staar_level = 'Masters' AND benchmark_level = 'Approaches Low' THEN 33
                WHEN staar_level = 'Masters' AND benchmark_level = 'Approaches High' THEN 34
                WHEN staar_level = 'Masters' AND benchmark_level = 'Meets' THEN 35
                WHEN staar_level = 'Masters' AND benchmark_level = 'Masters' THEN 36
                
                ELSE 0 
            END as group_number
          FROM Calculated
          WHERE staar_level = ?
            AND benchmark_level = ?
          -- AND (fp.Subject IS NULL OR fp.Subject = ?)
        `;
      } else if (!grade && subject === 'rla') {
        // Simple RLA case without grade
        query = `
           SELECT DISTINCT
            m.FirstName as 'First Name',
            m.LastName as 'Last Name',
            m.Grade,
            m.Campus,
            m.Benchmark_Score as benchmark_score,
            COALESCE(m.pp_score, m.STAAR_Score) as staar_score,
            m.LocalId as local_id,
            m.Teacher
          FROM (
             SELECT base.*, pp.Score as pp_score
             FROM (
                SELECT * FROM rla_data7
                UNION ALL
                SELECT * FROM rla_data8
             ) base
             LEFT JOIN previous_performance pp ON base.LocalId = pp.LocalId
          ) m
          WHERE ${rlaStaarSql} = ?
            AND ${rlaBenchSql} = ?
            AND Group_Number = ?
            ${teacher ? 'AND Teacher = ?' : ''}
        `;
        params = [staar_level, benchmark_level, group_number];
        if (teacher) params.push(teacher);
      } else {
        const whereClause = ['1=1'];
        params = [staar_level, benchmark_level, group_number];

        whereClause.push(`${mathStaarSql} = ?`);
        whereClause.push(`${mathBenchSql} = ?`);
        whereClause.push(`${mathGroupSql} = ?`);

        if (teacher) {
          whereClause.push('m.`Benchmark Teacher` = ?');
          params.push(teacher);
        }

        if (grade) {
          whereClause.push('m.Grade = ?');
          params.push(grade);
        }

        // Modified query to include both math and RLA data
        query = `
          SELECT DISTINCT
            m.\`First Name\`,
            m.\`Last Name\`,
            m.Grade,
            m.Campus,
            m.\`Local Id\` as local_id,
            m.\`Benchmark Teacher\` as Teacher,
            -- Math scores
            COALESCE(m.pp_score, m.\`STAAR MA07 Percent Score\`) as staar_score,
            ${mathStaarSql} as staar_level,
            m.\`Benchmark PercentScore\` as benchmark_score,
            ${mathBenchSql} as benchmark_level,
            ${mathGroupSql} as group_number,
            -- RLA scores
            COALESCE(r.pp_score, r.STAAR_Score) as rla_staar_score,
            ${joinedRlaStaarSql} as rla_staar_level,
            r.Benchmark_Score as rla_benchmark_score,
            ${joinedRlaBenchSql} as rla_benchmark_level,
            r.Group_Number as rla_group_number
          FROM (
            SELECT base.*, pp.Score as pp_score 
            FROM (
              SELECT * FROM spring_matrix_data
              ${version === 'spring' ? 'WHERE `Local Id` NOT IN (SELECT LocalID FROM spralg1)' : ''}
              UNION ALL
              SELECT * FROM spring7_matrix_view
            ) base
            LEFT JOIN previous_performance pp ON base.\`Local Id\` = pp.LocalId
          ) m
          LEFT JOIN (
            SELECT baseR.*, pp2.Score as pp_score
            FROM (
              SELECT * FROM rla_data7
              UNION ALL
              SELECT * FROM rla_data8
            ) baseR
            LEFT JOIN previous_performance pp2 ON baseR.LocalId = pp2.LocalId
          ) r ON m.\`Local Id\` = r.LocalId
          WHERE ${whereClause.join(' AND ')}
        `;
      }
    }

    const [students] = await connection.execute(query, params);

    await connection.release();

    return NextResponse.json({ students });

  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  } finally {
    if (connection) {
      try {
        await connection.release();
      } catch (err) {
        console.error('Error closing connection:', err);
      }
    }
  }
}

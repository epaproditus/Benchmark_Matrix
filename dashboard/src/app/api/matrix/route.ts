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

function getLevelSql(column: string, thresholds: { label: string, min: number, max: number }[]) {
    if (!thresholds || thresholds.length === 0) return `'Unknown'`;
    let sql = `(CASE `;
    for (const t of thresholds) {
        sql += `WHEN ${column} >= ${t.min} AND ${column} <= ${t.max} THEN '${t.label}' `;
    }
    sql += `ELSE 'Unknown' END)`;
    return sql;
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const teacher = searchParams.get('teacher');
    const grade = searchParams.get('grade');
    const version = searchParams.get('version') || 'spring';
    const subject = searchParams.get('subject') || 'math';

    const config = await getConfig();
    const mathThresholds = config?.thresholds?.math || [];
    const rlaThresholds = config?.thresholds?.rla || [];

    // Define dynamic columns
    // Math: 'STAAR MA07 Percent Score' (previous), 'Benchmark PercentScore' (current)
    // RLA: 'STAAR_Score' (previous), 'Benchmark_Score' (current)

    // Note: For simplicity in the complex UNION queries, we'll use these specific column names which match the Spring/Math 8 data. 
    // RLA tables use different names, handled in specific RLA blocks.

    const mathStaarSql = getLevelSql('`STAAR MA07 Percent Score`', mathThresholds);
    const mathBenchSql = getLevelSql('`Benchmark PercentScore`', mathThresholds);

    const rlaStaarSql = getLevelSql('STAAR_Score', rlaThresholds);
    const rlaBenchSql = getLevelSql('Benchmark_Score', rlaThresholds);

    try {
        const connection = await connectToDatabase();

        // Define staarQuery first based on parameters - Dynamic Logic
        const staarQuery = !grade
            ? subject === 'rla'
                ? `
            SELECT 
              ${rlaStaarSql} as level,
              COUNT(*) as total
            FROM (
              SELECT * FROM rla_data7
              UNION ALL
              SELECT * FROM rla_data8
            ) combined
            WHERE 1=1
            ${teacher ? 'AND Teacher = ?' : ''}
            GROUP BY level
          `
                : subject === 'campus'
                    ? `
            SELECT 
              staar_level as level,
              CAST(SUM(total) AS SIGNED) as total
            FROM (
              SELECT 
                ${mathStaarSql} as staar_level,
                COUNT(*) as total
              FROM (
                SELECT * FROM spring_matrix_data
                ${version === 'spring' ? 'WHERE `Local Id` NOT IN (SELECT LocalID FROM spralg1)' : ''}
                UNION ALL
                SELECT * FROM spring7_matrix_view
              ) math_combined
              GROUP BY staar_level
              
              UNION ALL
              
              SELECT 
                ${rlaStaarSql} as staar_level,
                COUNT(*) as total
              FROM (
                SELECT * FROM rla_data7
                UNION ALL
                SELECT * FROM rla_data8
              ) rla_combined
              GROUP BY staar_level
            ) combined
            GROUP BY staar_level
            -- Order by explicit list if possible, or leave unordered for now 
            -- (Sorting is usually handled by frontend based on config, but maintaining FIELD sort logic in SQL requires dynamic string too)
          `
                    : version === 'spring' || version === 'spring-algebra'
                        ? `
            SELECT 
              ${mathStaarSql} as level,
              COUNT(*) as total
            FROM (
              SELECT * FROM spring_matrix_data
              ${version === 'spring' ? 'WHERE `Local Id` NOT IN (SELECT LocalID FROM spralg1)' : ''}
              UNION ALL
              SELECT * FROM spring7_matrix_view
            ) combined
            WHERE 1=1
            ${teacher ? 'AND TRIM(`Benchmark Teacher`) = ?' : ''}
            GROUP BY level
          `
                        : `
           -- Fallback for 'fall' version or others if needed
            SELECT 
              ${mathStaarSql} as level,
              COUNT(*) as total
            FROM (
              SELECT * FROM data
              UNION ALL
              SELECT * FROM data7
            ) combined
            ${teacher ? 'WHERE `Benchmark Teacher` = ?' : ''}
            GROUP BY level
          `
            : subject === 'rla'
                ? `
          SELECT 
            ${rlaStaarSql} as level,
            COUNT(*) as total
          FROM ${grade === '7' ? 'rla_data7' : 'rla_data8'}
          WHERE 1=1
          ${teacher ? 'AND Teacher = ?' : ''}
          GROUP BY level
        `
                : `
          SELECT 
            ${mathStaarSql} as level,
            COUNT(*) as total
          FROM ${subject === 'math'
                    ? version === 'fall'
                        ? grade === '7'
                            ? 'data7'
                            : 'data'
                        : grade === '7'
                            ? 'spring7_matrix_view'
                            : 'spring_matrix_data'
                    : grade === '7'
                        ? 'rla_data7'
                        : 'rla_data8'
                }
          WHERE 1=1
          ${teacher ? 'AND `Benchmark Teacher` = ?' : ''}
          ${version === 'spring' ? 'AND `Local Id` NOT IN (SELECT LocalID FROM spralg1)' : ''}
          GROUP BY level
        `;

        let query = '';
        if (!grade) {
            // No grade filter - combine data from both grades
            if (subject === 'campus') {
                // Campus view combines both math and RLA data
                query = `
          WITH MathData AS (
            SELECT 
              ${mathStaarSql} as staar_level,
              ${mathBenchSql} as benchmark_level,
              COUNT(*) as student_count,
              \`Group #\` as group_number
            FROM (
              SELECT * FROM spring_matrix_data 
              ${version === 'spring' ? 'WHERE `Local Id` NOT IN (SELECT LocalID FROM spralg1)' : ''}
              UNION ALL
              SELECT * FROM spring7_matrix_view
            ) math_combined
            GROUP BY 
              staar_level,
              benchmark_level,
              \`Group #\`
          ),
          RLAData AS (
            SELECT 
              ${rlaStaarSql} as staar_level,
              ${rlaBenchSql} as benchmark_level,
              COUNT(*) as student_count,
              Group_Number as group_number
            FROM (
              SELECT * FROM rla_data7
              UNION ALL
              SELECT * FROM rla_data8
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
                await connection.end();
                return NextResponse.json({
                    matrixData: result,
                    staarTotals
                });
            } else if (subject === 'rla') {
                query = `
          SELECT 
            ${rlaStaarSql} as level,
            COUNT(*) as total
          FROM (
            SELECT * FROM rla_data7
            UNION ALL
            SELECT * FROM rla_data8
          ) combined
          WHERE 1=1
          ${teacher ? 'AND Teacher = ?' : ''}
          GROUP BY level
        `;
            } else {
                if (version === 'spring' || version === 'spring-algebra') {
                    query = `
            SELECT 
              ${mathStaarSql} as staar_level,
              ${mathBenchSql} as benchmark_level,
              COUNT(*) as student_count,
              \`Group #\` as group_number
            FROM (
              SELECT * FROM spring_matrix_data 
              ${version === 'spring' ? 'WHERE `Local Id` NOT IN (SELECT LocalID FROM spralg1)' : ''}
              UNION ALL
              SELECT * FROM spring7_matrix_view
            ) t1
            WHERE 1=1
            ${teacher ? 'AND `Benchmark Teacher` = ?' : ''} 
            GROUP BY staar_level, benchmark_level, \`Group #\`
          `;
                } else {
                    // Original logic for regular version
                    query = `
            SELECT 
              ${mathStaarSql} as staar_level,
              ${mathBenchSql} as benchmark_level,
              COUNT(*) as student_count,
              \`Group #\` as group_number
            FROM (
              SELECT * FROM data
              UNION ALL
              SELECT * FROM data7
            ) combined
            ${teacher ? 'WHERE `Benchmark Teacher` = ?' : ''}
            GROUP BY staar_level, benchmark_level, \`Group #\`
          `;
                }
            }
        } else {
            // Single grade filter
            if (subject === 'campus') {
                query = `
          WITH MathData AS (
            SELECT 
              ${mathStaarSql} as staar_level,
              ${mathBenchSql} as benchmark_level,
              COUNT(*) as student_count,
              \`Group #\` as group_number
            FROM ${grade === '7' ? 'spring7_matrix_view' : 'spring_matrix_data'}
            WHERE Grade = ?
            ${version === 'spring' ? 'AND `Local Id` NOT IN (SELECT LocalID FROM spralg1)' : ''}
            GROUP BY 
              staar_level,
              benchmark_level,
              \`Group #\`
          ),
          RLAData AS (
            SELECT 
              STAAR_Performance as staar_level,
              Benchmark_Performance as benchmark_level,
              COUNT(*) as student_count,
              Group_Number as group_number
            FROM ${grade === '7' ? 'rla_data7' : 'rla_data8'}
            GROUP BY 
              STAAR_Performance,
              Benchmark_Performance,
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

                if (teacher) {
                    const [result] = await connection.execute(query, [grade, teacher]);
                    const [staarTotals] = await connection.execute(staarQuery, [grade, teacher]);
                    await connection.end();
                    return NextResponse.json({
                        matrixData: result,
                        staarTotals
                    });
                } else {
                    const [result] = await connection.execute(query, [grade]);
                    const [staarTotals] = await connection.execute(staarQuery, [grade]);
                    await connection.end();
                    return NextResponse.json({
                        matrixData: result,
                        staarTotals
                    });
                }
            } else if (subject === 'rla') {
                const tableName = grade === '7' ? 'rla_data7' : 'rla_data8';
                query = `
          SELECT 
            STAAR_Performance as staar_level,
            Benchmark_Performance as benchmark_level,
            COUNT(*) as student_count,
            Group_Number as group_number
          FROM ${tableName}
          WHERE 1=1
          ${teacher ? 'AND Teacher = ?' : ''}
          GROUP BY STAAR_Performance, Benchmark_Performance, Group_Number
        `;
            } else {
                const tableName = subject === 'math' ?
                    (version === 'fall' ?
                        (grade === '7' ? 'data7' : 'data') :
                        (grade === '7' ? 'spring7_matrix_view' : 'spring_matrix_data')
                    ) :
                    (grade === '7' ? 'rla_data7' : 'rla_data8');

                query = `
          SELECT 
            ${mathStaarSql} as staar_level,
            ${mathBenchSql} as benchmark_level,
            COUNT(*) as student_count,
            \`Group #\` as group_number
          FROM ${tableName}
          WHERE 1=1
          ${teacher ? 'AND `Benchmark Teacher` = ?' : ''}
          ${version === 'spring' ? 'AND `Local Id` NOT IN (SELECT LocalID FROM spralg1)' : ''}
          GROUP BY staar_level, benchmark_level, \`Group #\`
        `;
            }
        }

        const [matrixData] = await connection.execute(
            query,
            teacher ? [teacher] : []
        );

        const [staarTotals] = await connection.execute(staarQuery, teacher ? [teacher] : []);

        await connection.end();

        return NextResponse.json({
            matrixData,
            staarTotals
        });

    } catch (error) {
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
            search  // Add search to destructuring
        } = await request.json();

        let params: DatabaseParams = []; // Define params at the top level
        let query = '';

        // Load config
        const config = await getConfig();
        const mathThresholds = config?.thresholds?.math || [];
        const rlaThresholds = config?.thresholds?.rla || [];

        const mathStaarSql = getLevelSql('`STAAR MA07 Percent Score`', mathThresholds);
        const mathBenchSql = getLevelSql('`Benchmark PercentScore`', mathThresholds);

        // RLA table column names are consistent: STAAR_Score, Benchmark_Score, but need aliasing if used in JOINs
        const rlaStaarSql = getLevelSql('r.STAAR_Score', rlaThresholds);
        const rlaBenchSql = getLevelSql('r.Benchmark_Score', rlaThresholds);

        console.log('POST request params:', {
            subject,
            staar_level,
            benchmark_level,
            group_number,
            teacher,
            grade,
            version,
            search
        });

        connection = await connectToDatabase();

        // Handle search case
        if (search) {
            const whereClause = [];
            params = [];

            // Add search condition first with correct table alias 'm'
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

            query = `
        SELECT DISTINCT
          m.\`First Name\`,
          m.\`Last Name\`,
          m.Grade,
          m.Campus,
          m.\`Local Id\` as local_id,
          m.\`Benchmark Teacher\` as Teacher,
          -- Math scores
          m.\`STAAR MA07 Percent Score\` as staar_score,
          m.\`2024 STAAR Performance\` as staar_level,
          m.\`Benchmark PercentScore\` as benchmark_score,
          m.\`2024-25 Benchmark Performance\` as benchmark_level,
          m.\`Group #\` as group_number,
          -- RLA scores
          r.STAAR_Score as rla_staar_score,
          r.STAAR_Performance as rla_staar_level,
          r.Benchmark_Score as rla_benchmark_score,
          r.Benchmark_Performance as rla_benchmark_level,
          r.Group_Number as rla_group_number
        FROM (
          ${version === 'fall' ? `
            SELECT * FROM data
            UNION ALL
            SELECT * FROM data7
          ` : `
            SELECT * FROM spring_matrix_data
            ${version === 'spring' ? 'WHERE `Local Id` NOT IN (SELECT LocalID FROM spralg1)' : ''}
            UNION ALL
            SELECT * FROM spring7_matrix_view
          `}
        ) m
        LEFT JOIN (
          SELECT * FROM rla_data7
          UNION ALL
          SELECT * FROM rla_data8
        ) r ON m.\`Local Id\` = r.LocalId
        WHERE ${whereClause.join(' AND ')}
        ORDER BY m.\`Last Name\`, m.\`First Name\`
        LIMIT 10
      `;

            const [students] = await connection.execute(query, params);
            await connection.end();
            return NextResponse.json({ students });
        }

        // Handle cell click case
        else if (staar_level && benchmark_level && group_number) {
            if (!grade && subject === 'rla') {
                query = `
          SELECT DISTINCT
            FirstName as 'First Name',
            LastName as 'Last Name',
            Grade,
            Campus,
            Benchmark_Score as benchmark_score,
            STAAR_Score as staar_score,
            LocalId as local_id,
            Teacher
          FROM (
            SELECT * FROM rla_data7
            UNION ALL
            SELECT * FROM rla_data8
          ) combined
          WHERE STAAR_Performance = ?
            AND Benchmark_Performance = ?
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
                whereClause.push('m.`Group #` = ?');

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
            m.\`STAAR MA07 Percent Score\` as staar_score,
            ${mathStaarSql} as staar_level,
            m.\`Benchmark PercentScore\` as benchmark_score,
            ${mathBenchSql} as benchmark_level,
            m.\`Group #\` as group_number,
            -- RLA scores
            r.STAAR_Score as rla_staar_score,
            ${rlaStaarSql} as rla_staar_level,
            r.Benchmark_Score as rla_benchmark_score,
            ${rlaBenchSql} as rla_benchmark_level,
            r.Group_Number as rla_group_number
          FROM (
            SELECT * FROM spring_matrix_data
            ${version === 'spring' ? 'WHERE `Local Id` NOT IN (SELECT LocalID FROM spralg1)' : ''}
            UNION ALL
            SELECT * FROM spring7_matrix_view
          ) m
          LEFT JOIN (
            SELECT * FROM rla_data7
            UNION ALL
            SELECT * FROM rla_data8
          ) r ON m.\`Local Id\` = r.LocalId
          WHERE ${whereClause.join(' AND ')}
        `;
            }
        }

        const [students] = await connection.execute(query, params);

        await connection.end();

        return NextResponse.json({ students });

    } catch (error) {
        console.error('Database error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    } finally {
        if (connection) {
            try {
                await connection.end();
            } catch (err) {
                console.error('Error closing connection:', err);
            }
        }
    }
}

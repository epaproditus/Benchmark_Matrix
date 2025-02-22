import { NextResponse } from 'next/server';
import { connectToDatabase } from '../../../lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const teacher = searchParams.get('teacher');
  const grade = searchParams.get('grade');
  const version = searchParams.get('version') || 'spring';
  const subject = searchParams.get('subject') || 'math';

  try {
    const connection = await connectToDatabase();
    
    let query = '';
    if (!grade) {
      // No grade filter - combine data from both grades
      if (subject === 'campus') {
        // Campus view combines both math and RLA data using MySQL compatible syntax
        query = `
          WITH MathData AS (
            SELECT 
              \`2024 STAAR Performance\` as staar_level,
              \`2024-25 Benchmark Performance\` as benchmark_level,
              COUNT(*) as student_count,
              \`Group #\` as group_number
            FROM (
              SELECT * FROM spring_matrix_data 
              ${version === 'spring' ? 'WHERE `Local Id` NOT IN (SELECT LocalID FROM spralg1)' : ''}
              UNION ALL
              SELECT * FROM spring7_matrix_view
            ) math_combined
            GROUP BY 
              \`2024 STAAR Performance\`,
              \`2024-25 Benchmark Performance\`,
              \`Group #\`
          ),
          RLAData AS (
            SELECT 
              STAAR_Performance as staar_level,
              Benchmark_Performance as benchmark_level,
              COUNT(*) as student_count,
              Group_Number as group_number
            FROM (
              SELECT * FROM rla_data7
              UNION ALL
              SELECT * FROM rla_data8
            ) rla_combined
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
      } else if (subject === 'rla') {
        query = `
          SELECT 
            STAAR_Performance as staar_level,
            Benchmark_Performance as benchmark_level,
            COUNT(*) as student_count,
            Group_Number as group_number
          FROM (
            SELECT * FROM rla_data7
            UNION ALL
            SELECT * FROM rla_data8
          ) combined
          WHERE 1=1
          ${teacher ? 'AND Teacher = ?' : ''}
          GROUP BY STAAR_Performance, Benchmark_Performance, Group_Number
        `;
      } else {
        if (version === 'spring' || version === 'spring-algebra') {
          query = `
            SELECT 
              \`2024 STAAR Performance\` as staar_level,
              \`2024-25 Benchmark Performance\` as benchmark_level,
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
            GROUP BY \`2024 STAAR Performance\`, \`2024-25 Benchmark Performance\`, \`Group #\`
          `;
        } else {
          // Original logic for regular version
          query = `
            SELECT 
              \`2024 STAAR Performance\` as staar_level,
              \`2024-25 Benchmark Performance\` as benchmark_level,
              COUNT(*) as student_count,
              \`Group #\` as group_number
            FROM (
              SELECT * FROM data
              UNION ALL
              SELECT * FROM data7
            ) combined
            ${teacher ? 'WHERE `Benchmark Teacher` = ?' : ''}
            GROUP BY \`2024 STAAR Performance\`, \`2024-25 Benchmark Performance\`, \`Group #\`
          `;
        }
      }
    } else {
      // Single grade filter
      if (subject === 'campus') {
        query = `
          SELECT 
            COALESCE(m.staar_level, r.staar_level) as staar_level,
            COALESCE(m.benchmark_level, r.benchmark_level) as benchmark_level,
            SUM(COALESCE(m.student_count, 0) + COALESCE(r.student_count, 0)) as student_count,
            COALESCE(m.group_number, r.group_number) as group_number
          FROM (
            -- Math query for single grade
            SELECT 
              \`2024 STAAR Performance\` as staar_level,
              \`2024-25 Benchmark Performance\` as benchmark_level,
              COUNT(*) as student_count,
              \`Group #\` as group_number
            FROM ${grade === '7' ? 'spring7_matrix_view' : 'spring_matrix_data'}
            WHERE Grade = ?
            ${version === 'spring' ? 'AND `Local Id` NOT IN (SELECT LocalID FROM spralg1)' : ''}
            ${teacher ? 'AND `Benchmark Teacher` = ?' : ''}
            GROUP BY \`2024 STAAR Performance\`, \`2024-25 Benchmark Performance\`, \`Group #\`
          ) m
          FULL OUTER JOIN (
            -- RLA query for single grade
            SELECT 
              STAAR_Performance as staar_level,
              Benchmark_Performance as benchmark_level,
              COUNT(*) as student_count,
              Group_Number as group_number
            FROM ${grade === '7' ? 'rla_data7' : 'rla_data8'}
            WHERE 1=1
            ${teacher ? 'AND Teacher = ?' : ''}
            GROUP BY STAAR_Performance, Benchmark_Performance, Group_Number
          ) r
          ON m.staar_level = r.staar_level 
          AND m.benchmark_level = r.benchmark_level
          AND m.group_number = r.group_number
          GROUP BY 
            COALESCE(m.staar_level, r.staar_level),
            COALESCE(m.benchmark_level, r.benchmark_level),
            COALESCE(m.group_number, r.group_number)
        `;
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
            \`2024 STAAR Performance\` as staar_level,
            \`2024-25 Benchmark Performance\` as benchmark_level,
            COUNT(*) as student_count,
            \`Group #\` as group_number
          FROM ${tableName}
          WHERE 1=1
          ${teacher ? 'AND `Benchmark Teacher` = ?' : ''}
          ${version === 'spring' ? 'AND `Local Id` NOT IN (SELECT LocalID FROM spralg1)' : ''}
          GROUP BY \`2024 STAAR Performance\`, \`2024-25 Benchmark Performance\`, \`Group #\`
        `;
      }
    }
    
    const [matrixData] = await connection.execute(
      query,
      teacher ? [teacher] : []
    );
    
    // Query to get total counts per STAAR level
    let staarQuery = '';
    if (!grade) {
      if (subject === 'rla') {
        staarQuery = `
          SELECT 
            STAAR_Performance as level,
            COUNT(*) as total
          FROM (
            SELECT * FROM rla_data7
            UNION ALL
            SELECT * FROM rla_data8
          ) combined
          WHERE 1=1
          ${teacher ? 'AND Teacher = ?' : ''}
          GROUP BY STAAR_Performance
        `;
      } else if (subject === 'campus') {
        staarQuery = `
          SELECT 
            staar_level as level,
            CAST(SUM(total) AS SIGNED) as total
          FROM (
            SELECT 
              \`2024 STAAR Performance\` as staar_level,
              COUNT(*) as total
            FROM (
              SELECT * FROM spring_matrix_data
              ${version === 'spring' ? 'WHERE `Local Id` NOT IN (SELECT LocalID FROM spralg1)' : ''}
              UNION ALL
              SELECT * FROM spring7_matrix_view
            ) math_combined
            GROUP BY \`2024 STAAR Performance\`
            
            UNION ALL
            
            SELECT 
              STAAR_Performance as staar_level,
              COUNT(*) as total
            FROM (
              SELECT * FROM rla_data7
              UNION ALL
              SELECT * FROM rla_data8
            ) rla_combined
            GROUP BY STAAR_Performance
          ) combined
          GROUP BY staar_level
          ORDER BY FIELD(staar_level, 'Did Not Meet Low', 'Did Not Meet High', 'Approaches Low', 'Approaches High', 'Meets', 'Masters')
        `;
      } else {
        if (version === 'spring' || version === 'spring-algebra') {
          staarQuery = `
            SELECT 
              \`2024 STAAR Performance\` as level,
              COUNT(*) as total
            FROM (
              SELECT * FROM spring_matrix_data
              ${version === 'spring' ? 'WHERE `Local Id` NOT IN (SELECT LocalID FROM spralg1)' : ''}
              UNION ALL
              SELECT * FROM spring7_matrix_view
            ) combined
            WHERE 1=1
            ${teacher ? 'AND TRIM(`Benchmark Teacher`) = ?' : ''}
            GROUP BY \`2024 STAAR Performance\`
          `;
        } else {
          staarQuery = `
            SELECT 
              \`2024 STAAR Performance\` as level,
              COUNT(*) as total
            FROM (
              SELECT * FROM data
              UNION ALL
              SELECT * FROM data7
            ) combined
            ${teacher ? 'WHERE `Benchmark Teacher` = ?' : ''}
            GROUP BY \`2024 STAAR Performance\`
          `;
        }
      }
    } else {
      if (subject === 'rla') {
        const tableName = grade === '7' ? 'rla_data7' : 'rla_data8';
        staarQuery = `
          SELECT 
            STAAR_Performance as level,
            COUNT(*) as total
          FROM ${tableName}
          WHERE 1=1
          ${teacher ? 'AND Teacher = ?' : ''}
          GROUP BY STAAR_Performance
        `;
      } else {
        const tableName = subject === 'math' ? 
          (version === 'fall' ? 
            (grade === '7' ? 'data7' : 'data') : 
            (grade === '7' ? 'spring7_matrix_view' : 'spring_matrix_data')
          ) : 
          (grade === '7' ? 'rla_data7' : 'rla_data8');

        staarQuery = `
          SELECT 
            \`2024 STAAR Performance\` as level,
            COUNT(*) as total
          FROM ${tableName}
          WHERE 1=1
          ${teacher ? 'AND `Benchmark Teacher` = ?' : ''}
          ${version === 'spring' ? 'AND `Local Id` NOT IN (SELECT LocalID FROM spralg1)' : ''}
          GROUP BY \`2024 STAAR Performance\`
        `;
      }
    }
    
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

    let params: any[] = []; // Define params at the top level
    let query = '';

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
      if (subject === 'rla') {
        const tableName = grade === '7' ? 'rla_data7' : 'rla_data8';
        const query = `
          SELECT 
            FirstName as 'First Name',
            LastName as 'Last Name',
            Grade,
            Benchmark_Score as benchmark_score,
            STAAR_Score as staar_score,
            LocalId as local_id,
            Teacher
          FROM ${tableName}
          WHERE STAAR_Performance = ?
            AND Benchmark_Performance = ?
            AND Group_Number = ?
            ${teacher ? 'AND Teacher = ?' : ''}
        `;
        const params = [staar_level, benchmark_level, group_number];
        if (teacher) params.push(teacher);
        
        const [students] = await connection.execute(query, params);
        await connection.end();
        return NextResponse.json({ students });
      } else {
        const whereClause = ['1=1'];
        params = [staar_level, benchmark_level, group_number];
        
        whereClause.push('`2024 STAAR Performance` = ?');
        whereClause.push('`2024-25 Benchmark Performance` = ?');
        whereClause.push('`Group #` = ?');

        if (teacher) {
          whereClause.push('`Benchmark Teacher` = ?');
          params.push(teacher);
        }
        
        if (grade) {
          whereClause.push('Grade = ?');
          params.push(grade);
        }

        const algebraFilter = version === 'spring' ? 
          'AND `Local Id` NOT IN (SELECT LocalID FROM spralg1)' : '';

        // Modified query to handle both 7th and 8th grade data
        if (!grade && (version === 'spring' || version === 'spring-algebra')) {
          query = `
            SELECT 
              \`First Name\`,
              \`Last Name\`,
              Grade,
              Campus,
              \`Benchmark PercentScore\` as benchmark_score,
              \`STAAR MA07 Percent Score\` as staar_score,
              \`Local Id\` as local_id,
              \`Benchmark Teacher\` as Teacher
            FROM (
              SELECT * FROM spring_matrix_data
              ${version === 'spring' ? 'WHERE `Local Id` NOT IN (SELECT LocalID FROM spralg1)' : ''}
              UNION ALL
              SELECT * FROM spring7_matrix_view
            ) combined
            WHERE ${whereClause.join(' AND ')}
          `;
        } else {
          query = `
            SELECT 
              \`First Name\`,
              \`Last Name\`,
              Grade,
              Campus,
              \`Benchmark PercentScore\` as benchmark_score,
              \`STAAR MA07 Percent Score\` as staar_score,
              \`Local Id\` as local_id,
              \`Benchmark Teacher\` as Teacher
            FROM ${tableName}
            WHERE ${whereClause.join(' AND ')}
            ${version === 'spring' ? algebraFilter : ''}
          `;
        }
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

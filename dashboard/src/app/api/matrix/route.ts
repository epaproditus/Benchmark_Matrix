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
      if (subject === 'rla') {
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
      if (subject === 'rla') {
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
      version = 'spring'
    } = await request.json();

    console.log('POST request params:', { subject, staar_level, benchmark_level, group_number, teacher, grade, version });
    
    connection = await connectToDatabase();

    if (staar_level && benchmark_level && group_number) {
      if (subject === 'rla') {
        console.log('Handling RLA cell click');
        const baseQuery = `
          SELECT 
            FirstName as 'First Name',
            LastName as 'Last Name',
            (CASE 
              WHEN source = 'rla_data7' THEN '7'
              WHEN source = 'rla_data8' THEN '8'
            END) as Grade,
            Benchmark_Score as benchmark_score,
            STAAR_Score as staar_score,
            LocalId as local_id,
            Teacher
          FROM (
            SELECT *, 'rla_data7' as source FROM rla_data7
            UNION ALL
            SELECT *, 'rla_data8' as source FROM rla_data8
          ) combined
          WHERE STAAR_Performance = ?
            AND Benchmark_Performance = ?
            AND Group_Number = ?
            ${grade ? 'AND source = ?' : ''}
            ${teacher ? 'AND Teacher = ?' : ''}
        `;

        const params = [staar_level, benchmark_level, group_number];
        if (grade) params.push(`rla_data${grade}`);
        if (teacher) params.push(teacher);

        const [students] = await connection.execute(baseQuery, params);
        await connection.end();
        return NextResponse.json({ students });
      }
      
      // ... rest of existing math handling code ...
    }

    if (search) {
      const whereClause = [];
      params = [];

      // Add filters
      if (version === 'spring') {
        whereClause.push('t1.`Local Id` NOT IN (SELECT LocalID FROM spralg1)');
      }
      if (teacher) {
        whereClause.push('t1.`Benchmark Teacher` = ?');
        params.push(teacher);
      }
      if (grade) {
        whereClause.push('t1.Grade = ?');
        params.push(grade);
      }

      // Add search condition
      whereClause.push('(t1.`First Name` LIKE ? OR t1.`Last Name` LIKE ? OR t1.`Local Id` LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);

      // Modified query to properly handle both 7th and 8th grade data in spring version
      if (version === 'spring' || version === 'spring-algebra') {
        const baseTable = grade === '7' ? 'spring7_matrix_view' : 'spring_matrix_data';
        query = `
          SELECT DISTINCT
            t1.\`First Name\`,
            t1.\`Last Name\`,
            t1.Grade,
            t1.Campus,
            t1.\`Local Id\` as local_id,
            t1.\`Benchmark Teacher\` as Teacher,
            t1.\`STAAR MA07 Percent Score\` as staar_score,
            t1.\`2024 STAAR Performance\` as staar_level,
            fall.\`Benchmark PercentScore\` as fall_benchmark_score,
            fall.\`2024-25 Benchmark Performance\` as fall_benchmark_level,
            fall.\`Group #\` as fall_group,
            t1.\`Benchmark PercentScore\` as spring_benchmark_score,
            t1.\`2024-25 Benchmark Performance\` as spring_benchmark_level,
            t1.\`Group #\` as spring_group
          FROM ${baseTable} t1
          LEFT JOIN data${grade === '7' ? '7' : ''} fall ON t1.\`Local Id\` = fall.\`Local Id\` 
            AND fall.Grade = t1.Grade
          WHERE ${whereClause.join(' AND ')}
          ORDER BY t1.\`Last Name\`, t1.\`First Name\`
          LIMIT 10
        `;
      } else {
        // Fall version query remains the same
        query = `
          SELECT DISTINCT
            t1.\`First Name\`,
            t1.\`Last Name\`,
            t1.Grade,
            t1.Campus,
            t1.\`Local Id\` as local_id,
            t1.\`Benchmark Teacher\` as Teacher,
            t1.\`STAAR MA07 Percent Score\` as staar_score,
            t1.\`2024 STAAR Performance\` as staar_level,
            t1.\`Benchmark PercentScore\` as fall_benchmark_score,
            t1.\`2024-25 Benchmark Performance\` as fall_benchmark_level,
            t1.\`Group #\` as fall_group,
            spring.\`Benchmark PercentScore\` as spring_benchmark_score,
            spring.\`2024-25 Benchmark Performance\` as spring_benchmark_level,
            spring.\`Group #\` as spring_group
          FROM ${tableName} t1
          LEFT JOIN ${grade === '7' ? 'spring7_matrix_view' : 'spring_matrix_data'} spring 
            ON t1.\`Local Id\` = spring.\`Local Id\`
            AND spring.Grade = t1.Grade
          WHERE ${whereClause.join(' AND ')}
          ORDER BY t1.\`Last Name\`, t1.\`First Name\`
          LIMIT 10
        `;
      }

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

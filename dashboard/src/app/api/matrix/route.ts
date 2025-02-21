import { NextResponse } from 'next/server';
import { connectToDatabase } from '../../../lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const teacher = searchParams.get('teacher');
  const grade = searchParams.get('grade');
  const version = searchParams.get('version') || 'spring';
  
  try {
    const connection = await connectToDatabase();
    
    // Fix table selection logic - always use spring_matrix_data for spring versions
    const tableName = version === 'fall' ? 
      (grade === '7' ? 'data7' : 'data') : 
      'spring_matrix_data';

    // For spring regular version, exclude algebra students
    // For spring-algebra version, don't apply any filter
    const algebraFilter = version === 'spring' ? 
      'AND `Local Id` NOT IN (SELECT LocalID FROM spralg1)' : '';

    let query = '';
    if (!grade) {
      if (version === 'spring' || version === 'spring-algebra') {
        query = `
          SELECT 
            \`2024 STAAR Performance\` as staar_level,
            \`2024-25 Benchmark Performance\` as benchmark_level,
            COUNT(*) as student_count,
            \`Group #\` as group_number
          FROM spring_matrix_data t1
          WHERE 1=1
          ${teacher ? 'AND `Benchmark Teacher` = ?' : ''} 
          ${version === 'spring' ? 
            'AND `Local Id` NOT IN (SELECT LocalID FROM spralg1)' : 
            version === 'spring-algebra' ? 
              'AND (`Local Id` IN (SELECT LocalID FROM spralg1) OR `Local Id` NOT IN (SELECT LocalID FROM spralg1))' : 
              ''}
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
    } else {
      query = `
        SELECT 
          \`2024 STAAR Performance\` as staar_level,
          \`2024-25 Benchmark Performance\` as benchmark_level,
          COUNT(*) as student_count,
          \`Group #\` as group_number
        FROM ${tableName}
        WHERE 1=1
        ${teacher ? 'AND `Benchmark Teacher` = ?' : ''}
        ${version === 'spring' ? algebraFilter : ''}
        GROUP BY \`2024 STAAR Performance\`, \`2024-25 Benchmark Performance\`, \`Group #\`
      `;
    }
    
    const [matrixData] = await connection.execute(
      query,
      teacher ? [teacher] : []
    );
    
    // Query to get total counts per STAAR level
    let staarQuery = '';
    if (!grade) {
      if (version === 'spring' || version === 'spring-algebra') {
        staarQuery = `
          SELECT 
            \`2024 STAAR Performance\` as level,
            COUNT(*) as total
          FROM spring_matrix_data
          WHERE 1=1
          ${teacher ? 'AND TRIM(`Benchmark Teacher`) = ?' : ''}
          ${version === 'spring' ? algebraFilter : ''}
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
    } else {
      staarQuery = `
        SELECT 
          \`2024 STAAR Performance\` as level,
          COUNT(*) as total
        FROM ${tableName}
        WHERE 1=1
        ${teacher ? 'AND `Benchmark Teacher` = ?' : ''}
        ${version === 'spring' ? algebraFilter : ''}
        GROUP BY \`2024 STAAR Performance\`
      `;
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
    const { search, teacher, grade, version = 'spring' } = await request.json();
    connection = await connectToDatabase();
    
    const tableName = version === 'fall' ? 
      (grade === '7' ? 'data7' : 'data') : 
      'spring_matrix_data';

    if (search) {
      const whereClause = [];
      const params = [];

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

      // Modified query to properly handle spring version
      const query = `
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
          spring.\`Benchmark PercentScore\` as spring_benchmark_score,
          spring.\`2024-25 Benchmark Performance\` as spring_benchmark_level,
          spring.\`Group #\` as spring_group
        FROM ${tableName} t1
        LEFT JOIN data fall ON t1.\`Local Id\` = fall.\`Local Id\` 
          AND fall.Grade = t1.Grade
        LEFT JOIN spring_matrix_data spring ON t1.\`Local Id\` = spring.\`Local Id\`
          AND spring.Grade = t1.Grade
        WHERE ${whereClause.join(' AND ')}
        ORDER BY t1.\`Last Name\`, t1.\`First Name\`
        LIMIT 10
      `.replace(/\s+/g, ' ').trim();

      const [students] = await connection.execute(query, params);
      await connection.end();
      return NextResponse.json({ students });
    }
    // Handle cell click case
    else if (staar_level && benchmark_level && group_number) {
      const whereClause = ['1=1'];
      
      whereClause.push('`2024 STAAR Performance` = ?');
      whereClause.push('`2024-25 Benchmark Performance` = ?');
      whereClause.push('`Group #` = ?');
      params = [staar_level, benchmark_level, group_number];

      if (teacher) {
        whereClause.push('`Benchmark Teacher` = ?');
        params.push(teacher);
      }
      
      // Add grade filter except for spring-algebra
      if (!(grade === '8' && version === 'spring-algebra') && grade) {
        whereClause.push('Grade = ?');
        params.push(grade);
      }
      const algebraFilter = version === 'spring' ? 
        'AND `Local Id` NOT IN (SELECT LocalID FROM spralg1)' : '';

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
        ${algebraFilter}
      `;
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

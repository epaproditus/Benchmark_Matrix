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
          FROM spring_matrix_data
          WHERE 1=1
          ${teacher ? 'AND `Benchmark Teacher` = ?' : ''} 
          ${version === 'spring' ? algebraFilter : ''}
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
  try {
    const { staar_level, benchmark_level, group_number, teacher, grade, search, version = 'regular' } = await request.json();
    const connection = await connectToDatabase();
    
    // Fix table selection logic - same as GET endpoint
    const tableName = version === 'fall' ? 
      (grade === '7' ? 'data7' : 'data') : 
      'spring_matrix_data';

    // Add algebra filter logic - same as GET endpoint
    const algebraFilter = version === 'spring' ? 
      'AND `Local Id` NOT IN (SELECT LocalID FROM spralg1)' : '';

    let query = '';
    let params: (string | number)[] = [];

    // Handle search case
    if (search) {
      const whereClause = [];
      if (teacher) {
        whereClause.push('`Benchmark Teacher` = ?');
        params.push(teacher);
      }
      if (grade) {
        whereClause.push('Grade = ?');
        params.push(grade);
      }

      // Add search conditions
      whereClause.push('(`First Name` LIKE ? OR `Last Name` LIKE ? OR `Local Id` LIKE ?)');
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern);

      if (!grade) {
        if (version === 'spring') {
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
            FROM spring_matrix_data
            ${whereClause.length > 0 ? 'WHERE ' + whereClause.join(' AND ') : ''}
            LIMIT 10
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
            FROM (
              SELECT * FROM data
              UNION ALL
              SELECT * FROM data7
            ) combined
            ${whereClause.length > 0 ? 'WHERE ' + whereClause.join(' AND ') : ''}
            LIMIT 10
          `;
        }
      } else {
        const tableName = grade === '7' ? 'data7' : 'data';
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
          ${whereClause.length > 0 ? 'WHERE ' + whereClause.join(' AND ') : ''}
          LIMIT 10
        `;
      }
    } 
    // Handle cell click case
    else if (staar_level && benchmark_level && group_number) {
      const whereClause = [
        '`2024 STAAR Performance` = ?',
        '`2024-25 Benchmark Performance` = ?',
        '`Group #` = ?'
      ];
      params = [staar_level, benchmark_level, group_number];

      if (teacher) {
        whereClause.push('`Benchmark Teacher` = ?');
        params.push(teacher);
      }
      if (grade) {
        whereClause.push('Grade = ?');
        params.push(grade);
      }

      // FIXED: Only apply algebra filter for spring version (not spring-algebra)
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
  }
}

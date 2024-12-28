import { NextResponse } from 'next/server';
import { connectToDatabase } from '../../../lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const teacher = searchParams.get('teacher');
  const grade = searchParams.get('grade');
  
  try {
    const connection = await connectToDatabase();
    
    // Query to get the transition matrix data
    let query = '';
    if (!grade) {
      // Combine data from both tables
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
    } else {
      // Query specific grade table
      const tableName = grade === '7' ? 'data7' : 'data';
      query = `
        SELECT 
          \`2024 STAAR Performance\` as staar_level,
          \`2024-25 Benchmark Performance\` as benchmark_level,
          COUNT(*) as student_count,
          \`Group #\` as group_number
        FROM ${tableName}
        ${teacher ? 'WHERE `Benchmark Teacher` = ?' : ''}
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
    } else {
      const tableName = grade === '7' ? 'data7' : 'data';
      staarQuery = `
        SELECT 
          \`2024 STAAR Performance\` as level,
          COUNT(*) as total
        FROM ${tableName}
        ${teacher ? 'WHERE `Benchmark Teacher` = ?' : ''}
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
    const { staar_level, benchmark_level, group_number, teacher, grade } = await request.json();
    const connection = await connectToDatabase();
    
    const whereClause = [
      '`2024 STAAR Performance` = ?',
      '`2024-25 Benchmark Performance` = ?',
      '`Group #` = ?'
    ];
    const params = [staar_level, benchmark_level, group_number];

    if (teacher) {
      whereClause.push('`Benchmark Teacher` = ?');
      params.push(teacher);
    }

    let query = '';
    if (!grade) {
      query = `
        SELECT 
          \`First Name\`,
          \`Last Name\`,
          Grade,
          Campus,
          \`Benchmark PercentScore\` as benchmark_score,
          \`STAAR MA07 Percent Score\` as staar_score,
          \`Benchmark Teacher\` as Teacher
        FROM (
          SELECT * FROM data
          UNION ALL
          SELECT * FROM data7
        ) combined
        WHERE ${whereClause.join(' AND ')}
      `;
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
          \`Benchmark Teacher\` as Teacher
        FROM ${tableName}
        WHERE ${whereClause.join(' AND ')}
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

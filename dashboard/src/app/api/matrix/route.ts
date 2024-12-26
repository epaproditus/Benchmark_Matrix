import { NextResponse } from 'next/server';
import { connectToDatabase } from '../../../lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const teacher = searchParams.get('teacher');
  
  try {
    const connection = await connectToDatabase();
    
    // Query to get the transition matrix data
    const query = `
      SELECT 
        \`2024 STAAR Performance\` as staar_level,
        \`2024-25 Benchmark Performance\` as benchmark_level,
        COUNT(*) as student_count,
        \`Group #\` as group_number
      FROM data
      ${teacher ? 'WHERE `Benchmark Teacher` = ?' : ''}
      GROUP BY \`2024 STAAR Performance\`, \`2024-25 Benchmark Performance\`, \`Group #\`
    `;
    
    const [matrixData] = await connection.execute(
      query,
      teacher ? [teacher] : []
    );

    const [teacherNames] = await connection.execute(`
      SELECT DISTINCT \`Benchmark Teacher\` FROM data;
    `);
    
    // Query to get total counts per STAAR level
    const [staarTotals] = await connection.execute(`
      SELECT 
        \`2024 STAAR Performance\` as level,
        COUNT(*) as total
      FROM data
      ${teacher ? 'WHERE `Benchmark Teacher` = ?' : ''}
      GROUP BY \`2024 STAAR Performance\`
    `, teacher ? [teacher] : []);

    await connection.end();
    
    return NextResponse.json({
      matrixData,
      staarTotals,
      teacherNames
    });

  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { staar_level, benchmark_level, group_number, teacher } = await request.json();
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

    const [students] = await connection.execute(`
      SELECT 
        \`First Name\`,
        \`Last Name\`,
        Grade,
        Campus,
        \`Benchmark PercentScore\` as benchmark_score,
        \`STAAR MA07 Percent Score\` as staar_score,
        \`Benchmark Teacher\` as Teacher
      FROM data
      WHERE ${whereClause.join(' AND ')}
    `, params);

    await connection.end();
    
    return NextResponse.json({ students });

  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';

export async function GET() {
  try {
    const connection = await connectToDatabase();
    
    // Query to get the transition matrix data
    const [matrixData] = await connection.execute(`
      SELECT 
        \`2024 STAAR Performance\` as staar_level,
        \`2024-25 Benchmark Performance\` as benchmark_level,
        COUNT(*) as student_count,
        \`Group #\` as group_number
      FROM data
      GROUP BY \`Combined Performance\`, \`Group #\`
    `);
    
    // Query to get total counts per STAAR level
    const [staarTotals] = await connection.execute(`
      SELECT 
        SUBSTRING_INDEX(\`Combined Performance\`, '|', 1) as level,
        COUNT(*) as total
      FROM data
      GROUP BY SUBSTRING_INDEX(\`Combined Performance\`, '|', 1)
    `);

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
    const { staar_level, benchmark_level, group_number } = await request.json();
    const connection = await connectToDatabase();
    
    const [students] = await connection.execute(`
      SELECT 
        \`First Name\`,
        \`Last Name\`,
        Grade,
        Campus,
        \`Benchmark PercentScore\` as benchmark_score,
        \`STAAR MA07 Percent Score\` as staar_score
      FROM data
      WHERE 
        \`Combined Performance\` = CONCAT(?, '|', ?)
        AND \`Group #\` = ?
    `, [staar_level, benchmark_level, group_number]);
    
    await connection.end();
    
    return NextResponse.json({ students });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

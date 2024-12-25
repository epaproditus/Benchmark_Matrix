import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';

export async function GET() {
  try {
    const connection = await connectToDatabase();
    
    // Query to get the transition matrix data
    const [matrixData] = await connection.execute(`
      SELECT 
        \`2024 STAAR Performance\` as prev_level,
        \`2024-25 Benchmark Performance\` as current_level,
        COUNT(*) as student_count,
        \`Group #\` as group_number,
        GROUP_CONCAT(CONCAT(
          \`First Name\`, ' ', \`Last Name\`, 
          ' (Grade: ', \`Grade\`, 
          ', Campus: ', \`Campus\`, ')'
        )) as student_names
      FROM data
      GROUP BY \`2024 STAAR Performance\`, \`2024-25 Benchmark Performance\`, \`Group #\`
    `);
    
    // Query to get total counts per STAAR level
    const [staarTotals] = await connection.execute(`
      SELECT 
        \`2024 STAAR Performance\` as level,
        COUNT(*) as total
      FROM data
      GROUP BY \`2024 STAAR Performance\`
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

// Add an endpoint to get student details for a specific cell
export async function POST(request: Request) {
  try {
    const { prev_level, current_level, group_number } = await request.json();
    const connection = await connectToDatabase();
    
    const [students] = await connection.execute(`
      SELECT 
        \`First Name\`,
        \`Last Name\`,
        \`Grade\`,
        \`Campus\`,
        \`Local MA.08.822.E PcntScore\` as benchmark_score,
        \`STAAR MA07 Percent Score\` as staar_score
      FROM data
      WHERE 
        \`2024 STAAR Performance\` = ? 
        AND \`2024-25 Benchmark Performance\` = ?
        AND \`Group #\` = ?
    `, [prev_level, current_level, group_number]);
    
    await connection.end();
    
    return NextResponse.json({ students });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
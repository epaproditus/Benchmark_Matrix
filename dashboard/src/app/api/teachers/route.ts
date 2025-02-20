import { NextResponse } from 'next/server';
import { connectToDatabase } from '../../../lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const grade = searchParams.get('grade');
  const version = searchParams.get('version') || 'regular';
  
  try {
    const connection = await connectToDatabase();

    const tables = version === 'spring' ? 
      { '7': 'spring_matrix_data', '8': 'spring_matrix_data' } : 
      { '7': 'data7', '8': 'data' };
    
    let query = '';
    if (!grade) {
      query = `
        SELECT DISTINCT \`Benchmark Teacher\` as teacher
        FROM (
          SELECT * FROM ${tables['8']}
          UNION ALL
          SELECT * FROM ${tables['7']}
        ) combined
        WHERE \`Benchmark Teacher\` IS NOT NULL 
        AND TRIM(\`Benchmark Teacher\`) != ''
        ORDER BY \`Benchmark Teacher\`
      `;
    } else {
      const tableName = tables[grade as '7' | '8'];
      query = `
        SELECT DISTINCT \`Benchmark Teacher\` as teacher
        FROM ${tableName}
        WHERE \`Benchmark Teacher\` IS NOT NULL
        AND TRIM(\`Benchmark Teacher\`) != ''
        ORDER BY \`Benchmark Teacher\`
      `;
    }

    const [teachers] = await connection.execute(query);
    await connection.end();

    return NextResponse.json({ teachers: teachers.map((t: any) => t.teacher) });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

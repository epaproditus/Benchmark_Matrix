import { NextResponse } from 'next/server';
import { connectToDatabase } from '../../../lib/db';
import { RowDataPacket } from 'mysql2';

interface TeacherRow extends RowDataPacket {
  'Benchmark Teacher': string;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const grade = searchParams.get('grade');
  
  try {
    const connection = await connectToDatabase();
    
    let query = '';
    if (!grade) {
      // If no grade specified, get teachers from both tables
      query = `
        SELECT DISTINCT \`Benchmark Teacher\` 
        FROM (
          SELECT \`Benchmark Teacher\` FROM data
          UNION
          SELECT \`Benchmark Teacher\` FROM data7
        ) combined
      `;
    } else {
      // Get teachers from specific grade table
      const tableName = grade === '7' ? 'data7' : 'data';
      query = `SELECT DISTINCT \`Benchmark Teacher\` FROM ${tableName}`;
    }
    
    const [rows] = await connection.execute<TeacherRow[]>(query);
    await connection.end();
    
    return NextResponse.json({ 
      teachers: rows.map(row => row['Benchmark Teacher']).sort()
    });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

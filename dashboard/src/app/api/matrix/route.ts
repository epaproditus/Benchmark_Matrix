import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';

export async function GET() {
  try {
    const connection = await connectToDatabase();
    
    // Modify this query based on your database schema
    const [rows] = await connection.execute(`
      SELECT 
        prev_level,
        current_level,
        COUNT(*) as student_count,
        GROUP_CONCAT(student_name) as student_names
      FROM student_transitions
      GROUP BY prev_level, current_level
    `);
    
    await connection.end();
    
    return NextResponse.json({ data: rows });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
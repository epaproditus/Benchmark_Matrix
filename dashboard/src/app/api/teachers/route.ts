import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';

export async function GET() {
  try {
    const connection = await connectToDatabase();
    
    const [rows] = await connection.execute<any[]>(`
      SELECT DISTINCT \`Benchmark Teacher\` FROM data;
    `);
    
    await connection.end();
    
    return NextResponse.json({ teachers: rows.map((row: any) => row['Benchmark Teacher']) });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
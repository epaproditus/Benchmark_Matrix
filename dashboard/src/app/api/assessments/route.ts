import { NextResponse } from 'next/server';
import { connectToDatabase } from '../../../lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const localId = searchParams.get('localId');

  if (!localId) {
    return NextResponse.json({ error: 'Local ID is required' }, { status: 400 });
  }

  try {
    const connection = await connectToDatabase();
    
  const [assessments] = await connection.execute(
    `SELECT 
      \`Local Id\`,
      local_id,
      assessment_name,
      score,
      DATE_FORMAT(date, '%Y-%m-%d') as date
    FROM student_assessments 
    WHERE local_id = ?
    ORDER BY date DESC`,
    [localId]
  );

    await connection.end();

    return NextResponse.json({ assessments });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Failed to fetch assessments' }, { status: 500 });
  }
}

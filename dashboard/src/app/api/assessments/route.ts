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

    // Check if table exists
    const [tables] = await connection.execute(
      `SELECT TABLE_NAME 
         FROM information_schema.TABLES 
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'student_assessments'`,
      [process.env.DB_NAME]
    );

    if (Array.isArray(tables) && tables.length === 0) {
      connection.release();
      return NextResponse.json({ assessments: [] });
    }

    const [assessments] = await connection.execute(
      `SELECT 
      LastName, FirstName, \`Local Id\`, Passed, Score, Points,
      Q1, Q2, Q3, Q4, Q5, Q6, Q7, Q8, Q9, Q10,
      Q11, Q12, Q13, Q14, Q15, Q16, Q17, Q18, Q19, Q20,
      Q21, Q22, Q23_1, Q23_2, Q24, Q25, Q26, Q27, Q28, Q29, Q30,
      Q31, Q32, Q33, Q34, Q35_1, Q35_2, Q35_3, Q36, Q37, Q38, Q39, Q40
    FROM student_assessments 
    WHERE \`Local Id\` = ?`,
      [localId]
    );

    connection.release();

    return NextResponse.json({ assessments });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Failed to fetch assessments', details: error }, { status: 500 });
  }
}

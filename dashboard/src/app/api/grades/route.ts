import { NextResponse } from 'next/server';
import { connectToDatabase } from '../../../lib/db';
import { Grade } from '../../../types/api';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const version = searchParams.get('version') || 'spring';

  try {
    const connection = await connectToDatabase();
    
    let query = '';
    if (version === 'fall') {
      query = `
        SELECT DISTINCT Grade 
        FROM (
          SELECT Grade FROM data7 WHERE Grade IS NOT NULL
          UNION
          SELECT Grade FROM data WHERE Grade IS NOT NULL
        ) grades
        ORDER BY Grade
      `;
    } else {
      query = `
        SELECT DISTINCT Grade 
        FROM (
          SELECT Grade FROM spring_matrix_data WHERE Grade IS NOT NULL
          UNION
          SELECT Grade FROM spring7_matrix_view WHERE Grade IS NOT NULL
        ) grades
        ORDER BY Grade
      `;
    }

    const [grades] = await connection.execute(query);
    await connection.end();

    return NextResponse.json({ 
      grades: (grades as Grade[]).map(g => g.Grade),
      hasData: {
        '7': (grades as Grade[]).some(g => g.Grade === '7'),
        '8': (grades as Grade[]).some(g => g.Grade === '8')
      }
    });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

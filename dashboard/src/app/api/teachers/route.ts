import { NextResponse } from 'next/server';
import { connectToDatabase } from '../../../lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const grade = searchParams.get('grade');
  const version = searchParams.get('version') || 'spring';
  
  try {
    const connection = await connectToDatabase();

    // Get available grades first
    let gradesQuery = '';
    if (version === 'fall') {
      gradesQuery = `
        SELECT DISTINCT Grade 
        FROM (
          SELECT Grade FROM data7 WHERE Grade IS NOT NULL
          UNION
          SELECT Grade FROM data WHERE Grade IS NOT NULL
        ) grades
        ORDER BY Grade
      `;
    } else {
      gradesQuery = `
        SELECT DISTINCT Grade 
        FROM spring_matrix_data 
        WHERE Grade IS NOT NULL
        ORDER BY Grade
      `;
    }
    
    const [grades] = await connection.execute(gradesQuery);
    const availableGrades = grades.map((g: any) => g.Grade);

    // Then get teachers based on available grades
    let query = '';
    const params = [];

    if (grade) {
      // If specific grade is selected
      if (!availableGrades.includes(grade)) {
        return NextResponse.json({ teachers: [], gradeHasData: false });
      }

      query = `
        SELECT DISTINCT \`Benchmark Teacher\` as teacher, Grade
        FROM ${version === 'fall' ? (grade === '7' ? 'data7' : 'data') : 'spring_matrix_data'}
        WHERE Grade = ?
        AND \`Benchmark Teacher\` IS NOT NULL 
        AND TRIM(\`Benchmark Teacher\`) != ''
        ${version === 'spring' ? 'AND `Local Id` NOT IN (SELECT LocalID FROM spralg1)' : ''}
        ORDER BY \`Benchmark Teacher\`
      `;
      params.push(grade);
    } else {
      // If no grade selected, only show teachers from available grades
      const gradeConditions = availableGrades.map(() => 'Grade = ?').join(' OR ');
      query = `
        SELECT DISTINCT \`Benchmark Teacher\` as teacher, Grade
        FROM ${version === 'spring' ? 'spring_matrix_data' : '(SELECT * FROM data UNION ALL SELECT * FROM data7) combined'}
        WHERE (${gradeConditions})
        AND \`Benchmark Teacher\` IS NOT NULL 
        AND TRIM(\`Benchmark Teacher\`) != ''
        ${version === 'spring' ? 'AND `Local Id` NOT IN (SELECT LocalID FROM spralg1)' : ''}
        ORDER BY Grade, \`Benchmark Teacher\`
      `;
      params.push(...availableGrades);
    }

    const [teachers] = await connection.execute(query, params);
    await connection.end();

    return NextResponse.json({ 
      teachers: teachers.map((t: any) => ({
        name: t.teacher,
        grade: t.Grade
      })),
      gradeHasData: true
    });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

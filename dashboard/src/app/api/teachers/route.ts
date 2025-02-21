import { NextResponse } from 'next/server';
import { connectToDatabase } from '../../../lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const grade = searchParams.get('grade');
  const version = searchParams.get('version') || 'spring';
  
  try {
    const connection = await connectToDatabase();

    // Modified gradesQuery to include spring7_matrix_view
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
        FROM (
          SELECT Grade FROM spring_matrix_data WHERE Grade IS NOT NULL
          UNION
          SELECT Grade FROM spring7_matrix_view WHERE Grade IS NOT NULL
        ) grades
        ORDER BY Grade
      `;
    }
    
    const [grades] = await connection.execute(gradesQuery);
    const availableGrades = grades.map((g: any) => g.Grade);

    let query = '';
    const params = [];

    if (grade) {
      if (version === 'spring' || version === 'spring-algebra') {
        const tableName = grade === '7' ? 'spring7_matrix_view' : 'spring_matrix_data';
        query = `
          SELECT DISTINCT \`Benchmark Teacher\` as teacher, Grade
          FROM ${tableName}
          WHERE Grade = ?
          AND \`Benchmark Teacher\` IS NOT NULL 
          AND TRIM(\`Benchmark Teacher\`) != ''
          ${version === 'spring' ? 'AND `Local Id` NOT IN (SELECT LocalID FROM spralg1)' : ''}
          ORDER BY \`Benchmark Teacher\`
        `;
      } else {
        query = `
          SELECT DISTINCT \`Benchmark Teacher\` as teacher, Grade
          FROM ${grade === '7' ? 'data7' : 'data'}
          WHERE Grade = ?
          AND \`Benchmark Teacher\` IS NOT NULL 
          AND TRIM(\`Benchmark Teacher\`) != ''
          ORDER BY \`Benchmark Teacher\`
        `;
      }
      params.push(grade);
    } else {
      // Modified query to include spring7_matrix_view when no grade is selected
      if (version === 'spring' || version === 'spring-algebra') {
        query = `
          SELECT DISTINCT \`Benchmark Teacher\` as teacher, Grade
          FROM (
            SELECT * FROM spring_matrix_data
            ${version === 'spring' ? 'WHERE `Local Id` NOT IN (SELECT LocalID FROM spralg1)' : ''}
            UNION ALL
            SELECT * FROM spring7_matrix_view
          ) combined
          WHERE Grade IN (${availableGrades.map(() => '?').join(',')})
          AND \`Benchmark Teacher\` IS NOT NULL 
          AND TRIM(\`Benchmark Teacher\`) != ''
          ORDER BY Grade, \`Benchmark Teacher\`
        `;
      } else {
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
      }
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

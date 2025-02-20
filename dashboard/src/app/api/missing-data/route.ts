import { NextResponse } from 'next/server';
import { connectToDatabase } from '../../../lib/db';

export async function GET(request: Request) {
  try {
    const connection = await connectToDatabase();

    // Students missing benchmark scores
    const missingBenchmarkQuery = `
      SELECT 
        \`First Name\`,
        \`Last Name\`,
        \`Local Id\`,
        Grade,
        \`STAAR MA07 Percent Score\` as staar_score,
        \`Benchmark PercentScore\` as benchmark_score,
        \`Benchmark Teacher\` as teacher
      FROM spring_matrix_data
      WHERE \`Benchmark PercentScore\` IS NULL 
      OR \`Benchmark PercentScore\` = 0
      ORDER BY \`Last Name\`, \`First Name\`
    `;

    // Students missing STAAR scores
    const missingStaarQuery = `
      SELECT 
        \`First Name\`,
        \`Last Name\`,
        \`Local Id\`,
        Grade,
        \`STAAR MA07 Percent Score\` as staar_score,
        \`Benchmark PercentScore\` as benchmark_score,
        \`Benchmark Teacher\` as teacher
      FROM spring_matrix_data
      WHERE \`STAAR MA07 Percent Score\` IS NULL 
      OR \`STAAR MA07 Percent Score\` = 0
      ORDER BY \`Last Name\`, \`First Name\`
    `;

    const [missingBenchmark] = await connection.execute(missingBenchmarkQuery);
    const [missingStaar] = await connection.execute(missingStaarQuery);

    await connection.end();

    return NextResponse.json({
      missingBenchmark,
      missingStaar
    });

  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// Allow updating scores
export async function POST(request: Request) {
  try {
    const { localId, benchmarkScore, staarScore } = await request.json();
    const connection = await connectToDatabase();

    // Fixed SQL query construction
    let updateFields = [];
    let params = [];

    if (benchmarkScore !== undefined) {
      updateFields.push('`Benchmark PercentScore` = ?');
      params.push(benchmarkScore);
    }
    if (staarScore !== undefined) {
      updateFields.push('`STAAR MA07 Percent Score` = ?');
      params.push(staarScore);
    }
    params.push(localId);

    const updateQuery = `
      UPDATE spring_matrix_data
      SET ${updateFields.join(', ')}
      WHERE \`Local Id\` = ?
    `;

    console.log('Update Query:', updateQuery, 'Params:', params); // Debug logging

    const [result] = await connection.execute(updateQuery, params);
    await connection.end();

    return NextResponse.json({ success: true, result });

  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

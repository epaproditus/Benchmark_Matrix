// In the POST handler, modify the cell click query:
if (staar_level && benchmark_level && group_number) {
  const subject = searchParams.get('subject') || 'math';
  
  if (!grade && subject === 'rla') {
    query = `
      SELECT 
        FirstName as 'First Name',
        LastName as 'Last Name',
        Grade,
        Campus,
        Benchmark_Score as benchmark_score,
        STAAR_Score as staar_score,
        LocalId as local_id,
        Teacher
      FROM (
        SELECT * FROM rla_data7
        UNION ALL
        SELECT * FROM rla_data8
      ) combined
      WHERE STAAR_Performance = ?
        AND Benchmark_Performance = ?
        AND Group_Number = ?
        ${teacher ? 'AND Teacher = ?' : ''}
    `;
  } else {
    // ... existing query logic ...
  }
}

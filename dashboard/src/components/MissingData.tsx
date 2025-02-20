'use client';
import { useState, useEffect } from 'react';

interface Student {
  'First Name': string;
  'Last Name': string;
  'Local Id': string;
  Grade: string;
  staar_score: number | null;
  benchmark_score: number | null;
  teacher: string;
}

export default function MissingData() {
  const [missingBenchmark, setMissingBenchmark] = useState<Student[]>([]);
  const [missingStaar, setMissingStaar] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [updateStatus, setUpdateStatus] = useState<{id: string, status: 'success' | 'error'} | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const response = await fetch('/api/missing-data');
    const data = await response.json();
    setMissingBenchmark(data.missingBenchmark);
    setMissingStaar(data.missingStaar);
    setLoading(false);
  };

  const updateScore = async (localId: string, benchmarkScore?: number, staarScore?: number) => {
    try {
      const response = await fetch('/api/missing-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          localId,
          benchmarkScore,
          staarScore
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setUpdateStatus({ id: localId, status: 'success' });
        await fetchData(); // Refresh the data
      } else {
        setUpdateStatus({ id: localId, status: 'error' });
      }
      
      // Clear status after 3 seconds
      setTimeout(() => setUpdateStatus(null), 3000);
    } catch (error) {
      console.error('Error updating score:', error);
      setUpdateStatus({ id: localId, status: 'error' });
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Missing Benchmark Scores ({missingBenchmark.length} students)</h2>
      <table className="w-full mb-8">
        <thead>
          <tr>
            <th>Name</th>
            <th>ID</th>
            <th>Grade</th>
            <th>Teacher</th>
            <th>STAAR Score</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {missingBenchmark.map((student) => (
            <tr key={student['Local Id']}>
              <td>{student['Last Name']}, {student['First Name']}</td>
              <td>{student['Local Id']}</td>
              <td>{student.Grade}</td>
              <td>{student.teacher}</td>
              <td>{student.staar_score}</td>
              <td>
                <input 
                  type="number"
                  placeholder="Benchmark Score"
                  className="border p-1 mr-2"
                  onBlur={(e) => {
                    const score = parseFloat(e.target.value);
                    if (score) updateScore(student['Local Id'], score);
                  }}
                />
                {updateStatus?.id === student['Local Id'] && (
                  <span className={updateStatus.status === 'success' ? 'text-green-600' : 'text-red-600'}>
                    {updateStatus.status === 'success' ? '✓ Saved' : '✗ Error'}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 className="text-xl font-bold mb-4">Missing STAAR Scores ({missingStaar.length} students)</h2>
      <table className="w-full">
        <thead>
          <tr>
            <th>Name</th>
            <th>ID</th>
            <th>Grade</th>
            <th>Teacher</th>
            <th>Benchmark Score</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {missingStaar.map((student) => (
            <tr key={student['Local Id']}>
              <td>{student['Last Name']}, {student['First Name']}</td>
              <td>{student['Local Id']}</td>
              <td>{student.Grade}</td>
              <td>{student.teacher}</td>
              <td>{student.benchmark_score}</td>
              <td>
                <input 
                  type="number"
                  placeholder="STAAR Score"
                  className="border p-1 mr-2"
                  onBlur={(e) => {
                    const score = parseFloat(e.target.value);
                    if (score) updateScore(student['Local Id'], undefined, score);
                  }}
                />
                {updateStatus?.id === student['Local Id'] && (
                  <span className={updateStatus.status === 'success' ? 'text-green-600' : 'text-red-600'}>
                    {updateStatus.status === 'success' ? '✓ Saved' : '✗ Error'}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

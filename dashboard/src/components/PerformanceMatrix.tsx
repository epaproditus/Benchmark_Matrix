'use client';
import { useState, useEffect } from 'react';

interface Student {
  'First Name': string;
  'Last Name': string;
  Grade: string;
  Campus: string;
  benchmark_score: number;
  staar_score: number;
}

interface CellData {
  staar_level: string;
  benchmark_level: string;
  student_count: number;
  group_number: number;
}

const PerformanceMatrix = () => {
  const [matrixData, setMatrixData] = useState<CellData[]>([]);
  const [staarTotals, setStaarTotals] = useState<{[key: string]: number}>({});
  const [selectedCell, setSelectedCell] = useState<CellData | null>(null);
  const [selectedStudents, setSelectedStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  const performanceLevels = [
    'Did Not Meet Low',
    'Did Not Meet High',
    'Approaches Low',
    'Approaches High',
    'Meets',
    'Masters'
  ];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const response = await fetch('/api/matrix');
      const data = await response.json();
      setMatrixData(data.matrixData);
      setStaarTotals(data.staarTotals.reduce((acc: any, curr: any) => {
        acc[curr.level] = curr.total;
        return acc;
      }, {}));
      setLoading(false);
    } catch (error) {
      console.error('Error fetching data:', error);
      setLoading(false);
    }
  };

  const fetchStudentDetails = async (cell: CellData) => {
    try {
      const response = await fetch('/api/matrix', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          staar_level: cell.staar_level,
          benchmark_level: cell.benchmark_level,
          group_number: cell.group_number
        }),
      });
      const data = await response.json();
      setSelectedStudents(data.students);
    } catch (error) {
      console.error('Error fetching student details:', error);
    }
  };

  const getCellData = (staarLevel: string, benchmarkLevel: string) => {
    return matrixData.find(d => 
      d.staar_level === staarLevel && 
      d.benchmark_level === benchmarkLevel
    ) || { staar_level: staarLevel, benchmark_level: benchmarkLevel, student_count: 0, group_number: 0 };
  };

  const getCellColor = (value: number): string => {
    if (value === 0) return 'bg-white';
    if (value < 5) return 'bg-red-100';
    if (value < 10) return 'bg-red-200';
    if (value < 20) return 'bg-blue-200';
    return 'bg-blue-300';
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="p-4">
      <div className="overflow-x-auto">
        <table className="border-collapse w-full">
          <thead>
            <tr>
              <th className="border p-2 bg-green-500 text-white" rowSpan={2}>
                2023 STAAR
              </th>
              <th className="border p-2 bg-yellow-300 text-center font-bold" colSpan={6}>
                2023-24 Local Assessment
              </th>
            </tr>
            <tr>
              {performanceLevels.map((level, index) => (
                <th key={index} className="border p-2 text-sm min-w-[100px]">
                  {level}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {performanceLevels.map((staarLevel, rowIndex) => (
              <tr key={rowIndex}>
                <td className="border p-2 font-medium min-w-[150px]">
                  <div>{staarLevel}</div>
                  <div className="text-sm text-gray-600">
                    {staarTotals[staarLevel] || 0}
                  </div>
                </td>
                {performanceLevels.map((benchmarkLevel, colIndex) => {
                  const cellData = getCellData(staarLevel, benchmarkLevel);
                  return (
                    <td
                      key={colIndex}
                      className={`border p-2 text-center cursor-pointer ${getCellColor(cellData.student_count)} hover:opacity-75`}
                      onClick={() => {
                        setSelectedCell(cellData);
                        fetchStudentDetails(cellData);
                      }}
                    >
                      <div className="font-bold">{cellData.student_count}</div>
                      <div className="text-xs text-gray-500">
                        {cellData.student_count > 0 ? `(Group ${cellData.group_number})` : ''}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedCell && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center" 
             onClick={() => setSelectedCell(null)}>
          <div className="bg-white p-4 rounded-lg max-w-2xl w-full mx-4" 
               onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-2">Student Transition Details</h3>
            <p><strong>From:</strong> {selectedCell.staar_level}</p>
            <p><strong>To:</strong> {selectedCell.benchmark_level}</p>
            <p><strong>Number of Students:</strong> {selectedCell.student_count}</p>
            <div className="mt-4 max-h-96 overflow-y-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="text-left p-2">Name</th>
                    <th className="text-left p-2">Grade</th>
                    <th className="text-left p-2">Campus</th>
                    <th className="text-right p-2">STAAR</th>
                    <th className="text-right p-2">Benchmark</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedStudents.map((student, index) => (
                    <tr key={index} className="border-t">
                      <td className="p-2">{`${student['First Name']} ${student['Last Name']}`}</td>
                      <td className="p-2">{student.Grade}</td>
                      <td className="p-2">{student.Campus}</td>
                      <td className="p-2 text-right">{student.staar_score}%</td>
                      <td className="p-2 text-right">{student.benchmark_score}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button 
              className="mt-4 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
              onClick={() => setSelectedCell(null)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PerformanceMatrix;
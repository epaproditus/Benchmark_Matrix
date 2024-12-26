'use client';
import { useState, useEffect, useMemo } from 'react';

interface Student {
  Teacher: string;
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
  const [teachers, setTeachers] = useState<string[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState<string | null>(null);

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
    fetchTeachers();
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

  const fetchTeachers = async () => {
    try {
      const response = await fetch('/api/teachers'); 
      const data = await response.json();
      setTeachers(data.teachers);
    } catch (error) {
      console.error('Error fetching teachers:', error);
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
      const filteredStudents = data.students.filter((student: Student) => 
        selectedTeacher ? student.Teacher === selectedTeacher : true
      );
      setSelectedStudents(filteredStudents);
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

  const getCellColor = (groupNumber: number, value: number): string => {
    if (value === 0) return 'bg-white';
    if ([36, 30, 24, 23, 18, 17, 16, 12, 11, 10, 9, 6, 5, 4, 3, 2].includes(groupNumber)) {
      return 'bg-red-200 text-red-800';
    }
    if ([29, 22, 15].includes(groupNumber)) {
      return 'bg-blue-200 text-blue-800';
    }
    return 'bg-green-200 text-green-800';
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="p-4">
      <div className="mb-4">
        <label htmlFor="teacher-select" className="mr-2">Filter by Teacher:</label>
        <select
          id="teacher-select"
          value={selectedTeacher || ''}
          onChange={(e) => setSelectedTeacher(e.target.value)}
        >
          <option value="">All Teachers</option>
          {teachers.map((teacher, index) => (
            <option key={index} value={teacher}>{teacher}</option>
          ))}
        </select>
      </div>
      <div className="overflow-x-auto">
        {selectedTeacher && (
          <div className="mb-4">
            <strong>Showing results for: {selectedTeacher}</strong>
          </div>
        )}
        <div className="mb-4">
          <button 
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            onClick={() => {
              const filteredStudents = selectedStudents.filter(student => 
                selectedTeacher ? student.Teacher === selectedTeacher : true
              );
              setSelectedStudents(filteredStudents);
            }}
          >
            Filter Results
          </button>
        </div>
        <table className="border-collapse w-full">
          <thead>
            <tr>
              <th className="border p-2 bg-green-500 text-white" rowSpan={2}>
                2024 STAAR
              </th>
              <th className="border p-2 bg-orange-300 text-center font-bold" colSpan={6}>
                Spring Benchmark
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
                      className={`border p-2 text-center cursor-pointer ${getCellColor(cellData.group_number, cellData.student_count)} hover:opacity-75`}
                      onClick={() => {
                        setSelectedCell(cellData);
                        fetchStudentDetails(cellData);
                      }}
                    >
                      <div className="font-bold">{cellData.student_count}</div>
                      <div className="text-xs text-white">
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

      <div className="mt-8 overflow-x-auto">
        <h2 className="text-xl font-bold mb-4">HB4545 Students</h2>
        <table className="border-collapse w-full">
          <thead>
            <tr>
              <th className="border p-2 bg-green-500 text-white" rowSpan={2}>
                2024 STAAR
              </th>
              <th className="border p-2 bg-orange-300 text-center font-bold" colSpan={6}>
                Spring Benchmark
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
            {performanceLevels.slice(0, 2).map((staarLevel, rowIndex) => (
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
                      className={`border p-2 text-center cursor-pointer ${getCellColor(cellData.group_number, cellData.student_count)} hover:opacity-75`}
                      onClick={() => {
                        setSelectedCell(cellData);
                        fetchStudentDetails(cellData);
                      }}
                    >
                      <div className="font-bold">{cellData.student_count}</div>
                      <div className="text-xs text-white">
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

      <div className="mt-8">
        <div className="grid grid-cols-2 gap-8">
          <div>
            <h2 className="text-xl font-bold mb-4">All Students Scoring</h2>
            <table className="border-collapse w-full">
              <thead>
                <tr>
                  <th className="border p-2">Category</th>
                  <th className="border p-2">Count</th>
                  <th className="border p-2">Multiplier</th>
                  <th className="border p-2">Points</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border p-2">Tests earning 0.0 points</td>
                  <td className="border p-2 text-center">
                    {matrixData.filter(d => [36, 30, 24, 23, 18, 17, 16, 12, 11, 10, 9, 6, 5, 4, 3, 2].includes(d.group_number))
                      .reduce((sum, d) => sum + d.student_count, 0)}
                  </td>
                  <td className="border p-2 text-center">0.0</td>
                  <td className="border p-2 text-center">0.0</td>
                </tr>
                <tr>
                  <td className="border p-2">Tests earning 0.5 points</td>
                  <td className="border p-2 text-center">
                    {matrixData.filter(d => [29, 22, 15].includes(d.group_number))
                      .reduce((sum, d) => sum + d.student_count, 0)}
                  </td>
                  <td className="border p-2 text-center">0.5</td>
                  <td className="border p-2 text-center">
                    {(matrixData.filter(d => [29, 22, 15].includes(d.group_number))
                      .reduce((sum, d) => sum + d.student_count, 0) * 0.5).toFixed(1)}
                  </td>
                </tr>
                <tr>
                  <td className="border p-2">Tests earning 1.0 points</td>
                  <td className="border p-2 text-center">
                    {matrixData.filter(d => [35, 34, 33, 32, 31, 28, 27, 26, 25, 21, 20, 19, 14, 13, 8, 7, 1].includes(d.group_number))
                      .reduce((sum, d) => sum + d.student_count, 0)}
                  </td>
                  <td className="border p-2 text-center">1.0</td>
                  <td className="border p-2 text-center">
                    {(matrixData.filter(d => [35, 34, 33, 32, 31, 28, 27, 26, 25, 21, 20, 19, 14, 13, 8, 7, 1].includes(d.group_number))
                      .reduce((sum, d) => sum + d.student_count, 0) * 1.0).toFixed(1)}
                  </td>
                </tr>
                <tr className="font-bold">
                  <td className="border p-2">Total</td>
                  <td className="border p-2 text-center">
                    {matrixData.reduce((sum, d) => sum + d.student_count, 0)}
                  </td>
                  <td className="border p-2 text-center">-</td>
                  <td className="border p-2 text-center">
                    {(
                      matrixData.filter(d => [29, 22, 15].includes(d.group_number))
                        .reduce((sum, d) => sum + d.student_count, 0) * 0.5 +
                      matrixData.filter(d => [35, 34, 33, 32, 31, 28, 27, 26, 25, 21, 20, 19, 14, 13, 8, 7, 1].includes(d.group_number))
                        .reduce((sum, d) => sum + d.student_count, 0) * 1.0
                    ).toFixed(1)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div>
            <h2 className="text-xl font-bold mb-4">HB4545 Students Scoring</h2>
            <table className="border-collapse w-full">
              <thead>
                <tr>
                  <th className="border p-2">Category</th>
                  <th className="border p-2">Count</th>
                  <th className="border p-2">Multiplier</th>
                  <th className="border p-2">Points</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border p-2">Tests earning 0.0 points</td>
                  <td className="border p-2 text-center">
                    {matrixData.filter(d => 
                      [36, 35, 30, 29].includes(d.group_number)
                    ).reduce((sum, d) => sum + d.student_count, 0)}
                  </td>
                  <td className="border p-2 text-center">0.0</td>
                  <td className="border p-2 text-center">0.0</td>
                </tr>
                <tr>
                  <td className="border p-2">Tests earning 0.25 points</td>
                  <td className="border p-2 text-center">
                    {matrixData.filter(d => 
                      [34, 33, 32, 31, 28, 27, 26, 25].includes(d.group_number)
                    ).reduce((sum, d) => sum + d.student_count, 0)}
                  </td>
                  <td className="border p-2 text-center">0.25</td>
                  <td className="border p-2 text-center">
                    {(matrixData.filter(d => 
                      [34, 33, 32, 31, 28, 27, 26, 25].includes(d.group_number)
                    ).reduce((sum, d) => sum + d.student_count, 0) * 0.25).toFixed(1)}
                  </td>
                </tr>
                <tr className="font-bold">
                  <td className="border p-2">Total</td>
                  <td className="border p-2 text-center">
                    {matrixData.filter(d => 
                      ['Did Not Meet Low', 'Did Not Meet High'].includes(d.staar_level)
                    ).reduce((sum, d) => sum + d.student_count, 0)}
                  </td>
                  <td className="border p-2 text-center">-</td>
                  <td className="border p-2 text-center">
                    {(
                      matrixData.filter(d => 
                        [34, 33, 32, 31, 28, 27, 26, 25].includes(d.group_number) &&
                        ['Did Not Meet Low', 'Did Not Meet High'].includes(d.staar_level)
                      ).reduce((sum, d) => sum + d.student_count, 0) * 0.25
                    ).toFixed(1)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PerformanceMatrix;

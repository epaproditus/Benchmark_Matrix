'use client';
import { useState, useEffect } from 'react';

interface Student {
  Teacher: string; // Add this line
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
    fetchTeachers(); // Fetch teachers when component mounts
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
    if ([36, 30, 24, 18, 12, 6, 5, 4, 3, 2, 11, 10, 9, 17, 16, 23].includes(groupNumber)) {
      return 'bg-red-200 text-red-800'; // Light red background with dark red text
    }
    if ([29, 22, 15].includes(groupNumber)) {
      return 'bg-blue-200 text-blue-800'; // Light blue background with dark blue text
    }
    return 'bg-green-200 text-green-800'; // Light green background with dark green text
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
              // Trigger filtering logic here
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

      {selectedCell && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center" 
             onClick={() => setSelectedCell(null)}>
          <div className="bg-gray-800 p-4 rounded-lg max-w-2xl w-full mx-4" 
               onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-2 text-white">Student Transition Details</h3>
            <p className="text-white"><strong>From:</strong> {selectedCell.staar_level}</p>
            <p className="text-white"><strong>To:</strong> {selectedCell.benchmark_level}</p>
            <p className="text-white"><strong>Number of Students:</strong> {selectedCell.student_count}</p>
            <div className="mt-4 max-h-96 overflow-y-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="text-left p-2 text-white">Name</th>
                    <th className="text-left p-2 text-white">Grade</th>
                    <th className="text-left p-2 text-white">Teacher</th>
                    <th className="text-right p-2 text-white">STAAR</th>
                    <th className="text-right p-2 text-white">Benchmark</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedStudents.map((student, index) => (
                    <tr key={index} className="border-t">
                      <td className="p-2">{`${student['First Name']} ${student['Last Name']}`}</td>
                      <td className="p-2">{student.Grade}</td>
                      <td className="p-2">{student.Teacher}</td>
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

'use client';
import { useState, useEffect } from 'react';

interface Student {
  id: number;
  local_id: string;
  Teacher: string; 
  'First Name': string;
  'Last Name': string;
  Grade: string;
  Campus: string;
  benchmark_score: number;
  staar_score: number;
  group_number: number;
}

interface Assessment {
  LastName: string;
  FirstName: string;
  'Local Id': number;
  Passed: string;
  Score: number;
  Points: number;
  [key: string]: string | number; // This allows for dynamic question fields (Q1, Q2, etc.)
}

interface CellData {
  staar_level: string;
  benchmark_level: string;
  student_count: number;
  group_number: number;
}

interface AnswerKey {
  [key: string]: {
    correct: string;
    standard: string;
  };
}

const answerKey: AnswerKey = {
  Q1: { correct: 'C', standard: '10D' },
  Q2: { correct: '', standard: '8C' },
  Q3: { correct: 'B', standard: '5D' },
  Q4: { correct: 'J', standard: '5I' },
  Q5: { correct: 'A', standard: '7C' },
  Q6: { correct: 'H', standard: '4B' },
  Q7: { correct: '', standard: '7A' },
  Q8: { correct: 'G', standard: '5G' },
  Q9: { correct: 'D', standard: '7B' },
  Q10: { correct: 'F', standard: '12G' },
  Q11: { correct: '', standard: '5H' },
  Q12: { correct: 'G', standard: '3C' },
  Q13: { correct: 'D', standard: '4C' },
  Q14: { correct: 'F', standard: '2D' },
  Q15: { correct: '', standard: '10C' },
  Q16: { correct: 'H', standard: '9A' },
  Q17: { correct: 'A', standard: '12D' },
  Q18: { correct: 'J', standard: '5F' },
  Q19: { correct: '', standard: '8D' },
  Q20: { correct: 'G', standard: '5A' },
  Q21: { correct: 'D', standard: '5D' },
  Q22: { correct: 'F', standard: '5G' },
  Q23: { correct: '', standard: '10A' },
  Q24: { correct: 'G', standard: '2C' },
  Q25: { correct: 'C', standard: '4C' },
  Q26: { correct: 'F', standard: '6C' },
  Q27: { correct: '', standard: '2D' },
  Q28: { correct: 'H', standard: '7B' },
  Q29: { correct: 'B', standard: '8C' },
  Q30: { correct: 'J', standard: '10C' },
  Q31: { correct: '', standard: '5I' },
  Q32: { correct: 'H', standard: '7C' },
  Q33: { correct: 'C', standard: '12D' },
  Q34: { correct: 'F', standard: '5B' },
  Q35: { correct: '', standard: '11A' },
  Q36: { correct: 'F', standard: '3C' },
  Q37: { correct: 'B', standard: '8B' },
  Q38: { correct: 'G', standard: '7A' },
  Q39: { correct: '', standard: '4B' },
  Q40: { correct: 'J', standard: '3A' },
};

interface TeacherData {
  name: string;
  grade: string;
}

const PerformanceMatrix = () => {
  const [matrixData, setMatrixData] = useState<CellData[]>([]);
  const [staarTotals, setStaarTotals] = useState<{[key: string]: number}>({});
  const [selectedCell, setSelectedCell] = useState<CellData | null>(null);
  const [selectedStudents, setSelectedStudents] = useState<Student[]>([]);
  const [studentAssessments, setStudentAssessments] = useState<{[key: string]: Assessment[]}>({});
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [showAssessments, setShowAssessments] = useState(false);
  const [searchResults, setSearchResults] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [teachers, setTeachers] = useState<TeacherData[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState<string | null>(null);
  const [selectedGrade, setSelectedGrade] = useState<string | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<'fall' | 'spring' | 'spring-algebra'>('spring');
  const [hasTeacherData, setHasTeacherData] = useState(true);
  const [selectedSubject, setSelectedSubject] = useState<'math' | 'rla'>('math');

  // Add new state for available grades
  const [availableGrades, setAvailableGrades] = useState<{
    grades: string[];
    hasData: { [key: string]: boolean };
  }>({ grades: [], hasData: {} });

  const performanceLevels = [
    'Did Not Meet Low',
    'Did Not Meet High',
    'Approaches Low',
    'Approaches High',
    'Meets',
    'Masters'
  ];

  useEffect(() => {
    fetchTeachers();
  }, [selectedGrade, selectedVersion, selectedSubject]);

  useEffect(() => {
    fetchData();
  }, [selectedTeacher, selectedGrade, selectedVersion, selectedSubject]);

  // Add useEffect to fetch grades when version changes
  useEffect(() => {
    fetchAvailableGrades();
  }, [selectedVersion]);

  // Update version options based on subject
  const getVersionOptions = () => {
    if (selectedSubject === 'rla') {
      return [
        { value: 'spring', label: 'Spring' }
      ];
    }
    return [
      { value: 'fall', label: 'Fall' },
      { value: 'spring', label: 'Spring' },
      { value: 'spring-algebra', label: 'Spring (with Algebra I)' }
    ];
  };

  // Reset version when changing subjects
  useEffect(() => {
    if (selectedSubject === 'rla') {
      setSelectedVersion('spring');
    }
  }, [selectedSubject]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const url = new URL('/api/matrix', window.location.origin);
      if (selectedTeacher) {
        url.searchParams.append('teacher', selectedTeacher);
      }
      if (selectedGrade) {
        url.searchParams.append('grade', selectedGrade);
      }
      // Add this line to send version parameter
      url.searchParams.append('version', selectedVersion);
      url.searchParams.append('subject', selectedSubject); // Add subject parameter

      const response = await fetch(url);
      const data = await response.json();
      setMatrixData(data.matrixData);
      setStaarTotals(data.staarTotals.reduce((acc: { [key: string]: number }, curr: { level: string; total: number }) => {
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
      const url = new URL('/api/teachers', window.location.origin);
      if (selectedGrade) {
        url.searchParams.append('grade', selectedGrade);
      }
      url.searchParams.append('version', selectedVersion);
      url.searchParams.append('subject', selectedSubject); // Add subject parameter
      
      const response = await fetch(url);
      const data = await response.json();
      
      setTeachers(data.teachers);
      setHasTeacherData(data.gradeHasData);
      
      // Reset teacher selection if no data available
      if (!data.gradeHasData) {
        setSelectedTeacher(null);
      }
    } catch (error) {
      console.error('Error fetching teachers:', error);
    }
  };

  // Add function to fetch grades
  const fetchAvailableGrades = async () => {
    try {
      const response = await fetch(`/api/grades?version=${selectedVersion}`);
      const data = await response.json();
      setAvailableGrades(data);
    } catch (error) {
      console.error('Error fetching grades:', error);
    }
  };

  const fetchStudentAssessments = async (localId: string) => {
    try {
      const assessmentResponse = await fetch(`/api/assessments?localId=${localId}`);
      const assessmentData = await assessmentResponse.json();
      setStudentAssessments(prev => ({
        ...prev,
        [localId]: assessmentData.assessments
      }));
      setSelectedStudentId(localId);
    } catch (error) {
      console.error('Error fetching student assessments:', error);
    }
  };

  const fetchStudentDetails = async (cell: CellData) => {
    try {
      console.log('Fetching students for:', {
        subject: selectedSubject,
        cell,
        teacher: selectedTeacher,
        grade: selectedGrade
      });

      const response = await fetch('/api/matrix', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          staar_level: cell.staar_level,
          benchmark_level: cell.benchmark_level,
          group_number: cell.group_number,
          teacher: selectedTeacher || undefined,
          grade: selectedGrade,
          version: selectedVersion,
          subject: selectedSubject  // Add subject to POST request
        }),
      });
      const data = await response.json();
      console.log('Received student data:', data.students);
      setSelectedStudents(data.students);
      
      // Fetch assessments for each student
      const assessments: {[key: string]: Assessment[]} = {};
      for (const student of data.students) {
        if (student.local_id) {
          const assessmentResponse = await fetch(`/api/assessments?localId=${student.local_id}`);
          const assessmentData = await assessmentResponse.json();
          assessments[student.local_id] = assessmentData.assessments;
        }
      }
      setStudentAssessments(assessments);
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
    
    if (selectedSubject === 'rla') {
      // Red cells - No Growth
      if ([2, 3, 4, 5, 6, 9, 10, 11, 12, 16, 17, 18, 23, 24, 30, 36].includes(groupNumber)) {
        return 'bg-red-200 text-red-800';
      }
      // Blue cells - Moderate Growth
      if ([15, 22, 29].includes(groupNumber)) {
        return 'bg-blue-200 text-blue-800';
      }
      // Green cells - Expected Growth
      return 'bg-green-200 text-green-800';
    } else {
      // Existing math color logic
      if ([36, 30, 24, 23, 18, 17, 16, 12, 11, 10, 9, 6, 5, 4, 3, 2].includes(groupNumber)) {
        return 'bg-red-200 text-red-800';
      }
      if ([29, 22, 15].includes(groupNumber)) {
        return 'bg-blue-200 text-blue-800';
      }
      return 'bg-green-200 text-green-800';
    }
  };

  const getGradeColor = (score: number): string => {
    if (score >= 80) return 'text-green-600';
    if (score >= 68) return 'text-blue-600';
    if (score >= 61) return 'text-purple-600';
    if (score >= 55) return 'text-red-600';
    return 'text-red-600';
  };

  const getGradeLabel = (score: number): string => {
    if (score >= 80) return 'A';
    if (score >= 68) return 'B';
    if (score >= 61) return 'C';
    if (score >= 55) return 'D';
    return 'F';
  };

  // Ensure we use the same total everywhere
  const calculateGrandTotal = () => {
    let total = 0;
    performanceLevels.forEach(staarLevel => {
      performanceLevels.forEach(benchmarkLevel => {
        const cellData = getCellData(staarLevel, benchmarkLevel);
        total += cellData.student_count;
      });
    });
    return total;
  };

  // Add helper function for points calculation
  const calculateTotalPoints = () => {
    if (selectedSubject === 'rla') {
      const pointsMap = {
        // Base points (1.0) - standard growth categories
        base: matrixData.filter(d => [1, 7, 8, 13, 14, 19, 20, 21, 25, 26, 27, 31, 32, 33, 34, 35].includes(d.group_number))
          .reduce((sum, d) => sum + d.student_count, 0) * 1.0,
          
        // Half points (0.5) - moderate growth categories
        half: matrixData.filter(d => [15, 22, 29].includes(d.group_number))
          .reduce((sum, d) => sum + d.student_count, 0) * 0.5,
          
        // Quarter points (0.25) - DNM students showing growth
        quarter: matrixData.filter(d => 
          [34, 33, 32, 31, 28, 27, 26, 25].includes(d.group_number) &&
          ['Did Not Meet Low', 'Did Not Meet High'].includes(d.staar_level)
        ).reduce((sum, d) => sum + d.student_count, 0) * 0.25
      };
      
      return pointsMap.base + pointsMap.half + pointsMap.quarter;
    } else {
      const pointsMap = {
        // Base points (1.0) - standard growth categories
        base: matrixData.filter(d => [35, 34, 33, 32, 31, 28, 27, 26, 25, 21, 20, 19, 14, 13, 8, 7, 1].includes(d.group_number))
          .reduce((sum, d) => sum + d.student_count, 0) * 1.0,
          
        // Half points (0.5) - moderate growth categories
        half: matrixData.filter(d => [29, 22, 15].includes(d.group_number))
          .reduce((sum, d) => sum + d.student_count, 0) * 0.5,
          
        // Quarter points (0.25) - DNM students showing some growth
        quarter: matrixData.filter(d => 
          [34, 33, 32, 31, 28, 27, 26, 25].includes(d.group_number) &&
          ['Did Not Meet Low', 'Did Not Meet High'].includes(d.staar_level)
        ).reduce((sum, d) => sum + d.student_count, 0) * 0.25
      };
      
      return pointsMap.base + pointsMap.half + pointsMap.quarter;
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="p-4">
      <div className="mb-4 bg-black text-white p-4 rounded">
        <div className="flex justify-between items-start">
          <div className="flex gap-4">
            <div>
              <label htmlFor="subject-select" className="mr-2">Subject:</label>
              <select
                id="subject-select"
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value as 'math' | 'rla')}
                className="bg-black text-white border border-white rounded px-2 py-1"
              >
                <option value="math">Mathematics</option>
                <option value="rla">Reading Language Arts</option>
              </select>
            </div>
            <div>
              <label htmlFor="version-select" className="mr-2">Assessment:</label>
              <select
                id="version-select"
                value={selectedVersion}
                onChange={(e) => setSelectedVersion(e.target.value as 'fall' | 'spring' | 'spring-algebra')}
                className="bg-black text-white border border-white rounded px-2 py-1"
              >
                {getVersionOptions().map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="grade-select" className="mr-2">Grade Level:</label>
              <select
                id="grade-select"
                value={selectedGrade || ''}
                onChange={(e) => {
                  const value = e.target.value;
                  setSelectedGrade(value || null);
                  setSelectedTeacher(null); // Reset teacher when grade changes
                }}
                className="bg-black text-white border border-white rounded px-2 py-1"
              >
                <option value="">All Grades</option>
                {['7', '8'].map((grade) => (
                  availableGrades.hasData[grade] ? (
                    <option key={grade} value={grade}>
                      {grade}th Grade
                    </option>
                  ) : (
                    <option key={grade} value={grade} disabled className="text-gray-500">
                      {grade}th Grade (No Data)
                    </option>
                  )
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="teacher-select" className="mr-2">Filter by Teacher:</label>
              <select
                id="teacher-select"
                value={selectedTeacher || ''}
                onChange={(e) => setSelectedTeacher(e.target.value)}
                className="bg-black text-white border border-white rounded px-2 py-1"
                disabled={!hasTeacherData}
              >
                <option value="">All Teachers</option>
                {teachers.map((teacher, index) => (
                  <option key={index} value={teacher.name}>
                    {teacher.name} ({teacher.grade}th)
                  </option>
                ))}
              </select>
              {!hasTeacherData && selectedGrade && (
                <div className="text-gray-500 text-sm mt-1">
                  No teacher data available for selected grade
                </div>
              )}
            </div>
          </div>
          <div className="text-right">
            <h3 className="font-bold mb-2">Academic Growth Score Scale:</h3>
            <div className="grid grid-cols-5 gap-4">
              <div className="text-green-600">A: 80+</div>
              <div className="text-blue-600">B: 68-79</div>
              <div className="text-purple-600">C: 61-67</div>
              <div className="text-red-600">D: 55-60</div>
              <div className="text-red-600">F: 55</div>
            </div>
          </div>
        </div>
      </div>

      {/* Search Functionality */}
      <div className="mb-4 space-y-4">
        <div>
          <label htmlFor="search" className="mr-2">Search by Name or ID:</label>
          <input
            type="text"
            id="search"
            placeholder="Enter name or ID"
            onChange={async (e) => {
              const searchTerm = e.target.value.toLowerCase();
              if (searchTerm.length < 2) {
                setSearchResults([]);
                return;
              }
              
              try {
                const response = await fetch('/api/matrix', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    search: searchTerm,
                    teacher: selectedTeacher || undefined,
                    grade: selectedGrade,
                    version: selectedVersion  // Add version to search params
                  }),
                });
                const data = await response.json();
                setSearchResults(data.students || []);
              } catch (error) {
                console.error('Error searching students:', error);
              }
            }}
            className="bg-black text-white border border-white rounded px-2 py-1"
          />
        </div>
        
        {/* Display filtered student as a line */}
        {searchResults.length > 0 && (
          <div className="bg-black text-white p-4 rounded border border-gray-700">
            <h4 className="font-bold mb-4">Matching Students ({searchResults.length})</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {searchResults.map((student, index) => {
                // Determine the color based on the spring group number
                const groupColor = student.spring_group ? 
                  getCellColor(student.spring_group, 1).replace('bg-', '') : 
                  'gray-900';

                return (
                  <div key={index} 
                    className={`bg-${groupColor} p-3 rounded shadow-md hover:opacity-90 transition-opacity`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-bold">{student['First Name']} {student['Last Name']}</div>
                        <div className="text-sm opacity-75">Grade {student.Grade} • {student.Teacher}</div>
                      </div>
                      {student.spring_group && (
                        <div className="text-xs font-bold">
                          Group {student.spring_group}
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div className="border-r border-opacity-20 border-white pr-2">
                        <div className="font-bold opacity-75 text-xs mb-1">
                          {student.Grade === '8' ? '7th' : '6th'} STAAR
                        </div>
                        <div>{student.staar_score || 'N/A'}</div>
                        <div className="text-xs">{student.staar_level || 'N/A'}</div>
                      </div>

                      <div className="border-r border-opacity-20 border-white px-2">
                        <div className="font-bold opacity-75 text-xs mb-1">Fall</div>
                        <div>{student.fall_benchmark_score || 'N/A'}</div>
                        <div className="text-xs">{student.fall_benchmark_level || 'N/A'}</div>
                      </div>

                      <div className="pl-2">
                        <div className="font-bold opacity-75 text-xs mb-1">Spring</div>
                        <div>{student.spring_benchmark_score || 'N/A'}</div>
                        <div className="text-xs">{student.spring_benchmark_level || 'N/A'}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {searchResults.length > 1 && (
          <div className="text-sm text-gray-600">
            Found {searchResults.length} matching students. Please refine your search.
          </div>
        )}
      </div>
      
      {/* New Section for Total Points Calculation */}
      <div className="mt-8">
        <h2 className="text-xl font-bold mb-4">Overall Points Calculation</h2>
        <div className="border p-4 bg-black text-white rounded">
          <p className="text-lg">
            Total Points: {calculateTotalPoints().toFixed(1)}
          </p>
          <p className="text-lg">
            Total Students: {calculateGrandTotal()}
          </p>
          <p className="text-lg font-bold">
            Academic Growth Score:{' '}
            {(() => {
              const totalStudents = calculateGrandTotal();
              const totalPoints = calculateTotalPoints();
              const score = Math.round((totalPoints / totalStudents) * 100);
              return (
                <span className={getGradeColor(score)}>
                  {score} ({getGradeLabel(score)})
                </span>
              );
            })()}
          </p>
        </div>
      </div>
      <div className="overflow-x-auto">
        {selectedTeacher && (
          <div className="mb-4">
            <strong>Showing results for: {selectedTeacher}</strong>
          </div>
        )}
        {selectedCell && selectedStudents.length > 0 && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-black text-white p-6 rounded-lg max-w-6xl w-full max-h-[80vh] overflow-y-auto relative">
              <button 
                onClick={() => {
                  setSelectedCell(null);
                  setSelectedStudents([]);
                }}
                className="absolute top-4 right-4 text-white hover:text-gray-300"
              >
                ✕
              </button>
            <h3 className="text-xl font-bold mb-4">
              Selected Students - {selectedCell.staar_level} STAAR / {selectedCell.benchmark_level} Benchmark
            </h3>
            <div className="overflow-x-auto">
              <div className="space-y-6">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="border border-white p-2">First Name</th>
                      <th className="border border-white p-2">Last Name</th>
                      <th className="border border-white p-2">Grade</th>
                      <th className="border border-white p-2">STAAR Score</th>
                      <th className="border border-white p-2">Benchmark Score</th>
                      <th className="border border-white p-2">Teacher</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedStudents.map((student, index) => (
                      <tr key={index} className="hover:bg-gray-800">
                        <td className="border border-white p-2">
                          <button 
                            onClick={() => {
                              fetchStudentAssessments(student.local_id);
                              setShowAssessments(true);
                            }}
                            className="text-blue-400 hover:text-blue-300 underline"
                          >
                            {student['First Name']}
                          </button>
                        </td>
                        <td className="border border-white p-2">{student['Last Name']}</td>
                        <td className="border border-white p-2">{student.Grade}</td>
                        <td className="border border-white p-2">{student.staar_score}</td>
                        <td className="border border-white p-2">{student.benchmark_score}</td>
                        <td className="border border-white p-2">{student.Teacher}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              </div>
            </div>
          </div>
        )}

        {/* Assessment Modal */}
        {showAssessments && selectedStudentId && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-black text-white p-6 rounded-lg max-w-4xl w-full max-h-[80vh] overflow-y-auto relative">
              <button 
                onClick={() => setShowAssessments(false)}
                className="absolute top-4 right-4 text-white hover:text-gray-300"
              >
                ✕
              </button>
              {selectedStudents.map((student) => {
                if (student.local_id !== selectedStudentId) return null;
                const assessments = studentAssessments[student.local_id] || [];

                return (
                  <div key={student.local_id}>
                    <h3 className="text-xl font-bold mb-4">
                      {student['First Name']} {student['Last Name']}&apos;s Assessment History
                    </h3>
                    {assessments.length > 0 ? (
                      <div>
                        <table className="w-full mb-4">
                          <thead>
                            <tr>
                              <th className="border border-white p-2">Score</th>
                              <th className="border border-white p-2">Points</th>
                              <th className="border border-white p-2">Passed</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="hover:bg-gray-800">
                              <td className="border border-white p-2">{assessments[0].Score}</td>
                              <td className="border border-white p-2">{assessments[0].Points}</td>
                              <td className="border border-white p-2">{assessments[0].Passed}</td>
                            </tr>
                          </tbody>
                        </table>
                        <h4 className="text-lg font-bold mb-2">Question Answers:</h4>
                        <div className="grid grid-cols-5 gap-2">
                          {Object.entries(assessments[0])
                            .filter(([key]) => key.startsWith('Q'))
                            .map(([key, value]) => {
                              const answer = value as string;
                              const correctAnswer = answerKey[key]?.correct;
                              const standard = answerKey[key]?.standard;
                              let bgColor = 'bg-yellow-200'; // Default color for unanswered
                              if (correctAnswer !== '') {
                                bgColor = answer === correctAnswer ? 'bg-green-200' : 'bg-red-200';
                              }
                              return (
                                <div key={key} className={`border border-white p-2 ${bgColor}`}>
                                  <span className="font-bold">{key} ({standard}):</span> {answer}
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    ) : (
                      <p>No assessment records found for this student.</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        <table className="border-collapse w-full">
          <thead>
            <tr>
              <th className="border p-2 bg-green-500 text-white" rowSpan={2}>
                2024 STAAR
              </th>
              <th className="border p-2 bg-orange-300 text-center font-bold" colSpan={7}>
                Spring Benchmark
              </th>
            </tr>
            <tr>
              {performanceLevels.map((level, index) => (
                <th key={index} className="border p-2 text-sm min-w-[100px]">
                  {level}
                </th>
              ))}
              <th className="border p-2 text-sm min-w-[100px] bg-black text-white">Row Total</th>
            </tr>
          </thead>
          <tbody>
            {performanceLevels.map((staarLevel, rowIndex) => {
              const rowTotal = performanceLevels.reduce((sum, benchmarkLevel) => {
                const cellData = getCellData(staarLevel, benchmarkLevel);
                return sum + cellData.student_count;
              }, 0);
              
              return (
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
                  <td className="border p-2 text-center font-bold bg-black text-white">{rowTotal}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="font-bold">
              <td className="border p-2 bg-black text-white">Column Total</td>
              {performanceLevels.map((_, colIndex) => {
                const colTotal = performanceLevels.reduce((sum, staarLevel) => {
                  const cellData = getCellData(staarLevel, performanceLevels[colIndex]);
                  return sum + cellData.student_count;
                }, 0);
                return (
                  <td key={colIndex} className="border p-2 text-center bg-black text-white">
                    {colTotal}
                  </td>
                );
              })}
              <td className="border p-2 text-center bg-black text-white">
                {calculateGrandTotal()}
              </td>
            </tr>
          </tfoot>
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
                      [36, 35, 30, 29].includes(d.group_number) &&
                      ['Did Not Meet Low', 'Did Not Meet High'].includes(d.staar_level)
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
};

export default PerformanceMatrix;

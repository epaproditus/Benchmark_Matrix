'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTamboContextHelpers } from '@tambo-ai/react';
import { UnifiedStudentScoresTable } from './UnifiedStudentScoresTable';
import { db, DEFAULT_THRESHOLDS } from '@/lib/db';
import { useLiveQuery } from 'dexie-react-hooks';

import { Student } from '@/lib/db';

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

interface Threshold {
  label: string;
  min: number;
  max: number;
  color?: string;
}

interface Config {
  labels: {
    xAxis: string;
    yAxis: string;
  };
  thresholds: {
    math: {
      previous: Threshold[];
      current: Threshold[];
    };
    rla: {
      previous: Threshold[];
      current: Threshold[];
    };
  };
}

const PerformanceMatrix = () => {
  /* Live Data from IndexedDB */
  const students = useLiveQuery(() => db.students.toArray()) || [];
  const settings = useLiveQuery(() => db.settings.toArray()) || [];

  const [loading, setLoading] = useState(false); // Kept for UI compat, but live query is instant-ish
  const [selectedCell, setSelectedCell] = useState<CellData | null>(null);
  const [selectedStudents, setSelectedStudents] = useState<Student[]>([]);
  // Assessments not implemented in minimal local db yet
  const [studentAssessments, setStudentAssessments] = useState<{ [key: string]: Assessment[] }>({});
  const [showAssessments, setShowAssessments] = useState(false);
  const [searchResults, setSearchResults] = useState<Student[]>([]);

  const [selectedTeacher, setSelectedTeacher] = useState<string | null>(null);
  const [selectedGrade, setSelectedGrade] = useState<string | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<'fall' | 'spring' | 'spring-algebra'>('spring-algebra');
  const [selectedSubject, setSelectedSubject] = useState<'math' | 'rla' | 'campus'>('math');

  // Derive Teachers and Grades from students
  const { teachers, availableGrades, hasTeacherData } = useMemo(() => {
    if (!students.length) return { teachers: [], availableGrades: { grades: [], hasData: {} }, hasTeacherData: false };

    // Filter by subject/version roughly if needed, but usually we list all
    const distinctGrades = Array.from(new Set(students.map(s => s.Grade))).sort();
    const distinctTeachers = Array.from(new Set(students.map(s => s.Teacher))).filter(Boolean).sort().map(t => ({ name: t, grade: '' }));

    return {
      teachers: distinctTeachers,
      availableGrades: { grades: distinctGrades, hasData: {} },
      hasTeacherData: distinctTeachers.length > 0
    };
  }, [students]);

  // Computed config from DB or defaults
  const config = useMemo(() => {
    const labels = settings.find(s => s.id === 'labels')?.value || { xAxis: 'Current Benchmark', yAxis: 'Previous Performance' };
    const thresholds = settings.find(s => s.id === 'thresholds')?.value || DEFAULT_THRESHOLDS;
    return { labels, thresholds };
  }, [settings]);

  const { addContextHelper, removeContextHelper } = useTamboContextHelpers();

  // Helper to get level from score and thresholds
  const getLevel = useCallback((score: number | null | undefined, thresholds: Threshold[]): string => {
    if (score === null || score === undefined) return 'N/A';
    for (const threshold of thresholds) {
      if (score >= threshold.min && score <= threshold.max) {
        return threshold.label;
      }
    }
    return 'N/A';
  }, []);

  const subjectConfig = useMemo(() => {
    const subj = (selectedSubject === 'rla' ? 'rla' : 'math') as 'math' | 'rla';
    const thresholds = config.thresholds as any;
    return thresholds[subj] || (DEFAULT_THRESHOLDS as any)[subj];
  }, [config, selectedSubject]);

  const finalPreviousLevels = useMemo(() => {
    // Y-Axis: Low to High (Top to Bottom) to match X-Axis
    const sorted = [...(subjectConfig?.previous || [])].sort((a: Threshold, b: Threshold) => a.min - b.min);
    return sorted.length > 0 ? sorted.map((t: Threshold) => t.label) : ['Masters', 'Meets', 'Approaches', 'Did Not Meet'];
  }, [subjectConfig]);

  const finalCurrentLevels = useMemo(() => {
    // X-Axis: Low to High (Left to Right)
    const sorted = [...(subjectConfig?.current || [])].sort((a: Threshold, b: Threshold) => a.min - b.min);
    return sorted.length > 0 ? sorted.map((t: Threshold) => t.label) : ['Did Not Meet', 'Approaches', 'Meets', 'Masters'];
  }, [subjectConfig]);

  // Helper to get group number based on levels
  const getGroupNumber = useCallback((staarLevel: string, benchmarkLevel: string): number => {
    const staarIdx = finalPreviousLevels.indexOf(staarLevel);
    const benchmarkIdx = finalCurrentLevels.indexOf(benchmarkLevel);
    if (staarIdx === -1 || benchmarkIdx === -1) return 0;
    // Map to group number 1-16 (4x4)
    // Row major order
    return (staarIdx * finalCurrentLevels.length) + benchmarkIdx + 1;
  }, [finalPreviousLevels, finalCurrentLevels]);

  // Matrix Data calculation
  const matrixData = useMemo(() => {
    if (!students.length) return [];

    // 1. Filter
    const filtered = students.filter(s => {
      if (selectedGrade && s.Grade !== selectedGrade) return false;
      if (selectedTeacher && s.Teacher !== selectedTeacher) return false;
      return true;
    });

    // 2. Aggregate
    const counts: Record<string, CellData> = {};

    // Initialize all cells to 0
    finalPreviousLevels.forEach(prev => {
      finalCurrentLevels.forEach(curr => {
        const key = `${prev}-${curr}`;
        counts[key] = {
          staar_level: prev,
          benchmark_level: curr,
          student_count: 0,
          group_number: getGroupNumber(prev, curr)
        };
      });
    });

    filtered.forEach(s => {
      let prevScore: number | null | undefined = s.StaarScore;
      let currScore: number | null | undefined = selectedVersion === 'fall' ? s.FallScore : s.SpringScore;

      // Logic to determine levels dynamically
      const prevLevel = getLevel(prevScore, subjectConfig.previous);
      const currLevel = getLevel(currScore, subjectConfig.current);

      const key = `${prevLevel}-${currLevel}`;
      if (counts[key]) {
        counts[key].student_count++;
      }
    });

    return Object.values(counts);

  }, [students, selectedGrade, selectedTeacher, selectedVersion, selectedSubject, subjectConfig, finalPreviousLevels, finalCurrentLevels, getLevel, getGroupNumber]);

  // Calculate STAAR Totals
  const staarTotals = useMemo(() => {
    if (!matrixData.length) return {};
    const totals: Record<string, number> = {};
    matrixData.forEach(cell => {
      totals[cell.staar_level] = (totals[cell.staar_level] || 0) + cell.student_count;
    });
    return totals;
  }, [matrixData]);


  // Removed fetchTeachers and fetchAvailableGrades

  useEffect(() => {
    const handleAction = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.action === 'refresh') {
        // useLiveQuery handles refresh automatically
        return;
      }
      if (customEvent.detail?.component === 'PerformanceMatrix') {
        const config = customEvent.detail.config;
        if (config.subject) setSelectedSubject(config.subject);
        if (config.version) setSelectedVersion(config.version);
        if (config.grade) {
          setSelectedGrade(config.grade === 'all' ? null : config.grade);
          setSelectedTeacher(null);
        }
        if (config.teacher) setSelectedTeacher(config.teacher === 'all' ? null : config.teacher);
      }
    };
    window.addEventListener('tambo-action', handleAction);
    return () => window.removeEventListener('tambo-action', handleAction);
  }, []);

  useEffect(() => {
    addContextHelper("dashboardFilters", () => ({
      key: "dashboard-filters",
      value: JSON.stringify({
        subject: selectedSubject,
        version: selectedVersion,
        grade: selectedGrade || 'all',
        teacher: selectedTeacher || 'all'
      })
    }));
    return () => removeContextHelper("dashboardFilters");
  }, [selectedSubject, selectedVersion, selectedGrade, selectedTeacher, addContextHelper, removeContextHelper]);

  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Config is derived in useMemo above, removing duplicate state

  // Duplicate logic removed

  const xAxisLabel = config?.labels?.xAxis || 'Current Benchmark';
  const yAxisLabel = config?.labels?.yAxis || 'Previous Performance';

  // Reset version when changing subjects
  useEffect(() => {
    if (selectedSubject === 'rla') {
      setSelectedVersion('spring');
    }
  }, [selectedSubject]);

  // Assessments not implemented in minimal version

  const fetchStudentDetails = async (cell: CellData) => {
    // Filter local students based on cell data and current filters
    const cellStudents = students.filter(s => {
      if (selectedGrade && s.Grade !== selectedGrade) return false;
      if (selectedTeacher && s.Teacher !== selectedTeacher) return false;

      const prevScore = s.StaarScore;
      const currScore = selectedVersion === 'fall' ? s.FallScore : s.SpringScore;

      const prevLvl = getLevel(prevScore, subjectConfig.previous);
      const currLvl = getLevel(currScore, subjectConfig.current);

      return prevLvl === cell.staar_level && currLvl === cell.benchmark_level;
    });
    setSelectedStudents(cellStudents);
  };

  const getCellData = (staarLevel: string, benchmarkLevel: string) => {
    return matrixData.find(d =>
      d.staar_level === staarLevel &&
      d.benchmark_level === benchmarkLevel
    ) || { staar_level: staarLevel, benchmark_level: benchmarkLevel, student_count: 0, group_number: 0 };
  };

  const getCellColor = (groupNumber: number, value: number): string => {
    if (value === 0) return 'bg-black text-gray-500';

    if (selectedSubject === 'rla') {
      // Red cells - No Growth / Regression (Using the list that was previously Green)
      if ([1, 7, 8, 13, 14, 19, 20, 21, 25, 26, 27, 28, 31, 32, 33, 34, 35].includes(groupNumber)) {
        return 'bg-red-200 text-red-800';
      }
      // Blue cells - Moderate Growth
      if ([15, 22, 29].includes(groupNumber)) {
        return 'bg-blue-200 text-blue-800';
      }
      // Green cells - Expected/Accelerated Growth (Using the list that was previously Red)
      // Masters->Masters (36) is here now.
      return 'bg-green-200 text-green-800';
    } else {
      // Existing math color logic - Swapping Red/Green lists
      // Former Green list becomes Red (1, 7, 8...)
      if ([1, 7, 8, 13, 14, 19, 20, 21, 25, 26, 27, 28, 31, 32, 33, 34, 35].includes(groupNumber)) {
        return 'bg-red-200 text-red-800';
      }
      if ([29, 22, 15].includes(groupNumber)) {
        return 'bg-blue-200 text-blue-800';
      }
      // Former Red list becomes Green (36, 30...)
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
    finalPreviousLevels.forEach(staarLevel => {
      finalCurrentLevels.forEach(benchmarkLevel => {
        const cellData = getCellData(staarLevel, benchmarkLevel);
        total += cellData.student_count;
      });
    });
    return total;
  };

  // Add helper function for points calculation
  // Wrap calculation in a safe accessor
  const calculateTotalPoints = () => {
    try {
      if (!matrixData || !Array.isArray(matrixData)) return 0;

      if (selectedSubject === 'rla') {
        const pointsMap = {
          base: matrixData
            .filter(d => d && [36, 30, 24, 23, 18, 17, 16, 12, 11, 10, 9, 6, 5, 4, 3, 2].includes(d.group_number))
            .reduce((sum: number, d: CellData) => sum + (Number(d.student_count) || 0), 0) * 1.0,
          half: matrixData
            .filter(d => d && [15, 22, 29].includes(d.group_number))
            .reduce((sum: number, d: CellData) => sum + (Number(d.student_count) || 0), 0) * 0.5,
          quarter: matrixData
            .filter(d => d && [34, 33, 32, 31, 28, 27, 26, 25].includes(d.group_number) && ['Did Not Meet Low', 'Did Not Meet High', 'Did Not Meet'].includes(d.staar_level))
            .reduce((sum: number, d: CellData) => sum + (Number(d.student_count) || 0), 0) * 0.25
        };
        return pointsMap.base + pointsMap.half + pointsMap.quarter;
      } else {
        const pointsMap = {
          base: matrixData
            .filter(d => d && [36, 30, 24, 23, 18, 17, 16, 12, 11, 10, 9, 6, 5, 4, 3, 2].includes(d.group_number))
            .reduce((sum: number, d: CellData) => sum + (Number(d.student_count) || 0), 0) * 1.0,
          half: matrixData
            .filter(d => d && [29, 22, 15].includes(d.group_number))
            .reduce((sum: number, d: CellData) => sum + (Number(d.student_count) || 0), 0) * 0.5,
          quarter: matrixData
            .filter(d => d && [34, 33, 32, 31, 28, 27, 26, 25].includes(d.group_number) && ['Did Not Meet Low', 'Did Not Meet High'].includes(d.staar_level))
            .reduce((sum: number, d: CellData) => sum + (Number(d.student_count) || 0), 0) * 0.25
        };
        return pointsMap.base + pointsMap.half + pointsMap.quarter;
      }
    } catch (err) {
      console.error('Error calculating total points:', err);
      return 0;
    }
  };


  if (!isMounted) return null;

  if (loading) {
    return <div>Loading...</div>;
  }

  const getThresholdLabel = (label: string, type: 'current' | 'previous') => {
    const thresholds = type === 'previous' ? subjectConfig?.previous : subjectConfig?.current;
    if (thresholds) {
      const t = thresholds.find((t: Threshold) => t.label === label);
      // Only show range if min/max are numbers
      if (t && typeof t.min === 'number' && typeof t.max === 'number') {
        return (
          <div className="flex flex-col">
            <span>{label}</span>
            <span className="text-xs opacity-75 font-normal">({t.min}-{t.max})</span>
          </div>
        );
      }
    }
    return label;
  };

  return (
    <div className="p-4">
      <div className="mb-4 bg-black text-white p-4 rounded">
        <div className="flex justify-between items-end">
          <div className="flex gap-4">
            {/* Subject selector could go here if needed, but it's currently managed via Tambo actions */}
          </div>

          <div className="flex items-center">
            <label htmlFor="search" className="mr-2 text-sm font-bold">Search:</label>
            <input
              type="text"
              id="search"
              placeholder="Name or ID"
              onChange={async (e) => {
                const searchTerm = e.target.value.toLowerCase();
                // Clear results if search is too short or empty
                if (searchTerm.length < 2) {
                  setSearchResults([]);
                  return;
                }

                // Local Search
                const found = students.filter(s =>
                  (s.FirstName + ' ' + s.LastName).toLowerCase().includes(searchTerm) ||
                  s.LocalId.includes(searchTerm)
                );
                setSearchResults(found);
              }}
              className="bg-gray-900 text-white border border-gray-600 rounded px-2 py-1 text-sm focus:border-white outline-none w-48"
            />
          </div>
          {!hasTeacherData && selectedGrade && (
            <div className="text-gray-500 text-sm mt-1">
              No teacher data available for selected grade
            </div>
          )}
        </div>

      </div>




      {/* Display filtered student as a line */}
      {searchResults.length > 0 && (
        <div className="bg-black text-white p-4 rounded border border-gray-700">
          <h4 className="font-bold mb-4">Matching Students ({searchResults.length})</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {searchResults.map((student, index) => {
              // Compute levels and group number on the fly
              const staarScore = student.StaarScore;
              const benchmarkScore = selectedVersion === 'fall' ? student.FallScore : student.SpringScore;
              const staarLevel = getLevel(staarScore, subjectConfig.previous);
              const benchmarkLevel = getLevel(benchmarkScore, subjectConfig.current);
              const groupNumber = getGroupNumber(staarLevel, benchmarkLevel);

              // Get the math color class
              const mathColorClass = groupNumber ?
                getCellColor(groupNumber, 1) :
                'bg-gray-900';

              return (
                <div key={index}
                  className="p-3 rounded shadow-md hover:opacity-90 transition-opacity bg-gray-900"
                >
                  <div className="mb-2">
                    <div className="font-bold">{student.FirstName} {student.LastName}</div>
                    <div className="text-sm opacity-75">Grade {student.Grade} • {student.Teacher}</div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-sm">

                    {/* STAAR Scores */}
                    <div className={`${mathColorClass} p-2 rounded`}>
                      <div className="font-bold opacity-75 text-xs mb-1">STAAR</div>
                      <div>{student.StaarScore || 'N/A'}</div>
                      <div className="text-xs">{student.StaarLevel || staarLevel || 'N/A'}</div>
                    </div>

                    {/* Fall Benchmark */}
                    <div className={`${mathColorClass} p-2 rounded`}>
                      <div className="font-bold opacity-75 text-xs mb-1">Fall</div>
                      <div>{student.FallScore || 'N/A'}</div>
                      <div className="text-xs opacity-75">Benchmark</div>
                    </div>

                    {/* Spring Benchmark */}
                    <div className={`${mathColorClass} p-2 rounded relative`}>
                      <div className="font-bold opacity-75 text-xs mb-1">Spring</div>
                      {student.SpringScore ? (
                        <>
                          <div>{student.SpringScore}</div>
                          <div className="text-xs">{student.SpringLevel || benchmarkLevel || 'N/A'}</div>
                        </>
                      ) : (
                        <div className="border-2 border-dashed border-white/30 h-8 w-8 rounded-full flex items-center justify-center mx-auto mt-1 opacity-50 text-xs">
                          ?
                        </div>
                      )}

                      {groupNumber > 0 && (
                        <div className="text-xs font-bold mt-1">
                          Group {groupNumber}
                        </div>
                      )}
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



      <div className="mt-8 flex justify-between items-center bg-zinc-900 border border-zinc-800 p-6 rounded-xl gap-8">
        <div className="flex-1">
          <h2 className="text-xl font-bold mb-4">Overall Points Calculation</h2>
          <div className="text-lg bg-black text-white p-4 rounded-lg border border-white/20">
            <div className="flex justify-between">
              <span className="opacity-75">Total Points:</span>
              <span className="font-mono font-bold">{calculateTotalPoints().toFixed(1)}</span>
            </div>
            <div className="flex justify-between">
              <span className="opacity-75">Total Students:</span>
              <span className="font-mono font-bold">{matrixData.reduce((sum, d) => sum + d.student_count, 0)}</span>
            </div>
          </div>
        </div>

        {/* Dynamic Fall/Spring Toggle */}
        <div className="flex flex-col items-center gap-3 py-4">
          <span className="text-xs font-bold uppercase tracking-widest opacity-50">Select Assessment</span>
          <div className="bg-black p-1 rounded-full border border-white/10 flex shadow-inner">
            <button
              onClick={() => setSelectedVersion('fall')}
              className={`px-6 py-2 rounded-full text-sm font-bold transition-all duration-200 ${selectedVersion === 'fall'
                ? 'bg-white text-black shadow-lg scale-105'
                : 'text-white/50 hover:text-white'
                }`}
            >
              Fall
            </button>
            <button
              onClick={() => setSelectedVersion('spring-algebra')}
              className={`px-6 py-2 rounded-full text-sm font-bold transition-all duration-200 ${selectedVersion !== 'fall'
                ? 'bg-white text-black shadow-lg scale-105'
                : 'text-white/50 hover:text-white'
                }`}
            >
              Spring
            </button>
          </div>
        </div>

        <div className="flex-1 text-right">
          <div className="font-bold text-2xl mb-2">
            Academic Growth Score: {(() => {
              const totalStudents = matrixData.reduce((sum, d) => sum + d.student_count, 0);
              if (totalStudents === 0) return '0.0 (F)';
              const score = (calculateTotalPoints() / totalStudents) * 100;
              let grade = 'F';
              if (score >= 80) grade = 'A';
              else if (score >= 68) grade = 'B';
              else if (score >= 61) grade = 'C';
              else if (score >= 55) grade = 'D';

              let colorClass = 'text-red-500';
              if (grade === 'A') colorClass = 'text-green-500';
              if (grade === 'B') colorClass = 'text-blue-500';
              if (grade === 'C') colorClass = 'text-purple-500';
              if (grade === 'D') colorClass = 'text-red-500';

              return <span className={colorClass}>{score.toFixed(1)} ({grade})</span>;
            })()}
          </div>
          <h3 className="font-bold mb-2">Academic Growth Score Scale:</h3>
          <div className="grid grid-cols-5 gap-4 bg-black p-3 rounded border border-gray-800">
            <div className="text-green-500 font-bold">A: 80+</div>
            <div className="text-blue-500 font-bold">B: 68-79</div>
            <div className="text-purple-500 font-bold">C: 61-67</div>
            <div className="text-red-500 font-bold">D: 55-60</div>
            <div className="text-red-500 font-bold">F: 55</div>
          </div>
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
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {selectedStudents.map((student, index) => {
                  const mathColorClass = selectedCell.group_number ?
                    getCellColor(selectedCell.group_number, 1) :
                    'bg-gray-900';

                  return (
                    <div key={index}
                      className="p-2 rounded shadow-md hover:opacity-90 transition-opacity bg-gray-900 text-sm"
                    >
                      <div className="font-bold border-b border-gray-700 pb-1 mb-1">
                        {student.FirstName} {student.LastName}
                        <div className="text-xs opacity-75">{student.Grade}th • {student.Teacher}</div>
                      </div>

                      <div className="grid grid-cols-1">
                        <div className={`${mathColorClass} p-1 rounded text-xs`}>
                          <div className="grid grid-cols-2">
                            <span>{yAxisLabel}: {student.StaarScore || '-'}</span>
                            <span>{xAxisLabel}: {selectedVersion === 'fall' ? student.FallScore : student.SpringScore || '-'}</span>
                          </div>

                          {selectedCell.group_number && (
                            <div className="font-bold">G{selectedCell.group_number}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        <table className="border-collapse w-full">
          <thead>
            <tr>
              <th className="border p-2 bg-green-500 text-white" rowSpan={2}>
                {yAxisLabel}
              </th>
              <th className="border p-2 bg-orange-300 text-center font-bold" colSpan={7}>
                {xAxisLabel}
              </th>
            </tr>
            <tr>
              {finalCurrentLevels.map((level, index) => (
                <th key={index} className="border p-2 text-sm min-w-[100px]">
                  {getThresholdLabel(level, 'current')}
                </th>
              ))}
              <th className="border p-2 text-sm min-w-[100px] bg-black text-white">Row Total</th>
            </tr>
          </thead>
          <tbody>
            {finalPreviousLevels.map((staarLevel, rowIndex) => {
              const rowTotal = finalCurrentLevels.reduce((sum: number, benchmarkLevel: string) => {
                const cellData = getCellData(staarLevel, benchmarkLevel);
                return sum + cellData.student_count;
              }, 0);

              return (
                <tr key={rowIndex}>
                  <td className="border p-2 font-medium min-w-[150px]">
                    {getThresholdLabel(staarLevel, 'previous')}
                    <div className="text-sm text-gray-600">
                      {staarTotals[staarLevel] || 0}
                    </div>
                  </td>
                  {finalCurrentLevels.map((benchmarkLevel, colIndex) => {
                    const cellData = getCellData(staarLevel, benchmarkLevel);
                    return (
                      <td
                        key={colIndex}
                        className={`border p-2 text-center ${selectedSubject === 'campus' ? '' : 'cursor-pointer'} ${getCellColor(cellData.group_number, cellData.student_count)} ${selectedSubject === 'campus' ? '' : 'hover:opacity-75'}`}
                        onClick={() => {
                          if (selectedSubject !== 'campus') {
                            setSelectedCell(cellData);
                            fetchStudentDetails(cellData);
                          }
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
              {finalCurrentLevels.map((_, colIndex) => {
                const colTotal = finalPreviousLevels.reduce((sum: number, staarLevel: string) => {
                  const cellData = getCellData(staarLevel, finalCurrentLevels[colIndex]);
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
      </div >

      <div className="mt-8 overflow-x-auto">
        <h2 className="text-xl font-bold mb-4">HB4545 Students</h2>
        <table className="border-collapse w-full">
          <thead>
            <tr>
              <th className="border p-2 bg-green-500 text-white" rowSpan={2}>
                {yAxisLabel}
              </th>
              <th className="border p-2 bg-orange-300 text-center font-bold" colSpan={6}>
                {xAxisLabel}
              </th>
            </tr>
            <tr>
              {finalCurrentLevels.map((level, index) => (
                <th key={index} className="border p-2 text-sm min-w-[100px]">
                  {getThresholdLabel(level, 'current')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {finalPreviousLevels.slice(0, 2).map((staarLevel, rowIndex) => (
              <tr key={rowIndex}>
                <td className="border p-2 font-medium min-w-[150px]">
                  {getThresholdLabel(staarLevel, 'previous')}
                  <div className="text-sm text-gray-600">
                    {staarTotals[staarLevel] || 0}
                  </div>
                </td>
                {finalCurrentLevels.map((benchmarkLevel, colIndex) => {
                  const cellData = getCellData(staarLevel, benchmarkLevel);
                  return (
                    <td
                      key={colIndex}
                      className={`border p-2 text-center ${selectedSubject === 'campus' ? '' : 'cursor-pointer'} ${getCellColor(cellData.group_number, cellData.student_count)} ${selectedSubject === 'campus' ? '' : 'hover:opacity-75'}`}
                      onClick={() => {
                        if (selectedSubject !== 'campus') {
                          setSelectedCell(cellData);
                          fetchStudentDetails(cellData);
                        }
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
                    {matrixData.filter(d => [1, 7, 8, 13, 14, 19, 20, 21, 25, 26, 27, 28, 31, 32, 33, 34, 35].includes(d.group_number))
                      .reduce((sum: number, d: CellData) => sum + d.student_count, 0)}
                  </td>
                  <td className="border p-2 text-center">0.0</td>
                  <td className="border p-2 text-center">0.0</td>
                </tr>
                <tr>
                  <td className="border p-2">Tests earning 0.5 points</td>
                  <td className="border p-2 text-center">
                    {matrixData.filter(d => [29, 22, 15].includes(d.group_number))
                      .reduce((sum: number, d: CellData) => sum + d.student_count, 0)}
                  </td>
                  <td className="border p-2 text-center">0.5</td>
                  <td className="border p-2 text-center">
                    {(matrixData.filter(d => [29, 22, 15].includes(d.group_number))
                      .reduce((sum: number, d: CellData) => sum + d.student_count, 0) * 0.5).toFixed(1)}
                  </td>
                </tr>
                <tr>
                  <td className="border p-2">Tests earning 1.0 points</td>
                  <td className="border p-2 text-center">
                    {matrixData.filter(d => [36, 30, 24, 23, 18, 17, 16, 12, 11, 10, 9, 6, 5, 4, 3, 2].includes(d.group_number))
                      .reduce((sum: number, d: CellData) => sum + d.student_count, 0)}
                  </td>
                  <td className="border p-2 text-center">1.0</td>
                  <td className="border p-2 text-center">
                    {(matrixData.filter(d => [36, 30, 24, 23, 18, 17, 16, 12, 11, 10, 9, 6, 5, 4, 3, 2].includes(d.group_number))
                      .reduce((sum: number, d: CellData) => sum + d.student_count, 0) * 1.0).toFixed(1)}
                  </td>
                </tr>
                <tr className="font-bold">
                  <td className="border p-2">Total</td>
                  <td className="border p-2 text-center">
                    {matrixData.reduce((sum: number, d: CellData) => sum + d.student_count, 0)}
                  </td>
                  <td className="border p-2 text-center">-</td>
                  <td className="border p-2 text-center">
                    {(
                      matrixData.filter(d => [29, 22, 15].includes(d.group_number))
                        .reduce((sum: number, d: CellData) => sum + d.student_count, 0) * 0.5 +
                      matrixData.filter(d => [36, 30, 24, 23, 18, 17, 16, 12, 11, 10, 9, 6, 5, 4, 3, 2].includes(d.group_number))
                        .reduce((sum: number, d: CellData) => sum + d.student_count, 0) * 1.0
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
                    ).reduce((sum: number, d: CellData) => sum + d.student_count, 0)}
                  </td>
                  <td className="border p-2 text-center">0.0</td>
                  <td className="border p-2 text-center">0.0</td>
                </tr>
                <tr>
                  <td className="border p-2">Tests earning 0.25 points</td>
                  <td className="border p-2 text-center">
                    {matrixData.filter(d =>
                      [34, 33, 32, 31, 28, 27, 26, 25].includes(d.group_number)
                    ).reduce((sum: number, d: CellData) => sum + d.student_count, 0)}
                  </td>
                  <td className="border p-2 text-center">0.25</td>
                  <td className="border p-2 text-center">
                    {(matrixData.filter(d =>
                      [34, 33, 32, 31, 28, 27, 26, 25].includes(d.group_number)
                    ).reduce((sum: number, d: CellData) => sum + d.student_count, 0) * 0.25).toFixed(1)}
                  </td>
                </tr>
                <tr className="font-bold">
                  <td className="border p-2">Total</td>
                  <td className="border p-2 text-center">
                    {matrixData.filter(d =>
                      ['Did Not Meet Low', 'Did Not Meet High'].includes(d.staar_level)
                    ).reduce((sum: number, d: CellData) => sum + d.student_count, 0)}
                  </td>
                  <td className="border p-2 text-center">-</td>
                  <td className="border p-2 text-center">
                    {(
                      matrixData.filter(d =>
                        [34, 33, 32, 31, 28, 27, 26, 25].includes(d.group_number) &&
                        ['Did Not Meet Low', 'Did Not Meet High'].includes(d.staar_level)
                      ).reduce((sum: number, d: CellData) => sum + d.student_count, 0) * 0.25
                    ).toFixed(1)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {/* Unified Student Scores Table */}
      <UnifiedStudentScoresTable />

    </div >
  );
};

export default PerformanceMatrix;

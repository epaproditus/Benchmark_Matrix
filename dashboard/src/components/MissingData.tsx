'use client';
import { useState, useEffect, useCallback } from 'react';
import { useTamboContextHelpers } from '@tambo-ai/react';

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
  const [updateStatus, setUpdateStatus] = useState<{ id: string, status: 'success' | 'error' } | null>(null);
  const [tableConfig, setTableConfig] = useState({
    sortBy: 'Last Name',
    sortOrder: 'asc' as 'asc' | 'desc',
    filters: {} as Record<string, string>,
    groupBy: null as string | null
  });

  const { addContextHelper, removeContextHelper } = useTamboContextHelpers();

  useEffect(() => {
    fetchData();

    // Listen for AI-triggered actions
    const handleAction = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.component === 'MissingData') {
        if (customEvent.detail.action === 'reset') {
          setTableConfig({
            sortBy: 'Last Name',
            sortOrder: 'asc',
            filters: {},
            groupBy: null
          });
        } else {
          setTableConfig(prev => ({ ...prev, ...customEvent.detail.config }));
        }
      }
    };
    window.addEventListener('tambo-action', handleAction);
    return () => window.removeEventListener('tambo-action', handleAction);
  }, []);


  const processData = useCallback((data: Student[]) => {
    if (!Array.isArray(data)) return [];
    let result = [...data];

    // 1. Filter
    Object.entries(tableConfig.filters).forEach(([key, value]) => {
      if (!value) return;
      result = result.filter(item => {
        const val = item[key as keyof Student];
        return val?.toString().toLowerCase().includes(value.toLowerCase());
      });
    });

    // 2. Sort
    if (tableConfig.sortBy) {
      result.sort((a, b) => {
        const valA = a[tableConfig.sortBy as keyof Student];
        const valB = b[tableConfig.sortBy as keyof Student];

        if (valA === valB) return 0;
        if (valA === null || valA === undefined) return 1;
        if (valB === null || valB === undefined) return -1;

        if (typeof valA === 'number' && typeof valB === 'number') {
          return tableConfig.sortOrder === 'asc' ? valA - valB : valB - valA;
        }

        const strA = String(valA).toLowerCase();
        const strB = String(valB).toLowerCase();

        if (strA < strB) return tableConfig.sortOrder === 'asc' ? -1 : 1;
        if (strA > strB) return tableConfig.sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [tableConfig.filters, tableConfig.sortBy, tableConfig.sortOrder]);

  // Provide the missing students data and current config to the AI assistant
  useEffect(() => {
    addContextHelper("missingStudents", () => ({
      key: "missing-students",
      value: JSON.stringify({
        config: tableConfig,
        availableColumns: ['First Name', 'Last Name', 'Local Id', 'Grade', 'teacher', 'staar_score', 'benchmark_score'],
        missingBenchmarkCount: missingBenchmark.length,
        missingStaarCount: missingStaar.length,
        // We provide a sample or the whole list depending on size, 
        // but for now let's provide the counts and the AI can query more if needed.
        // Actually, the user wants the AI to "see" it, so let's provide the processed data.
        data: {
          missingBenchmark: processData(missingBenchmark),
          missingStaar: processData(missingStaar)
        }
      })
    }));
    return () => removeContextHelper("missingStudents");
  }, [missingBenchmark, missingStaar, tableConfig, addContextHelper, removeContextHelper, processData]);

  const fetchData = async () => {
    try {
      const response = await fetch('/api/missing-data');
      const data = await response.json();
      setMissingBenchmark(Array.isArray(data.missingBenchmark) ? data.missingBenchmark : []);
      setMissingStaar(Array.isArray(data.missingStaar) ? data.missingStaar : []);
    } catch (error) {
      console.error('Error fetching missing data:', error);
      setMissingBenchmark([]);
      setMissingStaar([]);
    } finally {
      setLoading(false);
    }
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

  if (loading) return <div className="p-8 text-center text-foreground">Loading student data...</div>;

  const processedBenchmark = processData(missingBenchmark);
  const processedStaar = processData(missingStaar);

  const renderTable = (data: Student[], type: 'benchmark' | 'staar') => {
    const title = type === 'benchmark' ? 'Missing Benchmark Scores' : 'Missing STAAR Scores';

    // Handle Grouping
    if (tableConfig.groupBy) {
      const groups = data.reduce((acc, student) => {
        const groupKey = student[tableConfig.groupBy as keyof Student]?.toString() || 'Unknown';
        if (!acc[groupKey]) acc[groupKey] = [];
        acc[groupKey].push(student);
        return acc;
      }, {} as Record<string, Student[]>);

      return (
        <div className="mb-12">
          <h2 className="text-xl font-bold mb-4 text-foreground">{title} (Grouped by {tableConfig.groupBy})</h2>
          {Object.entries(groups).map(([groupName, students]) => (
            <div key={groupName} className="mb-6">
              <h3 className="text-lg font-semibold mb-2 text-primary bg-secondary/50 px-3 py-1 rounded inline-block">
                {tableConfig.groupBy}: {groupName} ({students.length})
              </h3>
              {renderRawTable(students, type)}
            </div>
          ))}
        </div>
      );
    }

    return (
      <div className="mb-12">
        <h2 className="text-xl font-bold mb-4 text-foreground">{title} ({data.length} students)</h2>
        {renderRawTable(data, type)}
      </div>
    );
  };

  const renderRawTable = (data: Student[], type: 'benchmark' | 'staar') => (
    <div className="overflow-x-auto rounded-lg border border-border bg-container">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-secondary text-secondary-foreground">
            <th className="p-3 text-left border-b border-border font-semibold">Name</th>
            <th className="p-3 text-left border-b border-border font-semibold">ID</th>
            <th className="p-3 text-left border-b border-border font-semibold">Grade</th>
            <th className="p-3 text-left border-b border-border font-semibold">Teacher</th>
            <th className="p-3 text-left border-b border-border font-semibold">{type === 'benchmark' ? 'STAAR Score' : 'Benchmark Score'}</th>
            <th className="p-3 text-left border-b border-border font-semibold">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {data.map((student) => (
            <tr key={student['Local Id']} className="hover:bg-backdrop transition-colors">
              <td className="p-3 text-foreground">{student['Last Name']}, {student['First Name']}</td>
              <td className="p-3 font-mono text-muted-foreground">{student['Local Id']}</td>
              <td className="p-3 text-foreground">{student.Grade}</td>
              <td className="p-3 text-foreground">{student.teacher}</td>
              <td className="p-3 text-foreground font-medium">{type === 'benchmark' ? (student.staar_score ?? '-') : (student.benchmark_score ?? '-')}</td>
              <td className="p-3">
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    placeholder={`Enter ${type}`}
                    className="bg-background border border-border rounded px-2 py-1 w-24 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    onBlur={(e) => {
                      const score = parseFloat(e.target.value);
                      if (!isNaN(score)) {
                        if (type === 'benchmark') updateScore(student['Local Id'], score);
                        else updateScore(student['Local Id'], undefined, score);
                      }
                    }}
                  />
                  {updateStatus?.id === student['Local Id'] && (
                    <span className={cn(
                      "text-xs px-2 py-1 rounded",
                      updateStatus.status === 'success' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
                    )}>
                      {updateStatus.status === 'success' ? 'Saved' : 'Error'}
                    </span>
                  )}
                </div>
              </td>
            </tr>
          ))}
          {data.length === 0 && (
            <tr>
              <td colSpan={6} className="p-8 text-center text-muted-foreground italic">No students matching the current filters.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Active Filters Bar */}
      {(tableConfig.groupBy || tableConfig.sortBy !== 'Last Name' || Object.keys(tableConfig.filters).length > 0) && (
        <div className="flex flex-wrap items-center gap-2 p-3 bg-secondary/30 rounded-lg border border-border">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground mr-2">View Filters:</span>
          {tableConfig.groupBy && (
            <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full border border-primary/30">
              Grouped by: {tableConfig.groupBy}
            </span>
          )}
          {tableConfig.sortBy && (
            <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full border border-primary/30">
              Sorted by: {tableConfig.sortBy} ({tableConfig.sortOrder})
            </span>
          )}
          {Object.entries(tableConfig.filters).map(([key, value]) => (
            <span key={key} className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full border border-primary/30">
              {key}: {value}
            </span>
          ))}
          <button
            onClick={() => setTableConfig({ sortBy: 'Last Name', sortOrder: 'asc', filters: {}, groupBy: null })}
            className="text-xs text-muted-foreground hover:text-foreground ml-auto underline"
          >
            Clear All
          </button>
        </div>
      )}

      {renderTable(processedBenchmark, 'benchmark')}
      {renderTable(processedStaar, 'staar')}
    </div>
  );
}
// Helper for tailwind classes if not already available
const cn = (...classes: (string | boolean | undefined)[]) => classes.filter(Boolean).join(' ');


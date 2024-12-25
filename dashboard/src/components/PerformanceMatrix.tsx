'use client';
import { useState } from 'react';

interface StudentData {
  prev_level: string;
  current_level: string;
  count: number;
  group: string;
}

const PerformanceMatrix = () => {
  const [selectedCell, setSelectedCell] = useState<StudentData | null>(null);

  const rowLabels = [
    { label: 'Low Does Not Meet GL', count: 74 },
    { label: 'High Does Not Meet GL', count: 77 },
    { label: 'Low Approaches GL', count: 35 },
    { label: 'High Approaches GL', count: 19 },
    { label: 'Meets GL', count: 26 },
    { label: 'Masters GL', count: 7 }
  ];

  const colLabels = [
    'Low Does Not Meet GL',
    'High Does Not Meet GL',
    'Low Approaches GL',
    'High Approaches GL',
    'Meets GL',
    'Masters GL'
  ];

  // Sample data - replace with your actual data
  const transitionData = [
    [19, 36, 12, 6, 1, 0],
    [11, 48, 41, 12, 4, 0],
    [2, 11, 12, 7, 3, 0],
    [0, 5, 1, 11, 2, 0],
    [0, 0, 9, 8, 8, 1],
    [0, 0, 0, 1, 4, 2]
  ];

  const getCellColor = (value: number): string => {
    if (value === 0) return 'bg-white';
    if (value < 5) return 'bg-red-100';
    if (value < 10) return 'bg-red-200';
    if (value < 20) return 'bg-blue-200';
    return 'bg-blue-300';
  };

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
              {colLabels.map((label, index) => (
                <th key={index} className="border p-2 text-sm min-w-[100px]">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rowLabels.map((row, rowIndex) => (
              <tr key={rowIndex}>
                <td className="border p-2 font-medium min-w-[150px]">
                  <div>{row.label}</div>
                  <div className="text-sm text-gray-600">{row.count}</div>
                </td>
                {transitionData[rowIndex].map((value, colIndex) => (
                  <td
                    key={colIndex}
                    className={`border p-2 text-center cursor-pointer ${getCellColor(value)} hover:opacity-75`}
                    onClick={() => setSelectedCell({
                      prev_level: row.label,
                      current_level: colLabels[colIndex],
                      count: value,
                      group: `Group ${rowIndex + colIndex}`
                    })}
                  >
                    <div className="font-bold">{value}</div>
                    <div className="text-xs text-gray-500">{`(Group ${rowIndex + colIndex})`}</div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedCell && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center" onClick={() => setSelectedCell(null)}>
          <div className="bg-white p-4 rounded-lg max-w-md" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-2">Student Transition Details</h3>
            <p><strong>From:</strong> {selectedCell.prev_level}</p>
            <p><strong>To:</strong> {selectedCell.current_level}</p>
            <p><strong>Number of Students:</strong> {selectedCell.count}</p>
            <p><strong>Group:</strong> {selectedCell.group}</p>
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
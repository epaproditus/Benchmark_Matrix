'use client';

import React, { useState, useMemo } from 'react';
import { db, Student } from '@/lib/db';
import { useLiveQuery } from 'dexie-react-hooks';

type ExportType = 'spring' | 'fall' | 'previous';

export function UnifiedStudentScoresTable() {
    // Live query to local DB
    const students = useLiveQuery(() => db.students.toArray()) || [];

    // UI State
    const [isOpen, setIsOpen] = useState(false); // Collapsed by default
    const [filterText, setFilterText] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: keyof Student; direction: 'asc' | 'desc' } | null>(null);

    // Editing State
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editForm, setEditForm] = useState<Partial<Student>>({});
    const [isAdding, setIsAdding] = useState(false);
    const [addForm, setAddForm] = useState<Partial<Student>>({ LocalId: '', FirstName: '', LastName: '', Grade: '', Teacher: '' });

    // Handlers
    const startEdit = (student: Student) => {
        setEditingId(student.id!);
        setEditForm({ ...student });
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditForm({});
    };

    const saveEdit = async () => {
        if (editingId && editForm) {
            await db.students.update(editingId, editForm);
            setEditingId(null);
            setEditForm({});
        }
    };

    const startAdd = () => {
        setIsAdding(true);
        setAddForm({ LocalId: '', FirstName: '', LastName: '', Grade: '', Teacher: '' });
    };

    const cancelAdd = () => {
        setIsAdding(false);
        setAddForm({});
    };

    const saveAdd = async () => {
        if (!addForm.LocalId) {
            alert("Local ID is required");
            return;
        }
        await db.students.add(addForm as Student);
        setIsAdding(false);
        setAddForm({});
    };

    const escapeCsvField = (value: string | number | null | undefined): string => {
        const text = value === null || value === undefined ? '' : String(value);
        if (text.includes('"') || text.includes(',') || text.includes('\n')) {
            return `"${text.replace(/"/g, '""')}"`;
        }
        return text;
    };

    const downloadCsv = (filename: string, rows: Array<Array<string | number | null>>) => {
        const csv = rows.map((row) => row.map(escapeCsvField).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleExport = (type: ExportType) => {
        const exportConfig: Record<ExportType, { label: string; scoreKey: keyof Student; levelKey: keyof Student }> = {
            spring: { label: 'spring_scores', scoreKey: 'SpringScore', levelKey: 'SpringLevel' },
            fall: { label: 'fall_scores', scoreKey: 'FallScore', levelKey: 'FallLevel' },
            previous: { label: 'previous_staar_scores', scoreKey: 'StaarScore', levelKey: 'StaarLevel' },
        };

        const { label, scoreKey, levelKey } = exportConfig[type];
        const rows = students
            .filter((row) => row[scoreKey] !== null)
            .map((row) => [
                row.LocalId,
                row.LastName ?? '',
                row.FirstName ?? '',
                row[scoreKey] as number | null,
                row[levelKey] as string | null,
            ]);

        if (rows.length === 0) {
            alert(`No ${label.replaceAll('_', ' ')} available to export.`);
            return;
        }

        const dateStamp = new Date().toISOString().slice(0, 10);
        downloadCsv(`${label}_${dateStamp}.csv`, [
            ['LocalId', 'LastName', 'FirstName', 'Score', 'Level'],
            ...rows,
        ]);
    };


    // Delete handler
    const handleDelete = async (localId: string): Promise<boolean> => {
        if (!confirm('Are you sure you want to delete this student record from ALL lists? This cannot be undone.')) return false;

        try {
            // Delete from local DB by LocalId (using compound index or manual filtering if not indexed unique)
            // Schema has &LocalId, so it is a unique index.
            await db.students.where('LocalId').equals(localId).delete();
            return true;
        } catch (error) {
            console.error('Delete failed:', error);
            alert('Error deleting record.');
            return false;
        }
    };

    const requestSort = (key: keyof Student) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const sortedData = useMemo(() => {
        let sortableItems = [...students];

        // Filter
        if (filterText) {
            const lowerFilter = filterText.toLowerCase();
            sortableItems = sortableItems.filter(item =>
                (item.FirstName?.toLowerCase() || '').includes(lowerFilter) ||
                (item.LastName?.toLowerCase() || '').includes(lowerFilter) ||
                (item.LocalId || '').includes(lowerFilter)
            );
        }

        // Sort
        if (sortConfig !== null) {
            sortableItems.sort((a, b) => {
                const aVal = a[sortConfig.key];
                const bVal = b[sortConfig.key];

                if (aVal === null || aVal === undefined) return 1;
                if (bVal === null || bVal === undefined) return -1;

                if (aVal < bVal) {
                    return sortConfig.direction === 'asc' ? -1 : 1;
                }
                if (aVal > bVal) {
                    return sortConfig.direction === 'asc' ? 1 : -1;
                }
                return 0;
            });
        }
        return sortableItems;
    }, [students, sortConfig, filterText]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>, field: keyof Student, isAdd: boolean = false) => {
        const numericValue = e.target.value.trim() === '' ? null : Number(e.target.value);
        const val = e.target.type === 'number'
            ? (Number.isNaN(numericValue) ? null : numericValue)
            : e.target.value;
        if (isAdd) {
            setAddForm(prev => ({ ...prev, [field]: val }));
        } else {
            setEditForm(prev => ({ ...prev, [field]: val }));
        }
    };
    const getLevelColor = (level: string | null | undefined) => {
        if (!level) return 'text-zinc-500';
        if (level.includes('Masters')) return 'text-fuchsia-300 font-bold';
        if (level.includes('Meets')) return 'text-emerald-300 font-bold';
        if (level.includes('Approaches')) return 'text-sky-300 font-medium';
        if (level.includes('Did Not Meet')) return 'text-rose-300 font-medium';
        return 'text-zinc-400';
    };

    const getScoreTextColor = (column: 'staar' | 'fall' | 'spring') => {
        if (column === 'staar') return 'text-violet-300';
        if (column === 'fall') return 'text-amber-300';
        return 'text-cyan-300';
    };

    const renderScoreCell = (
        score: number | null | undefined,
        level: string | null | undefined,
        column: 'staar' | 'fall' | 'spring'
    ) => {
        if (score === null || score === undefined) return <span className="text-zinc-500">-</span>;
        return (
            <div>
                <span className={`font-mono text-lg ${getScoreTextColor(column)}`}>{score}</span>
                {level && level !== 'Unknown' && (
                    <span className={`ml-2 text-xs uppercase ${getLevelColor(level)}`}>
                        {level}
                    </span>
                )}
            </div>
        );
    };

    if (!students) return <div className="p-4 text-sm text-zinc-500">Loading student data...</div>;

    return (
        <div className="mt-8 border border-zinc-700 rounded-lg overflow-hidden bg-black shadow-sm">
            <div className="flex items-center justify-between p-4 bg-zinc-900 border-b border-zinc-800">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex items-center gap-4 hover:opacity-75 transition"
                >
                    <span className="font-semibold text-lg text-zinc-100">
                        All Student Scores ({students.length})
                    </span>
                    <span className="text-zinc-400 text-xs">
                        {isOpen ? '▼' : '▶'}
                    </span>
                </button>
                <div className="flex gap-2">
                    {isOpen && (
                        <>
                            <input
                                type="text"
                                placeholder="Filter by name..."
                                className="text-sm px-3 py-1 rounded border border-zinc-700 bg-black text-zinc-100 focus:outline-none focus:ring-1 focus:ring-cyan-400"
                                value={filterText}
                                onChange={(e) => setFilterText(e.target.value)}
                            />
                            <button
                                onClick={startAdd}
                                className="px-3 py-1 bg-emerald-700 text-white text-sm rounded hover:bg-emerald-600"
                            >
                                + Add Row
                            </button>
                            <button
                                onClick={() => handleExport('spring')}
                                className="px-3 py-1 bg-cyan-900/60 text-cyan-200 text-sm rounded hover:bg-cyan-800/80"
                            >
                                Export Spring
                            </button>
                            <button
                                onClick={() => handleExport('fall')}
                                className="px-3 py-1 bg-amber-900/60 text-amber-200 text-sm rounded hover:bg-amber-800/80"
                            >
                                Export Fall
                            </button>
                            <button
                                onClick={() => handleExport('previous')}
                                className="px-3 py-1 bg-violet-900/60 text-violet-200 text-sm rounded hover:bg-violet-800/80"
                            >
                                Export Previous STAAR
                            </button>
                        </>
                    )}
                </div>
            </div>

            {isOpen && (
                <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                    <table className="min-w-full divide-y divide-zinc-800">
                        <thead className="bg-zinc-900 sticky top-0 z-10">
                            <tr>
                                <th
                                    className="px-6 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider cursor-pointer hover:bg-zinc-800"
                                    onClick={() => requestSort('LastName')}
                                >
                                    Student Name {sortConfig?.key === 'LastName' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                </th>
                                <th
                                    className="px-6 py-3 text-left text-xs font-medium text-violet-300 uppercase tracking-wider cursor-pointer hover:bg-zinc-800"
                                    onClick={() => requestSort('StaarScore')}
                                >
                                    Previous STAAR {sortConfig?.key === 'StaarScore' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                </th>
                                <th
                                    className="px-6 py-3 text-left text-xs font-medium text-amber-300 uppercase tracking-wider cursor-pointer hover:bg-zinc-800"
                                    onClick={() => requestSort('FallScore')}
                                >
                                    Fall Benchmark {sortConfig?.key === 'FallScore' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                </th>
                                <th
                                    className="px-6 py-3 text-left text-xs font-medium text-cyan-300 uppercase tracking-wider cursor-pointer hover:bg-zinc-800"
                                    onClick={() => requestSort('SpringScore')}
                                >
                                    Spring Benchmark {sortConfig?.key === 'SpringScore' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-zinc-400 uppercase tracking-wider">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-black divide-y divide-zinc-800">
                            {isAdding && (
                                <tr className="bg-zinc-900/70">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                        <div className="flex flex-col gap-1">
                                            <input placeholder="Last Name" className="border border-zinc-700 bg-black p-1 rounded text-zinc-100" value={addForm.LastName ?? ''} onChange={e => handleInputChange(e, 'LastName', true)} />
                                            <input placeholder="First Name" className="border border-zinc-700 bg-black p-1 rounded text-zinc-100" value={addForm.FirstName ?? ''} onChange={e => handleInputChange(e, 'FirstName', true)} />
                                            <input placeholder="ID" className="border border-zinc-700 bg-black p-1 rounded text-zinc-100 text-xs" value={addForm.LocalId ?? ''} onChange={e => handleInputChange(e, 'LocalId', true)} />
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                        <input type="number" placeholder="STAAR" className="w-20 border border-zinc-700 bg-black p-1 rounded text-zinc-100" value={addForm.StaarScore ?? ''} onChange={e => handleInputChange(e, 'StaarScore', true)} />
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                        <input type="number" placeholder="Fall" className="w-20 border border-zinc-700 bg-black p-1 rounded text-zinc-100" value={addForm.FallScore ?? ''} onChange={e => handleInputChange(e, 'FallScore', true)} />
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                        <input type="number" placeholder="Spring" className="w-20 border border-zinc-700 bg-black p-1 rounded text-zinc-100" value={addForm.SpringScore ?? ''} onChange={e => handleInputChange(e, 'SpringScore', true)} />
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <button onClick={saveAdd} className="px-2 py-1 rounded bg-emerald-700 text-emerald-100 hover:bg-emerald-600 mr-2">Save</button>
                                        <button onClick={cancelAdd} className="px-2 py-1 rounded bg-zinc-700 text-zinc-100 hover:bg-zinc-600">Cancel</button>
                                    </td>
                                </tr>
                            )}
                            {sortedData.map((row) => (
                                <tr
                                    key={row.LocalId}
                                    className="hover:bg-zinc-900/70 group cursor-pointer"
                                    onClick={() => startEdit(row)}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            startEdit(row);
                                        }
                                    }}
                                >
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-200">
                                        <div className="font-medium">{row.LastName}, {row.FirstName}</div>
                                        <div className="text-xs text-zinc-500">{row.LocalId}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                        {renderScoreCell(row.StaarScore, row.StaarLevel, 'staar')}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                        {renderScoreCell(row.FallScore, row.FallLevel, 'fall')}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                        {renderScoreCell(row.SpringScore, row.SpringLevel, 'spring')}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                void handleDelete(row.LocalId);
                                            }}
                                            className="px-2 py-1 rounded bg-rose-900/60 text-rose-200 hover:bg-rose-800/80"
                                            title="Delete Record"
                                        >
                                            Delete
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            {editingId !== null && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
                    onClick={cancelEdit}
                >
                    <div
                        className="w-full max-w-2xl rounded-xl border border-zinc-700 bg-zinc-950 shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="px-6 py-4 border-b border-zinc-800">
                            <h3 className="text-lg font-semibold text-zinc-100">Edit Student Scores</h3>
                            <p className="text-sm text-zinc-400 mt-1">
                                {editForm.LastName ?? ''}, {editForm.FirstName ?? ''} · {editForm.LocalId ?? ''}
                            </p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 px-6 py-5">
                            <label className="text-sm text-zinc-300">
                                <span className="block mb-2 text-violet-300 font-medium">Previous STAAR</span>
                                <input
                                    type="number"
                                    min={0}
                                    max={100}
                                    step={0.1}
                                    value={editForm.StaarScore ?? ''}
                                    onChange={(e) => handleInputChange(e, 'StaarScore')}
                                    className="w-full bg-black border border-zinc-700 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:ring-1 focus:ring-violet-400"
                                    placeholder="0 - 100"
                                />
                            </label>

                            <label className="text-sm text-zinc-300">
                                <span className="block mb-2 text-amber-300 font-medium">Fall Benchmark</span>
                                <input
                                    type="number"
                                    min={0}
                                    max={100}
                                    step={0.1}
                                    value={editForm.FallScore ?? ''}
                                    onChange={(e) => handleInputChange(e, 'FallScore')}
                                    className="w-full bg-black border border-zinc-700 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:ring-1 focus:ring-amber-400"
                                    placeholder="0 - 100"
                                />
                            </label>

                            <label className="text-sm text-zinc-300">
                                <span className="block mb-2 text-cyan-300 font-medium">Spring Benchmark</span>
                                <input
                                    type="number"
                                    min={0}
                                    max={100}
                                    step={0.1}
                                    value={editForm.SpringScore ?? ''}
                                    onChange={(e) => handleInputChange(e, 'SpringScore')}
                                    className="w-full bg-black border border-zinc-700 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:ring-1 focus:ring-cyan-400"
                                    placeholder="0 - 100"
                                />
                            </label>
                        </div>

                        <div className="px-6 py-4 border-t border-zinc-800 flex flex-wrap items-center justify-between gap-3">
                            <button
                                onClick={async () => {
                                    const localId = editForm.LocalId ?? '';
                                    if (!localId) return;
                                    const didDelete = await handleDelete(localId);
                                    if (didDelete) cancelEdit();
                                }}
                                className="px-3 py-2 rounded bg-rose-900/60 text-rose-200 hover:bg-rose-800/80"
                            >
                                Delete Student
                            </button>

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={cancelEdit}
                                    className="px-3 py-2 rounded bg-zinc-700 text-zinc-100 hover:bg-zinc-600"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={saveEdit}
                                    className="px-3 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-500"
                                >
                                    Save Scores
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

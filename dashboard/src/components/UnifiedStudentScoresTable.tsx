'use client';

import React, { useState, useMemo } from 'react';
import { db, Student } from '@/lib/db';
import { useLiveQuery } from 'dexie-react-hooks';

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


    // Delete handler
    const handleDelete = async (localId: string) => {
        if (!confirm('Are you sure you want to delete this student record from ALL lists? This cannot be undone.')) return;

        try {
            // Delete from local DB by LocalId (using compound index or manual filtering if not indexed unique)
            // Schema has &LocalId, so it is a unique index.
            await db.students.where('LocalId').equals(localId).delete();
        } catch (error) {
            console.error('Delete failed:', error);
            alert('Error deleting record.');
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
        const val = e.target.type === 'number' ? parseFloat(e.target.value) : e.target.value;
        if (isAdd) {
            setAddForm(prev => ({ ...prev, [field]: val }));
        } else {
            setEditForm(prev => ({ ...prev, [field]: val }));
        }
    };
    const getLevelColor = (level: string | null | undefined) => {
        if (!level) return 'text-gray-500';
        if (level.includes('Masters')) return 'text-purple-600 dark:text-purple-400 font-bold';
        if (level.includes('Meets')) return 'text-green-600 dark:text-green-400 font-bold';
        if (level.includes('Approaches')) return 'text-blue-600 dark:text-blue-400 font-medium';
        if (level.includes('Did Not Meet')) return 'text-red-600 dark:text-red-400 font-medium';
        return 'text-gray-600 dark:text-gray-400';
    };

    const renderScoreCell = (score: number | null | undefined, level: string | null | undefined) => {
        if (score === null || score === undefined) return <span className="text-gray-400">-</span>;
        return (
            <div>
                <span className="font-mono text-lg">{score}</span>
                {level && level !== 'Unknown' && (
                    <span className={`ml-2 text-xs uppercase ${getLevelColor(level)}`}>
                        {level}
                    </span>
                )}
            </div>
        );
    };

    if (!students) return <div className="p-4 text-sm text-gray-500">Loading student data...</div>;

    return (
        <div className="mt-8 border rounded-lg overflow-hidden bg-white dark:bg-zinc-900 shadow-sm">
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-zinc-800 border-b border-gray-200 dark:border-zinc-700">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex items-center gap-4 hover:opacity-75 transition"
                >
                    <span className="font-semibold text-lg text-gray-800 dark:text-gray-200">
                        All Student Scores ({students.length})
                    </span>
                    <span className="text-gray-500 text-xs">
                        {isOpen ? '▼' : '▶'}
                    </span>
                </button>
                <div className="flex gap-2">
                    {isOpen && (
                        <>
                            <input
                                type="text"
                                placeholder="Filter by name..."
                                className="text-sm px-3 py-1 rounded border dark:bg-zinc-900 dark:border-zinc-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                value={filterText}
                                onChange={(e) => setFilterText(e.target.value)}
                            />
                            <button
                                onClick={startAdd}
                                className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                            >
                                + Add Row
                            </button>
                        </>
                    )}
                </div>
            </div>

            {isOpen && (
                <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-zinc-700">
                        <thead className="bg-gray-50 dark:bg-zinc-800 sticky top-0 z-10">
                            <tr>
                                <th
                                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-zinc-700"
                                    onClick={() => requestSort('LastName')}
                                >
                                    Student Name {sortConfig?.key === 'LastName' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                </th>
                                <th
                                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-zinc-700"
                                    onClick={() => requestSort('StaarScore')}
                                >
                                    Previous STAAR {sortConfig?.key === 'StaarScore' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                </th>
                                <th
                                    className="px-6 py-3 text-left text-xs font-medium text-orange-600 dark:text-orange-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-zinc-700"
                                    onClick={() => requestSort('FallScore')}
                                >
                                    Fall Benchmark {sortConfig?.key === 'FallScore' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                </th>
                                <th
                                    className="px-6 py-3 text-left text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-zinc-700"
                                    onClick={() => requestSort('SpringScore')}
                                >
                                    Spring Benchmark {sortConfig?.key === 'SpringScore' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-zinc-900 divide-y divide-gray-200 dark:divide-zinc-700">
                            {isAdding && (
                                <tr className="bg-blue-50 dark:bg-blue-900/20">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                        <div className="flex flex-col gap-1">
                                            <input placeholder="Last Name" className="border p-1 rounded text-black" value={addForm.LastName || ''} onChange={e => handleInputChange(e, 'LastName', true)} />
                                            <input placeholder="First Name" className="border p-1 rounded text-black" value={addForm.FirstName || ''} onChange={e => handleInputChange(e, 'FirstName', true)} />
                                            <input placeholder="ID" className="border p-1 rounded text-black text-xs" value={addForm.LocalId || ''} onChange={e => handleInputChange(e, 'LocalId', true)} />
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                        <input type="number" placeholder="STAAR" className="w-16 border p-1 rounded text-black" value={addForm.StaarScore || ''} onChange={e => handleInputChange(e, 'StaarScore', true)} />
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                        <input type="number" placeholder="Fall" className="w-16 border p-1 rounded text-black" value={addForm.FallScore || ''} onChange={e => handleInputChange(e, 'FallScore', true)} />
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                        <input type="number" placeholder="Spring" className="w-16 border p-1 rounded text-black" value={addForm.SpringScore || ''} onChange={e => handleInputChange(e, 'SpringScore', true)} />
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <button onClick={saveAdd} className="text-green-600 mr-2">Save</button>
                                        <button onClick={cancelAdd} className="text-gray-500">Cancel</button>
                                    </td>
                                </tr>
                            )}
                            {sortedData.map((row) => (
                                <tr key={row.LocalId} className="hover:bg-gray-50 dark:hover:bg-zinc-800 group">
                                    {editingId === row.id ? (
                                        <>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                <div className="flex flex-col gap-1">
                                                    <input className="border p-1 rounded text-black" value={editForm.LastName || ''} onChange={e => handleInputChange(e, 'LastName')} />
                                                    <input className="border p-1 rounded text-black" value={editForm.FirstName || ''} onChange={e => handleInputChange(e, 'FirstName')} />
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                <input type="number" className="w-16 border p-1 rounded text-black" value={editForm.StaarScore || ''} onChange={e => handleInputChange(e, 'StaarScore')} />
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                <input type="number" className="w-16 border p-1 rounded text-black" value={editForm.FallScore || ''} onChange={e => handleInputChange(e, 'FallScore')} />
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                <input type="number" className="w-16 border p-1 rounded text-black" value={editForm.SpringScore || ''} onChange={e => handleInputChange(e, 'SpringScore')} />
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                <button onClick={saveEdit} className="text-green-600 mr-2">💾</button>
                                                <button onClick={cancelEdit} className="text-gray-500">✕</button>
                                            </td>
                                        </>
                                    ) : (
                                        <>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                                                <div className="font-medium">{row.LastName}, {row.FirstName}</div>
                                                <div className="text-xs text-gray-400">{row.LocalId}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                                                {renderScoreCell(row.StaarScore, row.StaarLevel)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                {renderScoreCell(row.FallScore, row.FallLevel)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                {renderScoreCell(row.SpringScore, row.SpringLevel)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                <button onClick={() => startEdit(row)} className="text-blue-400 hover:text-blue-600 mr-2 opacity-0 group-hover:opacity-100 transition-opacity">✎</button>
                                                <button
                                                    onClick={() => handleDelete(row.LocalId)}
                                                    className="text-red-400 hover:text-red-900 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    title="Delete Record"
                                                >
                                                    🗑️
                                                </button>
                                            </td>
                                        </>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

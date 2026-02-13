'use client';

import React, { useEffect, useState, useMemo } from 'react';

interface UnifiedScoreRecord {
    LocalId: string;
    FirstName: string | null;
    LastName: string | null;
    StaarScore: number | null;
    StaarLevel: string | null;
    FallScore: number | null;
    FallLevel: string | null;
    SpringScore: number | null;
    SpringLevel: string | null;
}

interface EditDraft {
    StaarScore: string;
    FallScore: string;
    SpringScore: string;
}

type ExportType = 'spring' | 'fall' | 'previous';

export function UnifiedStudentScoresTable() {
    const [data, setData] = useState<UnifiedScoreRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [isOpen, setIsOpen] = useState(false);
    const [editingLocalId, setEditingLocalId] = useState<string | null>(null);
    const [editDraft, setEditDraft] = useState<EditDraft | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // Sort & Filter state
    const [filterText, setFilterText] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: keyof UnifiedScoreRecord; direction: 'asc' | 'desc' } | null>(null);

    // Listen for refresh events
    useEffect(() => {
        fetchData();
        const handleRefresh = (e: Event) => {
            const customEvent = e as CustomEvent;
            if (customEvent.detail?.action === 'refresh') {
                fetchData();
            }
        };
        window.addEventListener('tambo-action', handleRefresh);
        return () => window.removeEventListener('tambo-action', handleRefresh);
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/student-scores');
            if (res.ok) {
                const json = await res.json();
                setData(json);
            }
        } catch (error) {
            console.error('Failed to fetch student scores:', error);
        } finally {
            setLoading(false);
        }
    };

    const toInputValue = (score: number | null): string => (score === null ? '' : String(score));

    const startEdit = (row: UnifiedScoreRecord) => {
        setEditingLocalId(row.LocalId);
        setEditDraft({
            StaarScore: toInputValue(row.StaarScore),
            FallScore: toInputValue(row.FallScore),
            SpringScore: toInputValue(row.SpringScore),
        });
    };

    const cancelEdit = () => {
        setEditingLocalId(null);
        setEditDraft(null);
    };

    const parseScoreInput = (rawValue: string): number | null => {
        const trimmed = rawValue.trim();
        if (trimmed === '') return null;
        const parsed = Number(trimmed);
        if (Number.isNaN(parsed) || parsed < 0 || parsed > 100) {
            throw new Error('Scores must be between 0 and 100.');
        }
        return parsed;
    };

    const handleSave = async (row: UnifiedScoreRecord) => {
        if (!editDraft || isSaving) return;

        try {
            setIsSaving(true);

            const staarScore = parseScoreInput(editDraft.StaarScore);
            const fallScore = parseScoreInput(editDraft.FallScore);
            const springScore = parseScoreInput(editDraft.SpringScore);

            const hasStaarChanged = staarScore !== row.StaarScore;
            const hasFallChanged = fallScore !== row.FallScore;
            const hasSpringChanged = springScore !== row.SpringScore;

            if (!hasStaarChanged && !hasFallChanged && !hasSpringChanged) {
                cancelEdit();
                return;
            }

            const payload: {
                localId: string;
                firstName?: string | null;
                lastName?: string | null;
                staarScore?: number | null;
                fallScore?: number | null;
                springScore?: number | null;
            } = {
                localId: row.LocalId,
                firstName: row.FirstName,
                lastName: row.LastName,
            };

            if (hasStaarChanged) payload.staarScore = staarScore;
            if (hasFallChanged) payload.fallScore = fallScore;
            if (hasSpringChanged) payload.springScore = springScore;

            const saveRes = await fetch('/api/student-scores', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const saveJson = await saveRes.json().catch(() => null);
            if (!saveRes.ok || saveJson?.success === false) {
                throw new Error(saveJson?.error || 'Failed to save score updates.');
            }

            await fetchData();
            cancelEdit();
        } catch (error) {
            console.error('Failed to save score edits:', error);
            alert(error instanceof Error ? error.message : 'Failed to save score edits.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (localId: string): Promise<boolean> => {
        if (!confirm('Are you sure you want to delete this student record from ALL lists? This cannot be undone.')) return false;

        try {
            const res = await fetch('/api/student-scores', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ localId }),
            });

            if (res.ok) {
                // Remove from local state immediately
                setData(prev => prev.filter(r => r.LocalId !== localId));
                if (editingLocalId === localId) {
                    cancelEdit();
                }
                return true;
            } else {
                alert('Failed to delete record.');
                return false;
            }
        } catch (error) {
            console.error('Delete failed:', error);
            alert('Error deleting record.');
            return false;
        }
    };

    const requestSort = (key: keyof UnifiedScoreRecord) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const sortedData = useMemo(() => {
        let sortableItems = [...data];

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

                if (aVal === null) return 1;
                if (bVal === null) return -1;

                if (aVal! < bVal!) {
                    return sortConfig.direction === 'asc' ? -1 : 1;
                }
                if (aVal! > bVal!) {
                    return sortConfig.direction === 'asc' ? 1 : -1;
                }
                return 0;
            });
        }
        return sortableItems;
    }, [data, sortConfig, filterText]);

    const editingRow = useMemo(
        () => (editingLocalId ? data.find(row => row.LocalId === editingLocalId) ?? null : null),
        [data, editingLocalId],
    );

    const getLevelColor = (level: string | null) => {
        if (!level) return 'text-gray-500';
        if (level.includes('Masters')) return 'text-purple-600 dark:text-purple-400 font-bold';
        if (level.includes('Meets')) return 'text-green-600 dark:text-green-400 font-bold';
        if (level.includes('Approaches')) return 'text-blue-600 dark:text-blue-400 font-medium';
        if (level.includes('Did Not Meet')) return 'text-red-600 dark:text-red-400 font-medium';
        return 'text-gray-600 dark:text-gray-400';
    };

    const renderScoreCell = (score: number | null, level: string | null) => {
        if (score === null) return <span className="text-gray-400">-</span>;
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
        const exportConfig: Record<ExportType, { label: string; scoreKey: keyof UnifiedScoreRecord; levelKey: keyof UnifiedScoreRecord }> = {
            spring: { label: 'spring_scores', scoreKey: 'SpringScore', levelKey: 'SpringLevel' },
            fall: { label: 'fall_scores', scoreKey: 'FallScore', levelKey: 'FallLevel' },
            previous: { label: 'previous_staar_scores', scoreKey: 'StaarScore', levelKey: 'StaarLevel' },
        };

        const { label, scoreKey, levelKey } = exportConfig[type];
        const rows = data
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

    if (loading && data.length === 0) return <div className="p-4 text-sm text-gray-500">Loading student data...</div>;
    // Don't hide if empty, show tools so user knows it's empty

    return (
        <div className="mt-8 border rounded-lg overflow-hidden bg-white dark:bg-zinc-900 shadow-sm">
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-zinc-800 border-b border-gray-200 dark:border-zinc-700">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex items-center gap-4 hover:opacity-75 transition"
                >
                    <span className="font-semibold text-lg text-gray-800 dark:text-gray-200">
                        All Student Scores ({data.length})
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
                                onClick={() => handleExport('spring')}
                                className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded hover:bg-blue-200"
                            >
                                Export Spring
                            </button>
                            <button
                                onClick={() => handleExport('fall')}
                                className="px-3 py-1 bg-orange-100 text-orange-800 text-sm rounded hover:bg-orange-200"
                            >
                                Export Fall
                            </button>
                            <button
                                onClick={() => handleExport('previous')}
                                className="px-3 py-1 bg-purple-100 text-purple-800 text-sm rounded hover:bg-purple-200"
                            >
                                Export Previous STAAR
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
                            {sortedData.map((row) => (
                                <tr
                                    key={row.LocalId}
                                    className="hover:bg-gray-50 dark:hover:bg-zinc-800 group cursor-pointer"
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
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                void handleDelete(row.LocalId);
                                            }}
                                            className="text-red-400 hover:text-red-900 opacity-0 group-hover:opacity-100 transition-opacity"
                                            title="Delete Record"
                                        >
                                            🗑️
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            {editingRow && editDraft && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                    onClick={() => {
                        if (!isSaving) cancelEdit();
                    }}
                >
                    <div
                        className="w-full max-w-2xl rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="px-6 py-4 border-b border-gray-200 dark:border-zinc-700">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Edit Student Scores</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                {editingRow.LastName}, {editingRow.FirstName} · {editingRow.LocalId}
                            </p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 px-6 py-5">
                            <label className="text-sm text-gray-700 dark:text-gray-300">
                                <span className="block mb-2 text-purple-600 dark:text-purple-300 font-medium">Previous STAAR</span>
                                <input
                                    type="number"
                                    min={0}
                                    max={100}
                                    step={0.1}
                                    value={editDraft.StaarScore}
                                    onChange={(e) => setEditDraft(prev => (prev ? { ...prev, StaarScore: e.target.value } : prev))}
                                    className="w-full bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-700 rounded px-3 py-2 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-purple-400"
                                    placeholder="0 - 100"
                                />
                            </label>

                            <label className="text-sm text-gray-700 dark:text-gray-300">
                                <span className="block mb-2 text-orange-600 dark:text-orange-300 font-medium">Fall Benchmark</span>
                                <input
                                    type="number"
                                    min={0}
                                    max={100}
                                    step={0.1}
                                    value={editDraft.FallScore}
                                    onChange={(e) => setEditDraft(prev => (prev ? { ...prev, FallScore: e.target.value } : prev))}
                                    className="w-full bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-700 rounded px-3 py-2 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-orange-400"
                                    placeholder="0 - 100"
                                />
                            </label>

                            <label className="text-sm text-gray-700 dark:text-gray-300">
                                <span className="block mb-2 text-blue-600 dark:text-blue-300 font-medium">Spring Benchmark</span>
                                <input
                                    type="number"
                                    min={0}
                                    max={100}
                                    step={0.1}
                                    value={editDraft.SpringScore}
                                    onChange={(e) => setEditDraft(prev => (prev ? { ...prev, SpringScore: e.target.value } : prev))}
                                    className="w-full bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-700 rounded px-3 py-2 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-400"
                                    placeholder="0 - 100"
                                />
                            </label>
                        </div>

                        <div className="px-6 py-4 border-t border-gray-200 dark:border-zinc-700 flex flex-wrap items-center justify-between gap-3">
                            <button
                                onClick={async () => {
                                    const didDelete = await handleDelete(editingRow.LocalId);
                                    if (didDelete) {
                                        cancelEdit();
                                    }
                                }}
                                disabled={isSaving}
                                className="px-3 py-2 rounded bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/40 dark:text-red-200 dark:hover:bg-red-800/60 disabled:opacity-60"
                            >
                                Delete Student
                            </button>

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={cancelEdit}
                                    disabled={isSaving}
                                    className="px-3 py-2 rounded bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-zinc-700 dark:text-gray-100 dark:hover:bg-zinc-600 disabled:opacity-60"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => handleSave(editingRow)}
                                    disabled={isSaving}
                                    className="px-3 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-60"
                                >
                                    {isSaving ? 'Saving...' : 'Save Scores'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

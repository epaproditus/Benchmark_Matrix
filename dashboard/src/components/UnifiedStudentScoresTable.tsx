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

    const handleDelete = async (localId: string) => {
        if (!confirm('Are you sure you want to delete this student record from ALL lists? This cannot be undone.')) return;

        try {
            const res = await fetch('/api/student-scores', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ localId }),
            });

            if (res.ok) {
                // Remove from local state immediately
                setData(prev => prev.filter(r => r.LocalId !== localId));
            } else {
                alert('Failed to delete record.');
            }
        } catch (error) {
            console.error('Delete failed:', error);
            alert('Error deleting record.');
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

    const getLevelColor = (level: string | null) => {
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

    const renderScoreCell = (score: number | null, level: string | null, column: 'staar' | 'fall' | 'spring') => {
        if (score === null) return <span className="text-zinc-500">-</span>;
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

    if (loading && data.length === 0) return <div className="p-4 text-sm text-gray-500">Loading student data...</div>;
    // Don't hide if empty, show tools so user knows it's empty

    return (
        <div className="mt-8 border border-zinc-700 rounded-lg overflow-hidden bg-black shadow-sm">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between p-4 bg-zinc-900 hover:bg-zinc-800 transition"
            >
                <div className="flex items-center gap-4">
                    <span className="font-semibold text-lg text-zinc-100">
                        All Student Scores ({data.length})
                    </span>
                    {isOpen && (
                        <input
                            type="text"
                            placeholder="Filter by name..."
                            className="text-sm px-3 py-1 rounded border border-zinc-700 bg-black text-zinc-100 focus:outline-none focus:ring-1 focus:ring-cyan-400"
                            value={filterText}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => setFilterText(e.target.value)}
                        />
                    )}
                </div>
                <span className="text-zinc-400">
                    {isOpen ? '▼' : '▶'}
                </span>
            </button>

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
                            {sortedData.map((row) => (
                                <tr key={row.LocalId} className="hover:bg-zinc-900/70 group">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-200">
                                        <div className="font-medium">{row.LastName}, {row.FirstName}</div>
                                        <div className="text-xs text-zinc-500">{row.LocalId}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                        {editingLocalId === row.LocalId && editDraft ? (
                                            <input
                                                type="number"
                                                min={0}
                                                max={100}
                                                step={0.1}
                                                value={editDraft.StaarScore}
                                                onChange={(e) => setEditDraft(prev => prev ? { ...prev, StaarScore: e.target.value } : prev)}
                                                className="w-24 bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-zinc-100 focus:outline-none focus:ring-1 focus:ring-violet-400"
                                            />
                                        ) : (
                                            renderScoreCell(row.StaarScore, row.StaarLevel, 'staar')
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                        {editingLocalId === row.LocalId && editDraft ? (
                                            <input
                                                type="number"
                                                min={0}
                                                max={100}
                                                step={0.1}
                                                value={editDraft.FallScore}
                                                onChange={(e) => setEditDraft(prev => prev ? { ...prev, FallScore: e.target.value } : prev)}
                                                className="w-24 bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-zinc-100 focus:outline-none focus:ring-1 focus:ring-amber-400"
                                            />
                                        ) : (
                                            renderScoreCell(row.FallScore, row.FallLevel, 'fall')
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                        {editingLocalId === row.LocalId && editDraft ? (
                                            <input
                                                type="number"
                                                min={0}
                                                max={100}
                                                step={0.1}
                                                value={editDraft.SpringScore}
                                                onChange={(e) => setEditDraft(prev => prev ? { ...prev, SpringScore: e.target.value } : prev)}
                                                className="w-24 bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-zinc-100 focus:outline-none focus:ring-1 focus:ring-cyan-400"
                                            />
                                        ) : (
                                            renderScoreCell(row.SpringScore, row.SpringLevel, 'spring')
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        {editingLocalId === row.LocalId ? (
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    onClick={() => handleSave(row)}
                                                    disabled={isSaving}
                                                    className="px-2 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-60"
                                                    title="Save Edits"
                                                >
                                                    {isSaving ? 'Saving...' : 'Save'}
                                                </button>
                                                <button
                                                    onClick={cancelEdit}
                                                    disabled={isSaving}
                                                    className="px-2 py-1 rounded bg-zinc-700 text-zinc-100 hover:bg-zinc-600 disabled:opacity-60"
                                                    title="Cancel"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => startEdit(row)}
                                                    className="px-2 py-1 rounded bg-zinc-700 text-zinc-100 hover:bg-zinc-600"
                                                    title="Edit Scores"
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(row.LocalId)}
                                                    className="text-rose-400 hover:text-rose-300"
                                                    title="Delete Record"
                                                >
                                                    🗑️
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

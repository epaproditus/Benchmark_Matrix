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

export function UnifiedStudentScoresTable() {
    const [data, setData] = useState<UnifiedScoreRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [isOpen, setIsOpen] = useState(false);

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

    if (loading && data.length === 0) return <div className="p-4 text-sm text-gray-500">Loading student data...</div>;
    // Don't hide if empty, show tools so user knows it's empty

    return (
        <div className="mt-8 border rounded-lg overflow-hidden bg-white dark:bg-zinc-900 shadow-sm">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-zinc-800 hover:bg-gray-100 dark:hover:bg-zinc-700 transition"
            >
                <div className="flex items-center gap-4">
                    <span className="font-semibold text-lg text-gray-800 dark:text-gray-200">
                        All Student Scores ({data.length})
                    </span>
                    {isOpen && (
                        <input
                            type="text"
                            placeholder="Filter by name..."
                            className="text-sm px-3 py-1 rounded border dark:bg-zinc-900 dark:border-zinc-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            value={filterText}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => setFilterText(e.target.value)}
                        />
                    )}
                </div>
                <span className="text-gray-500">
                    {isOpen ? '▼' : '▶'}
                </span>
            </button>

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
                                <tr key={row.LocalId} className="hover:bg-gray-50 dark:hover:bg-zinc-800 group">
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
                                            onClick={() => handleDelete(row.LocalId)}
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
        </div>
    );
}

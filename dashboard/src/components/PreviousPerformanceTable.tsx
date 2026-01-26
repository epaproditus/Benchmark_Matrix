'use client';

import React, { useEffect, useState } from 'react';

interface PreviousPerformanceRecord {
    LocalId: string;
    FirstName: string | null;
    LastName: string | null;
    Score: number | null;
    Subject: string | null;
}

export function PreviousPerformanceTable() {
    const [data, setData] = useState<PreviousPerformanceRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [isOpen, setIsOpen] = useState(false);

    // Listen for refresh events from Tambo
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
            const res = await fetch('/api/previous-performance');
            if (res.ok) {
                const json = await res.json();
                setData(json);
            }
        } catch (error) {
            console.error('Failed to fetch previous performance:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading && data.length === 0) return <div className="p-4 text-sm text-gray-500">Loading previous performance...</div>;
    if (!loading && data.length === 0) return null; // Hide if empty

    return (
        <div className="mt-8 border rounded-lg overflow-hidden bg-white dark:bg-zinc-900 shadow-sm">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-zinc-800 hover:bg-gray-100 dark:hover:bg-zinc-700 transition"
            >
                <span className="font-semibold text-lg text-gray-800 dark:text-gray-200">
                    Previous Performance Data ({data.length})
                </span>
                <span className="text-gray-500">
                    {isOpen ? '▼' : '▶'}
                </span>
            </button>

            {isOpen && (
                <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-zinc-700">
                        <thead className="bg-gray-50 dark:bg-zinc-800 sticky top-0">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Local ID</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Score</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-zinc-900 divide-y divide-gray-200 dark:divide-zinc-700">
                            {data.map((row) => (
                                <tr key={row.LocalId} className="hover:bg-gray-50 dark:hover:bg-zinc-800">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300 font-mono">
                                        {row.LocalId}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                                        {row.LastName}, {row.FirstName}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 capitalize">
                                        {row.Subject || '-'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-blue-600 dark:text-blue-400">
                                        {row.Score}
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

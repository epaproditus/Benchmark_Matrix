'use client';

import PerformanceSettings from '@/components/PerformanceSettings';
import Link from 'next/link';
import { CSVImport } from '@/components/CSVImport';
import { db } from '@/lib/db';

export default function SettingsPage() {
    return (
        <main className="container mx-auto p-4 max-w-4xl">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold">Configuration</h1>
                <Link href="/" className="px-4 py-2 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700 transition-colors text-sm font-medium">
                    ← Back to Dashboard
                </Link>
            </div>

            <div className="space-y-12">
                <section>
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold text-zinc-400 uppercase tracking-widest text-xs">Data Management</h2>
                        <button
                            onClick={async () => {
                                if (confirm('Are you sure you want to wipe all student data? This cannot be undone.')) {
                                    await db.students.clear();
                                    window.location.reload();
                                }
                            }}
                            className="text-xs text-red-500 hover:text-red-400 transition-colors font-medium border border-red-900/30 px-2 py-1 rounded"
                        >
                            Reset Database
                        </button>
                    </div>
                    <CSVImport />
                </section>

                <section>
                    <h2 className="text-xl font-bold mb-4 text-zinc-400 uppercase tracking-widest text-xs">Performance Metrics</h2>
                    <PerformanceSettings />
                </section>

            </div>
        </main>
    );
}

'use client';
import { useState } from 'react';
import { db, Student } from '@/lib/db';

export function CSVImport() {
    const importId = 'csv-import-' + Math.random().toString(36).substr(2, 9);
    const [importing, setImporting] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setImporting(true);
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const text = event.target?.result as string;
                const lines = text.split('\n');
                if (lines.length < 2) throw new Error('File is empty or missing headers');

                const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

                const studentsToImport: Student[] = [];

                for (let i = 1; i < lines.length; i++) {
                    if (!lines[i].trim()) continue;
                    // Handle quoted values if simple split fails? For now simple split.
                    const values = lines[i].split(',').map(v => v.trim());
                    // Partial student object, using 'any' to build it up then cast
                    const student: any = {};

                    headers.forEach((header, index) => {
                        const val = values[index];
                        if (!val) return;

                        // Flexible mapping to PascalCase schema
                        if (header.includes('local') && header.includes('id')) student.LocalId = val;
                        else if (header.includes('first')) student.FirstName = val;
                        else if (header.includes('last')) student.LastName = val;
                        else if (header.includes('grade')) student.Grade = val;
                        else if (header.includes('teacher')) student.Teacher = val;
                        else if (header.includes('campus')) student.Campus = val;
                        else if (header.includes('staar_score') || (header.includes('staar') && header.includes('score'))) student.StaarScore = parseInt(val) || 0;
                        else if (header.includes('fall') && header.includes('score')) student.FallScore = parseInt(val) || 0;
                        else if (header.includes('spring') && header.includes('score')) student.SpringScore = parseInt(val) || 0;
                        // Level mappings if present in CSV
                        else if (header.includes('staar') && header.includes('level')) student.StaarLevel = val;
                        else if (header.includes('fall') && header.includes('level')) student.FallLevel = val;
                        else if (header.includes('spring') && header.includes('level')) student.SpringLevel = val;
                    });

                    // Required fields check
                    if (student.LocalId) {
                        studentsToImport.push(student as Student);
                    }
                }

                if (studentsToImport.length === 0) {
                    throw new Error('No valid student records found (LocalId is required).');
                }

                await db.transaction('rw', db.students, async () => {
                    for (const student of studentsToImport) {
                        const existing = await db.students.where('LocalId').equals(student.LocalId).first();
                        if (existing?.id) {
                            await db.students.update(existing.id, student);
                        } else {
                            await db.students.add(student);
                        }
                    }
                });

                setMessage({ type: 'success', text: `Successfully imported ${studentsToImport.length} students!` });
                // No need to dispatch event, useLiveQuery handles updates
            } catch (error) {
                console.error('Import error:', error);
                setMessage({ type: 'error', text: 'Failed to parse CSV file: ' + (error as Error).message });
            } finally {
                setImporting(false);
                // Reset input value to allow re-upload of same file
                e.target.value = '';
            }
        };
        reader.readAsText(file);
    };

    return (
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8">
            <h2 className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-6">Import Student Data (CSV)</h2>
            <div className="space-y-4">
                <p className="text-sm text-zinc-400">Upload a CSV file with headers like: Local ID, First Name, Last Name, Grade, Teacher, Fall Score, etc.</p>
                <div className="relative">
                    <input
                        id={importId}
                        type="file"
                        accept=".csv"
                        onChange={handleFileChange}
                        disabled={importing}
                        className="block w-full text-sm text-zinc-400 file:mr-4 file:py-3 file:px-6 file:rounded-2xl file:border-0 file:text-sm file:font-black file:bg-white file:text-black hover:file:bg-zinc-200 cursor-pointer transition-all"
                    />
                </div>
                {message && (
                    <p className={`text-xs font-bold ${message.type === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>
                        {message.text}
                    </p>
                )}
            </div>
        </div>
    );
}

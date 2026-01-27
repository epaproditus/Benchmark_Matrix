'use client';
import { useState } from 'react';
import { db, Student } from '@/lib/db';

export function CSVImport() {
    const importId = 'csv-import-' + Math.random().toString(36).substr(2, 9);
    const [importing, setImporting] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const processData = async (text: string) => {
        setImporting(true);
        try {
            const lines = text.split('\n').filter(l => l.trim());
            if (lines.length < 2) throw new Error('Input is empty or missing headers');

            // Detect delimiter: Tab if present, otherwise comma
            const firstLine = lines[0];
            const delimiter = firstLine.includes('\t') ? '\t' : ',';
            const headers = firstLine.split(delimiter).map(h => h.trim().toLowerCase());

            const studentsToImport: Student[] = [];

            for (let i = 1; i < lines.length; i++) {
                const values = lines[i].split(delimiter).map(v => v.trim());
                const student: any = {};

                headers.forEach((header, index) => {
                    const val = values[index];
                    if (!val) return;

                    if (header.includes('local') && header.includes('id')) student.LocalId = val;
                    else if (header.includes('first')) student.FirstName = val;
                    else if (header.includes('last')) student.LastName = val;
                    else if (header.includes('grade')) student.Grade = val;
                    else if (header.includes('teacher')) student.Teacher = val;
                    else if (header.includes('campus')) student.Campus = val;
                    else if (header.includes('staar_score') || (header.includes('staar') && header.includes('score'))) student.StaarScore = parseInt(val) || 0;
                    else if (header.includes('fall') && header.includes('score')) student.FallScore = parseInt(val) || 0;
                    else if (header.includes('spring') && header.includes('score')) student.SpringScore = parseInt(val) || 0;
                    else if (header.includes('staar') && header.includes('level')) student.StaarLevel = val;
                    else if (header.includes('fall') && header.includes('level')) student.FallLevel = val;
                    else if (header.includes('spring') && header.includes('level')) student.SpringLevel = val;
                });

                if (student.LocalId) {
                    studentsToImport.push(student as Student);
                }
            }

            if (studentsToImport.length === 0) {
                throw new Error('No valid student records found (LocalId column required).');
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

            setMessage({ type: 'success', text: `Successfully processed ${studentsToImport.length} students!` });
        } catch (error) {
            console.error('Processing error:', error);
            setMessage({ type: 'error', text: 'Error: ' + (error as Error).message });
        } finally {
            setImporting(false);
        }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target?.result as string;
            processData(text);
            e.target.value = '';
        };
        reader.readAsText(file);
    };

    return (
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 space-y-8">
            <div>
                <h2 className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-6">Option 1: Paste from Spreadsheet</h2>
                <div className="space-y-4">
                    <p className="text-sm text-zinc-400">Copy your data from Google Sheets or Excel (including headers) and paste it here.</p>
                    <textarea
                        placeholder="Paste data here..."
                        className="w-full h-32 bg-black text-white p-4 rounded-2xl border border-zinc-800 focus:border-white/50 outline-none text-xs font-mono transition-all"
                        onChange={(e) => {
                            if (e.target.value.includes('\n')) {
                                processData(e.target.value);
                                e.target.value = '';
                            }
                        }}
                    />
                </div>
            </div>

            <div className="relative">
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                    <div className="w-full border-t border-zinc-800"></div>
                </div>
                <div className="relative flex justify-center">
                    <span className="bg-zinc-900 px-4 text-xs font-black uppercase tracking-widest text-zinc-600">OR</span>
                </div>
            </div>

            <div>
                <h2 className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-6">Option 2: Upload CSV File</h2>
                <div className="space-y-4">
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
                </div>
            </div>

            {message && (
                <div className={`p-4 rounded-2xl text-xs font-bold text-center ${message.type === 'success' ? 'bg-emerald-900/20 text-emerald-400 border border-emerald-900/50' : 'bg-red-900/20 text-red-400 border border-red-900/50'}`}>
                    {message.text}
                </div>
            )}
        </div>
    );
}

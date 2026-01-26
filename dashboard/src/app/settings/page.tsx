import PerformanceSettings from '@/components/PerformanceSettings';
import Link from 'next/link';

export default function SettingsPage() {
    return (
        <main className="container mx-auto p-4">
            <div className="flex justify-between items-center mb-4">
                <h1 className="text-2xl font-bold">Configuration</h1>
                <Link href="/" className="px-4 py-2 bg-black text-white rounded hover:bg-gray-800 transition-colors">
                    ← Back to Dashboard
                </Link>
            </div>
            <PerformanceSettings />
        </main>
    );
}

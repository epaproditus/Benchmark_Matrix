import PerformanceMatrix from '@/components/PerformanceMatrix';

export default function Home() {
  return (
    <main className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Student Performance Dashboard</h1>
        <a href="/settings" className="p-2 text-gray-500 hover:text-black transition-colors" title="Settings">
          ⚙️ Configuration
        </a>
      </div>
      <PerformanceMatrix />
    </main>
  );
}
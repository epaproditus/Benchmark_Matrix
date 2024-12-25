import PerformanceMatrix from '@/components/PerformanceMatrix';

export default function Home() {
  return (
    <main className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Student Performance Dashboard</h1>
      <PerformanceMatrix />
    </main>
  );
}
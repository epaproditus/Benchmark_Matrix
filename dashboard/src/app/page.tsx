import PerformanceMatrix from '@/components/PerformanceMatrix';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';

export default async function Home() {
  const session = await auth();
  if (!session?.user?.email) {
    redirect('/login');
  }

  return (
    <main className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Student Performance Dashboard</h1>
      <PerformanceMatrix />
    </main>
  );
}

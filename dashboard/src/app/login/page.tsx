'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError('Invalid email or password.');
      setSubmitting(false);
      return;
    }

    router.push('/');
    router.refresh();
  };

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-md bg-black border border-zinc-800 rounded-xl p-6 space-y-4">
        <h1 className="text-2xl font-bold">Teacher Login</h1>
        <p className="text-sm text-zinc-400">Sign in to open your dashboard scope.</p>

        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium">Email</label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 outline-none focus:ring-1 focus:ring-cyan-400"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="password" className="text-sm font-medium">Password</label>
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 outline-none focus:ring-1 focus:ring-cyan-400"
          />
        </div>

        {error ? <p className="text-sm text-rose-400">{error}</p> : null}

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-2 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 font-semibold"
        >
          {submitting ? 'Signing In...' : 'Sign In'}
        </button>
      </form>
    </main>
  );
}

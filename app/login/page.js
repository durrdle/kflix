// app/login/page.js
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { auth } from '../firebaseConfig';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const router = useRouter();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push('/');
    } catch (err) {
      setError('Invalid email or password.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden">
      <div className="relative flex min-h-screen items-center justify-center px-6 py-10">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-600/10 blur-[120px]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(239,68,68,0.08),transparent_35%)]" />
        </div>

        <Link
          href="/"
          className="absolute left-8 top-8 text-3xl font-bold text-red-600 transition hover:scale-105"
        >
          KFlix
        </Link>

        <div className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border-[1.5px] border-red-500/50 bg-gradient-to-b from-gray-800 to-gray-900 shadow-[0_12px_35px_rgba(0,0,0,0.55)]">
          <div className="border-b border-red-500/25 bg-red-600/10 px-6 py-4">
            <h1 className="text-lg font-semibold uppercase tracking-[0.18em] text-red-400 md:text-xl">
              Login
            </h1>
          </div>

          <form onSubmit={handleLogin} className="space-y-5 px-6 py-6">
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-red-400">
                Email
              </label>
              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 w-full rounded-md border border-white/10 bg-black/20 px-4 text-white placeholder:text-gray-400 focus:outline-none focus:border-red-500/50 focus:shadow-[0_0_10px_rgba(255,0,0,0.25)]"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-red-400">
                Password
              </label>
              <input
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 w-full rounded-md border border-white/10 bg-black/20 px-4 text-white placeholder:text-gray-400 focus:outline-none focus:border-red-500/50 focus:shadow-[0_0_10px_rgba(255,0,0,0.25)]"
                required
              />
            </div>

            {error && (
              <div className="rounded-md border border-red-500/30 bg-red-600/10 px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className={`flex h-11 w-full items-center justify-center rounded-md text-sm font-semibold transition active:scale-95 ${
                loading
                  ? 'cursor-not-allowed bg-red-600/70 text-white/80'
                  : 'bg-red-600 text-white hover:bg-red-700 hover:shadow-inner hover:shadow-red-500/60'
              }`}
            >
              {loading ? 'Logging In...' : 'Log In'}
            </button>

            <p className="pt-1 text-center text-sm text-gray-400">
              Contact Ser Wallace to get your account set up.{' '}
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
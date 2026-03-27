'use client';

import Link from 'next/link';

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-black px-6 py-16 text-white">
      <div className="mx-auto max-w-2xl">
        <div className="overflow-hidden rounded-2xl border border-red-500/40 bg-gradient-to-b from-gray-900 to-black shadow-[0_12px_35px_rgba(0,0,0,0.55)]">
          <div className="border-b border-red-500/20 bg-red-600/10 px-8 py-6">
            <h1 className="text-3xl font-bold text-red-400 md:text-4xl">Contact</h1>
            <p className="mt-2 text-sm text-gray-400">
              Always make sure to include your unique User ID when reaching out to us.
            </p>
          </div>

          <div className="space-y-6 px-8 py-8">
            <div className="rounded-xl border border-white/10 bg-white/5 p-5">
              <h2 className="text-lg font-semibold text-white">Support Email</h2>
              <p className="mt-2 text-gray-400">
                For support, questions, reports, or account-related issues, email us at:
              </p>
              <a
                href="mailto:support@kflix.xyz"
                className="mt-4 inline-block text-lg font-medium text-red-400 transition hover:text-red-300"
              >
                support@kflixstreaming.xyz
              </a>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-5">
              <h2 className="text-lg font-semibold text-white">Response Times</h2>
              <p className="mt-2 text-gray-400">
                Usual response time is around 24h, send a new E-Mail when you have not heard back within that time.
              </p>
            </div>

            <div className="border-t border-white/10 pt-6">
              <Link
                href="/"
                className="inline-flex rounded-lg border border-red-500/40 bg-red-600/10 px-4 py-2 text-sm text-red-300 transition hover:bg-red-600/20 hover:text-red-200"
              >
                ← Back to Home
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
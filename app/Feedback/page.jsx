'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function FeedbackPage() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    type: 'General Feedback',
    message: '',
  });

  const [status, setStatus] = useState(null); // null | 'loading' | 'success' | 'error'

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setStatus('loading');

    try {
      // 🔥 TEMP: simulate API call
      await new Promise((res) => setTimeout(res, 1200));

      // ✅ SUCCESS
      setStatus('success');

      // reset form
      setForm({
        name: '',
        email: '',
        type: 'General Feedback',
        message: '',
      });
    } catch (err) {
      setStatus('error');
    }
  };

  return (
    <div className="min-h-screen bg-black px-6 py-16 text-white">
      <div className="mx-auto max-w-2xl">
        <div className="overflow-hidden rounded-2xl border border-red-500/40 bg-gradient-to-b from-gray-900 to-black shadow-[0_12px_35px_rgba(0,0,0,0.55)]">
          
          {/* HEADER */}
          <div className="border-b border-red-500/20 bg-red-600/10 px-8 py-6">
            <h1 className="text-3xl font-bold text-red-400 md:text-4xl">
              Feedback
            </h1>
            <p className="mt-2 text-sm text-gray-400">
              Help us improve KFlix.
            </p>
          </div>

          <div className="space-y-6 px-8 py-8">

            {/* SUCCESS MESSAGE */}
            {status === 'success' && (
              <div className="rounded-xl border border-green-500/40 bg-green-500/10 p-4 text-green-300">
                ✅ Your feedback has been sent successfully!
              </div>
            )}

            {/* ERROR MESSAGE */}
            {status === 'error' && (
              <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-red-300">
                ❌ Something went wrong. Please try again.
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="Your name"
                className="w-full rounded-xl border border-white/10 bg-gray-900 px-4 py-3"
              />

              <input
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                placeholder="you@example.com"
                className="w-full rounded-xl border border-white/10 bg-gray-900 px-4 py-3"
              />

              <select
                name="type"
                value={form.type}
                onChange={handleChange}
                className="w-full rounded-xl border border-white/10 bg-gray-900 px-4 py-3"
              >
                <option>General Feedback</option>
                <option>Bug Report</option>
                <option>Feature Request</option>
              </select>

              <textarea
                name="message"
                value={form.message}
                onChange={handleChange}
                rows="6"
                placeholder="Tell us what you think..."
                required
                className="w-full rounded-xl border border-white/10 bg-gray-900 px-4 py-3"
              />

              <button
                type="submit"
                disabled={status === 'loading'}
                className={`w-full rounded-xl py-3 font-medium transition ${
                  status === 'loading'
                    ? 'bg-gray-700 cursor-not-allowed'
                    : 'bg-red-500 hover:bg-red-600'
                }`}
              >
                {status === 'loading' ? 'Sending...' : 'Submit Feedback'}
              </button>
            </form>

            <div className="border-t border-white/10 pt-6">
              <Link
                href="/"
                className="inline-flex rounded-lg border border-red-500/40 bg-red-600/10 px-4 py-2 text-sm text-red-300 hover:bg-red-600/20"
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
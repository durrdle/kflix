'use client';

import Link from 'next/link';

export default function HelpPage() {
  return (
    <div className="min-h-screen bg-black px-6 py-16 text-white">
      <div className="mx-auto max-w-4xl">
        <div className="overflow-hidden rounded-2xl border border-red-500/40 bg-gradient-to-b from-gray-900 to-black shadow-[0_12px_35px_rgba(0,0,0,0.55)]">
          <div className="border-b border-red-500/20 bg-red-600/10 px-8 py-6">
            <h1 className="text-3xl font-bold text-red-400 md:text-4xl">Help</h1>
            <p className="mt-2 text-sm text-gray-400">
              Frequently asked questions and support information for KFlix.
            </p>
          </div>

          <div className="space-y-6 px-8 py-8">
            <div className="rounded-xl border border-white/10 bg-white/5 p-5">
              <h2 className="text-lg font-semibold text-white">
                What is KFlix?
              </h2>
              <p className="mt-2 text-gray-400">
                KFlix is a movie and show discovery platform designed to help users browse,
                explore, and manage content-related information through a clean interface.
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-5">
              <h2 className="text-lg font-semibold text-white">
                Do I need an account?
              </h2>
              <p className="mt-2 text-gray-400">
                Yes, all features are locked behind pre-approved and verified accounts.
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-5">
              <h2 className="text-lg font-semibold text-white">
                Are cookies used?
              </h2>
              <p className="mt-2 text-gray-400">
                Yes. KFlix uses cookies to support functionality, preferences, and normal
                account/session behavior.
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-5">
              <h2 className="text-lg font-semibold text-white">
                How do I report a problem or suggest a feature?
              </h2>
              <p className="mt-2 text-gray-400">
                You can use the Feedback page or email us directly at{' '}
                <a
                  href="mailto:support@kflixstreaming.xyz"
                  className="text-red-400 transition hover:text-red-300"
                >
                  support@kflixstreaming.xyz
                </a>
                .
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-5">
              <h2 className="text-lg font-semibold text-white">
                I need help
              </h2>
              <p className="mt-2 text-gray-400">
                For login issues, account access problems, or general support, contact us
                email, make sure to mention your unique user id found in your profile for better support.
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
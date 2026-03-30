'use client';

import Link from 'next/link';

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-black px-6 py-16 text-white">
      <div className="mx-auto max-w-4xl">
        <div className="overflow-hidden rounded-2xl border border-red-500/40 bg-gradient-to-b from-gray-900 to-black shadow-[0_12px_35px_rgba(0,0,0,0.55)]">
          <div className="border-b border-red-500/20 bg-red-600/10 px-8 py-6">
            <h1 className="text-3xl font-bold text-red-400 md:text-4xl">
              Privacy Policy
            </h1>
            <p className="mt-2 text-sm text-gray-400">
              Last updated: March 27, 2026
            </p>
          </div>

          <div className="space-y-8 px-8 py-8 text-gray-300">
            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-white">1. Overview</h2>
              <p>
                This Privacy Policy explains how KFlix collects, uses, and protects your
                information when you use our website and related services.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-white">2. Information We Collect</h2>
              <p>We may collect the following categories of information:</p>
              <ul className="list-disc space-y-2 pl-6 text-gray-400">
                <li>account information, such as email address and login-related data;</li>
                <li>information you provide through any means of contacting us;</li>
                <li>technical data such as browser type, device type, and basic session information;</li>
                <li>cookie-related information used to support website functionality.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-white">3. Accounts</h2>
              <p>
                KFlix stores account-related information in order to provide account access
                and user-related features. You are responsible for keeping your login
                credentials secure.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-white">4. How We Use Your Information</h2>
              <p>We may use your information to:</p>
              <ul className="list-disc space-y-2 pl-6 text-gray-400">
                <li>create and manage user accounts;</li>
                <li>operate, maintain, and improve KFlix;</li>
                <li>respond to support requests and feedback;</li>
                <li>protect the website against abuse, misuse, and security issues;</li>
                <li>remember preferences and session-related settings through cookies.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-white">5. Cookies</h2>
              <p>
                KFlix uses cookies and similar technologies for essential website
                functionality, session handling, and user experience purposes.
              </p>
              <p>
                These cookies may help keep you signed in, remember preferences, and
                support normal site operation.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-white">6. Analytics</h2>
              <p>
                KFlix does not currently use third-party analytics tools for visitor
                tracking.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-white">7. Sharing of Information</h2>
              <p>
                We do not sell your personal information. We may share information only
                when necessary to operate the website, comply with legal obligations,
                enforce our terms, or protect the rights and safety of KFlix and its users.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-white">8. Data Retention</h2>
              <p>
                We retain information for as long as reasonably necessary to provide the
                service, maintain accounts, resolve disputes, enforce agreements, and meet
                legal or operational obligations.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-white">9. Security</h2>
              <p>
                We take reasonable steps to protect user information. However, no method of
                transmission or storage is completely secure, and we cannot guarantee
                absolute security.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-white">10. Your Rights</h2>
              <p>
                Depending on applicable law, you may have rights related to access,
                correction, deletion, or restriction of your personal information. To make
                a request, contact us using the email below.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-white">11. Changes to This Policy</h2>
              <p>
                We may update this Privacy Policy from time to time. Updates become
                effective when posted on this page.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-white">12. Contact</h2>
              <p>
                If you have privacy-related questions, contact{' '}
                <a
                  href="mailto:support@kflix.xyz"
                  className="text-red-400 transition hover:text-red-300"
                >
                  support@kflix.xyz
                </a>
                .
              </p>
            </section>

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
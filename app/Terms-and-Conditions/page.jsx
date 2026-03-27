'use client';

import Link from 'next/link';

export default function TermsAndConditionsPage() {
  return (
    <div className="min-h-screen bg-black px-6 py-16 text-white">
      <div className="mx-auto max-w-4xl">
        <div className="overflow-hidden rounded-2xl border border-red-500/40 bg-gradient-to-b from-gray-900 to-black shadow-[0_12px_35px_rgba(0,0,0,0.55)]">
          <div className="border-b border-red-500/20 bg-red-600/10 px-8 py-6">
            <h1 className="text-3xl font-bold text-red-400 md:text-4xl">
              Terms and Conditions
            </h1>
            <p className="mt-2 text-sm text-gray-400">
              Last updated: March 27, 2026
            </p>
          </div>

          <div className="space-y-8 px-8 py-8 text-gray-300">
            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-white">1. Acceptance of Terms</h2>
              <p>
                By accessing or using KFlix, you agree to be bound by these Terms and
                Conditions. If you do not agree, please do not use the website.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-white">2. About KFlix</h2>
              <p>
                KFlix is a movie and show discovery platform. KFlix provides metadata,
                informational content, interface features, and account-related functionality.
              </p>
              <p>
                KFlix does not claim ownership of third-party trademarks, film titles,
                show titles, posters, or related intellectual property that may appear on
                the platform.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-white">3. Accounts</h2>
              <p>
                Some features may require an account. You are responsible for maintaining
                the confidentiality of your login credentials and for activity that occurs
                under your account.
              </p>
              <p>
                You agree to provide accurate information and to keep your account details
                up to date.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-white">4. Acceptable Use</h2>
              <p>You agree not to:</p>
              <ul className="list-disc space-y-2 pl-6 text-gray-400">
                <li>use KFlix in any unlawful or harmful way;</li>
                <li>attempt to gain unauthorized access to accounts, systems, or data;</li>
                <li>scrape, overload, or disrupt the service;</li>
                <li>upload or submit malicious code or abusive content;</li>
                <li>impersonate another person or entity.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-white">5. Third-Party Content and Services</h2>
              <p>
                KFlix may reference or display information obtained from third-party
                sources or APIs. We are not responsible for the accuracy, availability,
                or policies of third-party services.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-white">6. Intellectual Property</h2>
              <p>
                The KFlix website design, branding, layout, and original content are owned
                by or licensed to KFlix unless otherwise stated.
              </p>
              <p>
                You may not copy, reproduce, distribute, or exploit any part of KFlix
                except as permitted by law or with prior written permission.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-white">7. Disclaimer</h2>
              <p>
                KFlix is provided on an &quot;as is&quot; and &quot;as available&quot; basis.
                We make no warranties or guarantees regarding uninterrupted availability,
                accuracy, reliability, or fitness for a particular purpose.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-white">8. Limitation of Liability</h2>
              <p>
                To the fullest extent permitted by applicable law, KFlix shall not be
                liable for any indirect, incidental, special, consequential, or punitive
                damages arising out of or related to your use of the website.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-white">9. Termination</h2>
              <p>
                We reserve the right to suspend or terminate access to KFlix at any time,
                with or without notice, if we believe these Terms have been violated or if
                necessary to protect the platform.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-white">10. Changes to These Terms</h2>
              <p>
                We may update these Terms and Conditions from time to time. Continued use
                of KFlix after changes become effective means you accept the revised terms.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-white">11. Contact</h2>
              <p>
                For questions about these Terms, contact us at{' '}
                <a
                  href="mailto:support@kflixstreaming.xyz"
                  className="text-red-400 transition hover:text-red-300"
                >
                  support@kflixstreaming.xyz
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
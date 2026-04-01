// app/layout.js
import './globals.css';
import Script from 'next/script';
import MaintenanceGate from '@/components/MaintenanceGate';
import PresenceTracker from '@/components/PresenceTracker';
import ThemeSync from '@/components/ThemeSync';

export const metadata = {
  title: 'KFlix Streaming',
  description: 'KFlix Streaming Services',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                try {
                  var allowedThemes = ['lava', 'midnight', 'crimson', 'neon', 'noir'];
                  var storedTheme =
                    localStorage.getItem('kflix_theme') ||
                    localStorage.getItem('kflix_selected_theme') ||
                    localStorage.getItem('theme') ||
                    document.documentElement.getAttribute('data-theme') ||
                    'lava';

                  var nextTheme = allowedThemes.indexOf(storedTheme) !== -1 ? storedTheme : 'lava';

                  document.documentElement.setAttribute('data-theme', nextTheme);
                  localStorage.setItem('kflix_theme', nextTheme);
                  localStorage.setItem('kflix_selected_theme', nextTheme);
                  localStorage.setItem('theme', nextTheme);
                } catch (e) {
                  document.documentElement.setAttribute('data-theme', 'lava');
                }
              })();
            `,
          }}
        />
      </head>

      <body className="min-h-screen">
        <ThemeSync />

        <MaintenanceGate>
          <PresenceTracker />
          {children}
        </MaintenanceGate>

        <Script
          id="google-cast-sdk"
          src="https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
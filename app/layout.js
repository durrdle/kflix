// app/layout.js
import './globals.css';
import Script from 'next/script';
import MaintenanceGate from '@/components/MaintenanceGate';
import PresenceTracker from '@/components/PresenceTracker';

export const metadata = {
  title: 'KFlix Streaming',
  description: 'KFlix Streaming Services',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-theme="lava">
      <body className="min-h-screen">
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
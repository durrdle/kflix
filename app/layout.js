// app/layout.js
import './globals.css';
import Script from 'next/script';

export const metadata = {
  title: 'KFlix Streaming',
  description: 'KFlix Streaming Services',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-theme="lava">
      <body className="min-h-screen">
        {children}

        <Script
          id="google-cast-sdk"
          src="https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
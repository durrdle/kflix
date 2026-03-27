// app/layout.js
import './globals.css';

export const metadata = {
  title: 'KFlix Streaming',
  description: 'KFlix Streaming Services',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-black text-white flex flex-col min-h-screen">
        {children}
      </body>
    </html>
  );
}
'use client';

import { usePathname } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export default function LayoutWrapper({ children }) {
  const pathname = usePathname();
  const hideNavFooter = pathname.startsWith('/login') || pathname.startsWith('/verify');

  return (
    <div className="flex flex-col min-h-screen bg-black text-white">
      {!hideNavFooter && <Navbar />}

      {/* Main content grows to fill available space */}
      <main className="flex-grow flex flex-col">
        {children}
      </main>

      {/* Footer sticks to bottom */}
      {!hideNavFooter && <Footer />}
    </div>
  );
}
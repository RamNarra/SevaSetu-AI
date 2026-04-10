'use client';

import Sidebar from '@/components/layout/Sidebar';
import Navbar from '@/components/layout/Navbar';
import AuthGuard from '@/components/layout/AuthGuard';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-[#FAF9F6]">
        <Sidebar />
        <div className="flex-1 ml-[260px] transition-all duration-300">
          <Navbar />
          <main>{children}</main>
        </div>
      </div>
    </AuthGuard>
  );
}

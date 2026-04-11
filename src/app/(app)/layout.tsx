'use client';

import Sidebar from '@/components/layout/Sidebar';
import Navbar from '@/components/layout/Navbar';
import AuthGuard from '@/components/layout/AuthGuard';
import { useState } from 'react';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-[#FAF9F6]">
        <Sidebar mobileOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex-1 md:ml-[260px] transition-all duration-300">
          <Navbar onMenuToggle={() => setSidebarOpen(true)} />
          <main>{children}</main>
        </div>
      </div>
    </AuthGuard>
  );
}

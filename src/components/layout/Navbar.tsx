'use client';

import { Bell, Search } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { motion } from 'framer-motion';

export default function Navbar() {
  const { user, userDoc } = useAuth();

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
      className="sticky top-0 z-30 h-16 border-b border-[#E5E2DC] bg-[#FAF9F6]/80 backdrop-blur-xl flex items-center justify-between px-6"
    >
      {/* Search */}
      <div className="relative max-w-md flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
        <input
          type="text"
          placeholder="Search localities, reports, volunteers..."
          className="w-full pl-10 pr-4 py-2 rounded-xl bg-white border border-[#E5E2DC] text-sm text-[#1A1A1A] placeholder-[#6B7280]/60 focus:outline-none focus:ring-2 focus:ring-[#D4622B]/30 focus:border-[#D4622B] transition-all"
        />
      </div>

      {/* Right side */}
      <div className="flex items-center gap-4">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="relative p-2 rounded-xl hover:bg-white border border-transparent hover:border-[#E5E2DC] transition-all"
        >
          <Bell className="w-5 h-5 text-[#6B7280]" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#D4622B] rounded-full" />
        </motion.button>

        {user && (
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold text-[#1A1A1A]">
                {user.displayName}
              </p>
              <p className="text-xs text-[#6B7280]">
                {userDoc?.role?.replace('_', ' ') || ''}
              </p>
            </div>
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt=""
                className="w-9 h-9 rounded-xl ring-2 ring-[#E5E2DC] hover:ring-[#D4622B] transition-all cursor-pointer"
              />
            ) : (
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#D4622B] to-[#F4A261] flex items-center justify-center text-sm font-bold text-white">
                {user.displayName?.[0] || '?'}
              </div>
            )}
          </div>
        )}
      </div>
    </motion.header>
  );
}

'use client';

import { Bell, Search, Menu } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { motion } from 'framer-motion';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const searchRoutes = [
  { label: 'Dashboard', path: '/dashboard', keywords: ['home', 'overview', 'stats'] },
  { label: 'Localities', path: '/localities', keywords: ['locality', 'map', 'urgency', 'heatmap', 'priority'] },
  { label: 'Field Reports', path: '/reports', keywords: ['report', 'field', 'submit', 'extract'] },
  { label: 'Camp Planner', path: '/planner', keywords: ['camp', 'plan', 'schedule', 'create'] },
  { label: 'Allocation', path: '/allocation', keywords: ['volunteer', 'assign', 'allocate', 'match'] },
  { label: 'Operations', path: '/operations', keywords: ['ops', 'patient', 'queue', 'kanban', 'triage'] },
  { label: 'Impact', path: '/impact', keywords: ['impact', 'summary', 'analytics', 'medicine', 'follow'] },
  { label: 'Admin', path: '/admin', keywords: ['admin', 'seed', 'data', 'settings'] },
];

export default function Navbar({ onMenuToggle }: { onMenuToggle?: () => void }) {
  const { user, userDoc } = useAuth();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = query.trim().length > 0
    ? searchRoutes.filter((r) =>
        r.label.toLowerCase().includes(query.toLowerCase()) ||
        r.keywords.some((k) => k.includes(query.toLowerCase()))
      )
    : [];

  useEffect(() => {
    function handleClickOutside() { setShowResults(false); }
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
      className="sticky top-0 z-30 h-16 border-b border-[#E5E2DC] bg-[#FAF9F6]/80 backdrop-blur-xl flex items-center justify-between px-6"
    >
      {/* Mobile menu button */}
      <button
        onClick={onMenuToggle}
        className="md:hidden p-2 rounded-xl hover:bg-white border border-transparent hover:border-[#E5E2DC] transition-all mr-2"
      >
        <Menu className="w-5 h-5 text-[#6B7280]" />
      </button>

      {/* Search */}
      <div className="relative max-w-md flex-1 hidden sm:block" onClick={(e) => e.stopPropagation()}>
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setShowResults(true); }}
          onFocus={() => setShowResults(true)}
          placeholder="Search pages..."
          className="w-full pl-10 pr-4 py-2 rounded-xl bg-white border border-[#E5E2DC] text-sm text-[#1A1A1A] placeholder-[#6B7280]/60 focus:outline-none focus:ring-2 focus:ring-[#D4622B]/30 focus:border-[#D4622B] transition-all"
        />
        {showResults && results.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl border border-[#E5E2DC] shadow-lg overflow-hidden z-50">
            {results.map((r) => (
              <button
                key={r.path}
                onClick={() => { router.push(r.path); setQuery(''); setShowResults(false); }}
                className="w-full text-left px-4 py-2.5 text-sm hover:bg-[#FAF9F6] transition-colors flex items-center gap-2"
              >
                <Search className="w-3.5 h-3.5 text-[#6B7280]" />
                <span className="text-[#1A1A1A]">{r.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-4">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          title="Notifications coming soon"
          className="relative p-2 rounded-xl hover:bg-white border border-transparent hover:border-[#E5E2DC] transition-all"
        >
          <Bell className="w-5 h-5 text-[#6B7280]" />
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

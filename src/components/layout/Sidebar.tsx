'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  FileText,
  MapPin,
  CalendarRange,
  Users,
  Activity,
  BarChart3,
  Shield,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Heart,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { signOut } from '@/lib/firebase/auth';
import { cn } from '@/lib/utils';
import { useState } from 'react';

const navItems = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Reports', href: '/reports', icon: FileText },
  { label: 'Localities', href: '/localities', icon: MapPin },
  { label: 'Camp Planner', href: '/planner', icon: CalendarRange },
  { label: 'Allocation', href: '/allocation', icon: Users },
  { label: 'Operations', href: '/operations', icon: Activity },
  { label: 'Impact', href: '/impact', icon: BarChart3 },
];

const adminItems = [
  { label: 'Admin', href: '/admin', icon: Shield },
];

export default function Sidebar({ mobileOpen, onClose }: { mobileOpen?: boolean; onClose?: () => void }) {
  const pathname = usePathname();
  const { userDoc, user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  const isCoordinator = userDoc?.role === 'COORDINATOR';
  const items = isCoordinator ? [...navItems, ...adminItems] : navItems;

  return (
    <>
      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-30 md:hidden"
          />
        )}
      </AnimatePresence>

      <motion.aside
        initial={false}
        animate={{ width: collapsed ? 72 : 260 }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        className={cn(
          'fixed left-0 top-0 h-screen z-40 flex flex-col transition-transform duration-300',
          'md:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        )}
        style={{
          background: 'linear-gradient(180deg, #1B2E25 0%, #152219 100%)',
        }}
      >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-white/10">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#D4622B] to-[#F4A261] flex items-center justify-center flex-shrink-0">
          <Heart className="w-5 h-5 text-white" />
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
            >
              <h1 className="text-lg font-bold text-white tracking-tight">
                SevaSetu
                <span className="text-[#F4A261]"> AI</span>
              </h1>
              <p className="text-[10px] text-white/40 -mt-0.5">Smart Resource Allocation</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {items.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link href={item.href} key={item.href} onClick={onClose}>
              <motion.div
                whileHover={{ x: 4 }}
                whileTap={{ scale: 0.97 }}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group relative overflow-hidden',
                  isActive
                    ? 'bg-[#2D6A4F] text-white shadow-lg shadow-[#2D6A4F]/30'
                    : 'text-white/60 hover:text-white hover:bg-white/8'
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute inset-0 bg-[#2D6A4F] rounded-xl"
                    transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <item.icon className={cn(
                  'w-5 h-5 relative z-10 flex-shrink-0',
                  isActive ? 'text-[#F4A261]' : 'text-white/50 group-hover:text-white/80'
                )} />
                <AnimatePresence>
                  {!collapsed && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="relative z-10"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.div>
            </Link>
          );
        })}
      </nav>

      {/* User & Collapse */}
      <div className="px-3 py-4 border-t border-white/10 space-y-2">
        {user && !collapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-3 px-3 py-2"
          >
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt=""
                className="w-8 h-8 rounded-full ring-2 ring-[#2D6A4F]"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-[#2D6A4F] flex items-center justify-center text-xs text-white font-bold">
                {user.displayName?.[0] || '?'}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white truncate">
                {user.displayName}
              </p>
              <p className="text-[10px] text-white/40 truncate">
                {userDoc?.role?.replace('_', ' ') || 'Loading...'}
              </p>
            </div>
          </motion.div>
        )}

        <button
          onClick={() => signOut()}
          className={cn(
            'flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-white/50 hover:text-red-400 hover:bg-red-500/10 transition-all',
            collapsed && 'justify-center'
          )}
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span>Sign Out</span>}
        </button>

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center w-full py-2 rounded-xl text-white/30 hover:text-white/60 hover:bg-white/5 transition-all"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>
    </motion.aside>
    </>
  );
}

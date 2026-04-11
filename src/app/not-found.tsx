'use client';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Home, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#F0EDE8] flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center max-w-md"
      >
        <div className="text-8xl font-extrabold bg-gradient-to-r from-[#D4622B] to-[#F4A261] bg-clip-text text-transparent mb-4">
          404
        </div>
        <h1 className="text-2xl font-bold text-[#1A1A1A] mb-2">Page not found</h1>
        <p className="text-[#6B7280] mb-8">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link href="/dashboard">
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="btn bg-gradient-to-r from-[#D4622B] to-[#F4A261] text-white px-6 py-3 flex items-center gap-2"
            >
              <Home className="w-4 h-4" /> Dashboard
            </motion.button>
          </Link>
          <Link href="/">
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="btn bg-white border border-[#E5E2DC] text-[#6B7280] px-6 py-3 flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" /> Home
            </motion.button>
          </Link>
        </div>
      </motion.div>
    </div>
  );
}

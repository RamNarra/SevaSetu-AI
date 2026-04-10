'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { UserRole } from '@/types';

interface AuthGuardProps {
  children: React.ReactNode;
  requiredRole?: UserRole;
}

export default function AuthGuard({ children, requiredRole }: AuthGuardProps) {
  const { user, userDoc, loading, needsOnboarding } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.push('/auth');
      return;
    }

    if (needsOnboarding) {
      router.push('/auth?onboarding=true');
      return;
    }

    if (requiredRole && userDoc?.role !== requiredRole) {
      router.push('/dashboard');
      return;
    }
  }, [user, userDoc, loading, needsOnboarding, requiredRole, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#FAF9F6]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#D4622B] to-[#F4A261] animate-pulse" />
          <p className="text-sm text-[#6B7280] font-medium">Loading SevaSetu AI...</p>
        </div>
      </div>
    );
  }

  if (!user || needsOnboarding) return null;
  if (requiredRole && userDoc?.role !== requiredRole) return null;

  return <>{children}</>;
}

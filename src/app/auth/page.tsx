'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, ArrowRight, Check } from 'lucide-react';
import { signInWithGoogle, createUserDoc, getUserDoc, checkRedirectResult } from '@/lib/firebase/auth';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole } from '@/types';
import toast from 'react-hot-toast';

const roles = [
  {
    value: UserRole.DOCTOR,
    label: 'Doctor / Consultant',
    description: 'Consultation workflow, patient visits, and prescription management',
    emoji: '🩺',
  },
  {
    value: UserRole.PHARMACIST,
    label: 'Pharmacist',
    description: 'Medicine stock management and dispensing workflow',
    emoji: '💊',
  },
  {
    value: UserRole.FIELD_VOLUNTEER,
    label: 'Field Volunteer',
    description: 'Submit community reports, surveys, and field observations',
    emoji: '📋',
  },
  {
    value: UserRole.SUPPORT,
    label: 'Support Staff',
    description: 'Registration, crowd management, translation, and follow-up',
    emoji: '🤝',
  },
];

export default function AuthPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#FAF9F6] flex items-center justify-center">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#D4622B] to-[#F4A261] animate-pulse" />
      </div>
    }>
      <AuthContent />
    </Suspense>
  );
}

function AuthContent() {
  const { user, userDoc, loading, needsOnboarding } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const showOnboarding = searchParams.get('onboarding') === 'true' || needsOnboarding;

  useEffect(() => {
    if (!loading && user && userDoc && !showOnboarding) {
      router.push('/dashboard');
    }
  }, [user, userDoc, loading, showOnboarding, router]);

  // Check for redirect result on page load (when signInWithRedirect was used)
  useEffect(() => {
    checkRedirectResult().then((redirectUser) => {
      if (redirectUser) {
        getUserDoc(redirectUser.uid).then((existingDoc) => {
          if (existingDoc) {
            toast.success(`Welcome back, ${existingDoc.displayName}!`);
            router.push('/dashboard');
          } else {
            router.push('/auth?onboarding=true');
          }
        });
      }
    });
  }, [router]);

  async function handleGoogleSignIn() {
    setIsSigningIn(true);
    try {
      const firebaseUser = await signInWithGoogle();
      const existingDoc = await getUserDoc(firebaseUser.uid);
      if (existingDoc) {
        toast.success(`Welcome back, ${existingDoc.displayName}!`);
        router.push('/dashboard');
      } else {
        router.push('/auth?onboarding=true');
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      // Don't show error toast for redirect — it's expected
      if (!msg.includes('Redirecting')) {
        console.error('Sign in error:', error);
        toast.error('Failed to sign in. Please try again.');
      }
    } finally {
      setIsSigningIn(false);
    }
  }

  async function handleRoleSelect() {
    if (!selectedRole || !user) return;
    setIsSaving(true);
    try {
      await createUserDoc(user, selectedRole);
      toast.success('Welcome to SevaSetu AI!');
      router.push('/dashboard');
    } catch (error) {
      console.error('Role save error:', error);
      toast.error('Failed to save role. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF9F6] flex items-center justify-center">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#D4622B] to-[#F4A261] animate-pulse" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF9F6] flex">
      {/* Left Panel — Branding */}
      <div
        className="hidden lg:flex w-[45%] flex-col justify-between p-12"
        style={{
          background: 'linear-gradient(160deg, #1B2E25 0%, #2D6A4F 50%, #40916C 100%)',
        }}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center">
            <Heart className="w-5 h-5 text-[#F4A261]" />
          </div>
          <span className="text-xl font-bold text-white">
            SevaSetu<span className="text-[#F4A261]"> AI</span>
          </span>
        </div>

        <div>
          <h2 className="text-4xl font-extrabold text-white leading-tight">
            Coordinate health camps
            <br />
            with intelligence.
          </h2>
          <p className="mt-4 text-white/60 text-lg max-w-md">
            From scattered field data to actionable insights — plan, allocate, and operate
            community health camps with AI-powered precision.
          </p>
        </div>

        <p className="text-white/30 text-sm">
          Google Solution Challenge 2026 • Smart Resource Allocation
        </p>
      </div>

      {/* Right Panel — Auth */}
      <div className="flex-1 flex items-center justify-center p-8">
        <AnimatePresence mode="wait">
          {user && showOnboarding ? (
            /* Role Selection */
            <motion.div
              key="onboarding"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.4 }}
              className="w-full max-w-lg"
            >
              <h2 className="text-2xl font-bold text-[#1A1A1A]">Select your role</h2>
              <p className="mt-2 text-[#6B7280] text-sm">
                Welcome, {user.displayName}! Choose your role to get started.
              </p>

              <div className="mt-8 space-y-3">
                {roles.map((role) => (
                  <motion.button
                    key={role.value}
                    whileHover={{ x: 4 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setSelectedRole(role.value)}
                    className={`w-full text-left p-4 rounded-2xl border-2 transition-all ${
                      selectedRole === role.value
                        ? 'border-[#D4622B] bg-primary-pale shadow-glow-primary'
                        : 'border-[#E5E2DC] bg-white hover:border-[#D4622B]/30'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-2xl">{role.emoji}</span>
                      <div className="flex-1">
                        <p className="font-semibold text-[#1A1A1A]">{role.label}</p>
                        <p className="text-xs text-[#6B7280] mt-0.5">{role.description}</p>
                      </div>
                      {selectedRole === role.value && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="w-6 h-6 rounded-full bg-[#D4622B] flex items-center justify-center"
                        >
                          <Check className="w-3.5 h-3.5 text-white" />
                        </motion.div>
                      )}
                    </div>
                  </motion.button>
                ))}
              </div>

              <motion.button
                whileHover={{ scale: 1.02, y: -1 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleRoleSelect}
                disabled={!selectedRole || isSaving}
                className="mt-8 w-full btn-primary py-3.5 text-base disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? 'Setting up...' : 'Continue'} <ArrowRight className="w-5 h-5" />
              </motion.button>
            </motion.div>
          ) : (
            /* Sign In */
            <motion.div
              key="signin"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.4 }}
              className="w-full max-w-md text-center"
            >
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#D4622B] to-[#F4A261] flex items-center justify-center mx-auto mb-6">
                <Heart className="w-8 h-8 text-white" />
              </div>

              <h2 className="text-3xl font-bold text-[#1A1A1A]">
                Welcome to SevaSetu AI
              </h2>
              <p className="mt-3 text-[#6B7280]">
                Sign in with your Google account to get started.
              </p>

              <motion.button
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleGoogleSignIn}
                disabled={isSigningIn}
                className="mt-10 w-full flex items-center justify-center gap-3 px-6 py-4 rounded-2xl bg-white border-2 border-[#E5E2DC] hover:border-[#D4622B]/30 hover:shadow-card-hover transition-all text-[#1A1A1A] font-semibold disabled:opacity-50"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                {isSigningIn ? 'Signing in...' : 'Continue with Google'}
              </motion.button>

              <p className="mt-8 text-xs text-[#6B7280]">
                By signing in, you agree to SevaSetu AI&apos;s terms of service.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

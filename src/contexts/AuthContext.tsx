'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { Timestamp } from 'firebase/firestore/lite';
import { onAuthChange, getUserDoc } from '@/lib/firebase/auth';
import { UserDoc, UserRole } from '@/types';

// Demo / admin override — these emails always get full coordinator access,
// even if their Firestore user doc is missing or unreachable.
const ADMIN_EMAILS = new Set<string>([
  'ramcharannarra8@gmail.com',
]);

function buildAdminUserDoc(firebaseUser: User): UserDoc {
  return {
    uid: firebaseUser.uid,
    displayName: firebaseUser.displayName || 'Ram Charan Narra',
    email: firebaseUser.email || 'ramcharannarra8@gmail.com',
    photoURL: firebaseUser.photoURL || '',
    role: UserRole.COORDINATOR,
    createdAt: Timestamp.now(),
  };
}

interface AuthContextType {
  user: User | null;
  userDoc: UserDoc | null;
  role: UserRole | null;
  loading: boolean;
  needsOnboarding: boolean;
  /** Call after onboarding write succeeds to update context without waiting for onAuthChange. */
  completeOnboarding: (doc: UserDoc) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userDoc: null,
  role: null,
  loading: true,
  needsOnboarding: false,
  completeOnboarding: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userDoc, setUserDoc] = useState<UserDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  // Guards against onAuthChange re-firing and overwriting state after completeOnboarding
  const onboardedRef = React.useRef(false);

  useEffect(() => {
    const unsubscribe = onAuthChange(async (firebaseUser) => {
      setUser(firebaseUser);

      if (!firebaseUser) {
        setUserDoc(null);
        setNeedsOnboarding(false);
        onboardedRef.current = false;
        setLoading(false);
        return;
      }

      // If completeOnboarding already set the doc, skip re-fetch
      if (onboardedRef.current) {
        setLoading(false);
        return;
      }

      const isAdmin = !!firebaseUser.email && ADMIN_EMAILS.has(firebaseUser.email.toLowerCase());
      try {
        const doc = await getUserDoc(firebaseUser.uid);
        if (doc) {
          // Respect the stored role — admin emails no longer force-override
          setUserDoc(doc);
          setNeedsOnboarding(false);
        } else if (isAdmin) {
          // No Firestore doc yet — synthesize a coordinator doc so the demo never blocks.
          setUserDoc(buildAdminUserDoc(firebaseUser));
          setNeedsOnboarding(false);
        } else {
          setNeedsOnboarding(true);
          setUserDoc(null);
        }
      } catch (err) {
        console.error('Failed to fetch user doc:', err);
        if (isAdmin) {
          setUserDoc(buildAdminUserDoc(firebaseUser));
          setNeedsOnboarding(false);
        } else {
          // Auth succeeded but Firestore failed — still let them through to onboarding
          setNeedsOnboarding(true);
          setUserDoc(null);
        }
      }

      setLoading(false);
    });

    return unsubscribe;
  }, []);

  function completeOnboarding(doc: UserDoc) {
    onboardedRef.current = true;
    setUserDoc(doc);
    setNeedsOnboarding(false);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        userDoc,
        role: userDoc?.role || null,
        loading,
        needsOnboarding,
        completeOnboarding,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

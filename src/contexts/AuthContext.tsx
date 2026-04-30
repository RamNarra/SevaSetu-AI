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
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userDoc: null,
  role: null,
  loading: true,
  needsOnboarding: false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userDoc, setUserDoc] = useState<UserDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthChange(async (firebaseUser) => {
      setUser(firebaseUser);

      if (firebaseUser) {
        const isAdmin = !!firebaseUser.email && ADMIN_EMAILS.has(firebaseUser.email.toLowerCase());
        try {
          const doc = await getUserDoc(firebaseUser.uid);
          if (doc) {
            // Force admin emails to coordinator role regardless of stored value
            setUserDoc(isAdmin ? { ...doc, role: UserRole.COORDINATOR } : doc);
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
      } else {
        setUserDoc(null);
        setNeedsOnboarding(false);
      }

      setLoading(false);
    });

    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        userDoc,
        role: userDoc?.role || null,
        loading,
        needsOnboarding,
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

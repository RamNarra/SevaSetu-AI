'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { onAuthChange, getUserDoc } from '@/lib/firebase/auth';
import { UserDoc, UserRole } from '@/types';

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
        try {
          const doc = await getUserDoc(firebaseUser.uid);
          if (doc) {
            setUserDoc(doc);
            setNeedsOnboarding(false);
          } else {
            setNeedsOnboarding(true);
            setUserDoc(null);
          }
        } catch (err) {
          console.error('Failed to fetch user doc:', err);
          // Auth succeeded but Firestore failed — still let them through to onboarding
          setNeedsOnboarding(true);
          setUserDoc(null);
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

// contexts/AuthContext.tsx
"use client";

import { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';

type User = {
  uid: string;
  name: string;
  email: string;
  role: string;
  photoUrl?: string;
  department?: string;
  jabatan?: string;      // ← TAMBAHKAN
  joinDate?: string;     // ← TAMBAHKAN
  phone?: string;        // ← TAMBAHKAN
  address?: string;      // ← TAMBAHKAN
};

type AuthContextType = {
  user: User | null;
  loading: boolean;
  hasPermission: (allowedRoles: string[]) => boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Cache user data
const CACHE_KEY = 'attendance_user_cache';
const CACHE_DURATION = 5 * 60 * 1000;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Check cache first
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_DURATION) {
          setUser(data);
          setLoading(false);
        }
      } catch (e) {
        console.error('Cache parse error:', e);
      }
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            const userData: User = {
              uid: firebaseUser.uid,
              name: data.name || firebaseUser.displayName || '',
              email: data.email || firebaseUser.email || '',
              role: data.role || 'employee',
              photoUrl: data.photoUrl || undefined,
              department: data.department || '',
              jabatan: data.jabatan || '',        // ← TAMBAHKAN
              joinDate: data.joinDate || '',       // ← TAMBAHKAN
              phone: data.phone || '',             // ← TAMBAHKAN
              address: data.address || '',         // ← TAMBAHKAN
            };
            setUser(userData);
            
            // Save to cache
            localStorage.setItem(CACHE_KEY, JSON.stringify({
              data: userData,
              timestamp: Date.now(),
            }));
            
            // Set session cookie
            const session = btoa(JSON.stringify({
              uid: userData.uid,
              email: userData.email,
              role: userData.role,
            }));
            document.cookie = `__session=${session}; path=/; max-age=86400; SameSite=Lax`;
          } else {
            console.error('User document not found');
            setUser(null);
          }
        } catch (error) {
          console.error('Error fetching user:', error);
          setUser(null);
        }
      } else {
        setUser(null);
        localStorage.removeItem(CACHE_KEY);
        document.cookie = '__session=; path=/; max-age=0';
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const hasPermission = (allowedRoles: string[]) => {
    if (!user) return false;
    return allowedRoles.includes(user.role);
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      localStorage.removeItem(CACHE_KEY);
      document.cookie = '__session=; path=/; max-age=0';
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, hasPermission, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
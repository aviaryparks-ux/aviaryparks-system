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
};

type AuthContextType = {
  user: User | null;
  loading: boolean;
  hasPermission: (allowedRoles: string[]) => boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
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
            };
            setUser(userData);
            
            // Set session cookie untuk middleware
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
        // Hapus session cookie
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
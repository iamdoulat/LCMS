
"use client";

import type { User } from 'firebase/auth';
import { onAuthStateChanged, signOut as firebaseSignOut, GoogleAuthProvider, signInWithPopup, sendPasswordResetEmail } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import type { PropsWithChildren} from 'react';
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { auth } from '@/lib/firebase/config';
import { Loader2 } from 'lucide-react';
import Swal from 'sweetalert2';
import type { UserRole } from '@/types';

const SIMULATED_SUPER_ADMIN_EMAIL = 'superadmin@example.com';
const SIMULATED_ADMIN_EMAIL = 'admin@example.com';
const COMPANY_NAME_STORAGE_KEY = 'appCompanyName';
const DEFAULT_COMPANY_NAME = 'Smart Solution';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  userRole: UserRole | null;
  logout: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  companyName: string;
  updateCompanyName: (newName: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const googleProvider = new GoogleAuthProvider();

export const AuthProvider = ({ children }: PropsWithChildren) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [companyName, setCompanyName] = useState<string>(DEFAULT_COMPANY_NAME);
  const router = useRouter();

  useEffect(() => {
    const storedCompanyName = localStorage.getItem(COMPANY_NAME_STORAGE_KEY);
    if (storedCompanyName) {
      setCompanyName(storedCompanyName);
    }

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        if (currentUser.email === SIMULATED_SUPER_ADMIN_EMAIL) {
          setUserRole("Super Admin");
        } else if (currentUser.email === SIMULATED_ADMIN_EMAIL) {
          setUserRole("Admin");
        } else {
          setUserRole("User");
        }
      } else {
        setUserRole(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const logout = useCallback(async () => {
    setLoading(true);
    try {
      await firebaseSignOut(auth);
      setUser(null);
      setUserRole(null);
      Swal.fire({
        title: "Logged Out",
        text: "You have been successfully logged out.",
        icon: "success",
        timer: 2000,
        showConfirmButton: false,
      });
      router.push('/login');
    } catch (error: any) {
      console.error("Error signing out: ", error);
      Swal.fire({
        title: "Logout Error",
        text: error.message || "Failed to log out. Please try again.",
        icon: "error",
      });
    } finally {
      setLoading(false);
    }
  }, [router]);

  const signInWithGoogle = useCallback(async () => {
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      setUser(result.user);
      // Role setting for Google users would typically come from custom claims
      if (result.user.email === SIMULATED_SUPER_ADMIN_EMAIL) {
        setUserRole("Super Admin");
      } else if (result.user.email === SIMULATED_ADMIN_EMAIL) {
        setUserRole("Admin");
      } else {
        setUserRole("User");
      }
      Swal.fire({
        title: "Login Successful",
        text: `Welcome, ${result.user.displayName || result.user.email}!`,
        icon: "success",
        timer: 2000,
        showConfirmButton: false,
      });
      router.push('/dashboard');
    } catch (error: any) {
      console.error("Error signing in with Google: ", error);
      let errorMessage = "Failed to sign in with Google. Please try again.";
      if (error.code === 'auth/account-exists-with-different-credential') {
        errorMessage = "An account already exists with the same email address but different sign-in credentials. Try signing in with the original method.";
      } else if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
        errorMessage = "Google Sign-In was cancelled.";
      }
      
      Swal.fire({
        title: "Google Sign-In Failed",
        text: errorMessage,
        icon: "error",
      });
    } finally {
      setLoading(false);
    }
  }, [router]);

  const updateCompanyName = useCallback((newName: string) => {
    setCompanyName(newName);
    localStorage.setItem(COMPANY_NAME_STORAGE_KEY, newName);
  }, []);
  
  if (loading && !user && typeof window !== 'undefined' && window.location.pathname !== '/login' && window.location.pathname !== '/register') {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }
  
  return (
    <AuthContext.Provider value={{ user, loading, userRole, logout, signInWithGoogle, setUser, companyName, updateCompanyName }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

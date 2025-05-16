
"use client";

import type { User } from 'firebase/auth';
import { onAuthStateChanged, signOut as firebaseSignOut, GoogleAuthProvider, signInWithPopup, sendPasswordResetEmail } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import type { PropsWithChildren} from 'react';
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { auth, firestore } from '@/lib/firebase/config';
import { doc, getDoc } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import Swal from 'sweetalert2';
import type { UserRole, CompanyProfile } from '@/types';

const SIMULATED_SUPER_ADMIN_EMAIL = 'mddoulat@gmail.com';
const SIMULATED_ADMIN_EMAIL = 'commercial@smartsolution-bd.com'; 

const COMPANY_PROFILE_COLLECTION = 'company_profile';
const COMPANY_PROFILE_DOC_ID = 'main_profile';
const COMPANY_NAME_STORAGE_KEY = 'appCompanyName';
const COMPANY_LOGO_URL_STORAGE_KEY = 'appCompanyLogoUrl';
const DEFAULT_COMPANY_NAME = 'Smart Solution';
const DEFAULT_COMPANY_LOGO_URL = "https://firebasestorage.googleapis.com/v0/b/lc-vision.firebasestorage.app/o/logoa%20(1)%20(1).png?alt=media&token=b5be1b22-2d2b-4951-b433-df2e3ea7eb6e";


interface AuthContextType {
  user: User | null;
  loading: boolean;
  userRole: UserRole | null;
  logout: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  companyName: string;
  companyLogoUrl: string;
  updateCompanyProfile: (profile: Partial<Pick<CompanyProfile, 'companyName' | 'companyLogoUrl'>>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const googleProvider = new GoogleAuthProvider();

export const AuthProvider = ({ children }: PropsWithChildren) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [companyName, setCompanyName] = useState<string>(DEFAULT_COMPANY_NAME);
  const [companyLogoUrl, setCompanyLogoUrl] = useState<string>(DEFAULT_COMPANY_LOGO_URL);
  const router = useRouter();

  const fetchInitialCompanyProfile = useCallback(async () => {
    console.log("AuthContext: Attempting to fetch initial company profile. User UID:", auth.currentUser?.uid);
    try {
      const profileDocRef = doc(firestore, COMPANY_PROFILE_COLLECTION, COMPANY_PROFILE_DOC_ID);
      const profileDocSnap = await getDoc(profileDocRef);
      if (profileDocSnap.exists()) {
        const profileData = profileDocSnap.data() as CompanyProfile;
        if (profileData.companyName) {
          setCompanyName(profileData.companyName);
          if (typeof window !== 'undefined') localStorage.setItem(COMPANY_NAME_STORAGE_KEY, profileData.companyName);
        } else {
           if (typeof window !== 'undefined') localStorage.setItem(COMPANY_NAME_STORAGE_KEY, DEFAULT_COMPANY_NAME);
           setCompanyName(DEFAULT_COMPANY_NAME);
        }
        if (profileData.companyLogoUrl) {
          setCompanyLogoUrl(profileData.companyLogoUrl);
          if (typeof window !== 'undefined') localStorage.setItem(COMPANY_LOGO_URL_STORAGE_KEY, profileData.companyLogoUrl);
        } else {
            if (typeof window !== 'undefined') localStorage.setItem(COMPANY_LOGO_URL_STORAGE_KEY, DEFAULT_COMPANY_LOGO_URL);
            setCompanyLogoUrl(DEFAULT_COMPANY_LOGO_URL);
        }
      } else {
        const storedName = typeof window !== 'undefined' ? localStorage.getItem(COMPANY_NAME_STORAGE_KEY) : null;
        if (storedName) setCompanyName(storedName); else if (typeof window !== 'undefined') localStorage.setItem(COMPANY_NAME_STORAGE_KEY, DEFAULT_COMPANY_NAME);
        const storedLogoUrl = typeof window !== 'undefined' ? localStorage.getItem(COMPANY_LOGO_URL_STORAGE_KEY) : null;
        if (storedLogoUrl) setCompanyLogoUrl(storedLogoUrl); else if (typeof window !== 'undefined') localStorage.setItem(COMPANY_LOGO_URL_STORAGE_KEY, DEFAULT_COMPANY_LOGO_URL);
      }
    } catch (error) {
      console.error("AuthContext: Error fetching company profile from Firestore:", error);
      const storedName = typeof window !== 'undefined' ? localStorage.getItem(COMPANY_NAME_STORAGE_KEY) : null;
      if (storedName) setCompanyName(storedName); else if (typeof window !== 'undefined') localStorage.setItem(COMPANY_NAME_STORAGE_KEY, DEFAULT_COMPANY_NAME);
      const storedLogoUrl = typeof window !== 'undefined' ? localStorage.getItem(COMPANY_LOGO_URL_STORAGE_KEY) : null;
      if (storedLogoUrl) setCompanyLogoUrl(storedLogoUrl); else if (typeof window !== 'undefined') localStorage.setItem(COMPANY_LOGO_URL_STORAGE_KEY, DEFAULT_COMPANY_LOGO_URL);
    }
  }, []);


  useEffect(() => {
    fetchInitialCompanyProfile();

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
  }, [fetchInitialCompanyProfile]);

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

 const updateCompanyProfile = useCallback((profile: Partial<Pick<CompanyProfile, 'companyName' | 'companyLogoUrl'>>) => {
    if (profile.companyName !== undefined) {
      setCompanyName(profile.companyName);
      if (typeof window !== 'undefined') localStorage.setItem(COMPANY_NAME_STORAGE_KEY, profile.companyName);
    }
    if (profile.companyLogoUrl !== undefined) {
      setCompanyLogoUrl(profile.companyLogoUrl);
      if (typeof window !== 'undefined') localStorage.setItem(COMPANY_LOGO_URL_STORAGE_KEY, profile.companyLogoUrl);
    } else if (profile.companyLogoUrl === null) { // Explicitly handle clearing the logo
        setCompanyLogoUrl(DEFAULT_COMPANY_LOGO_URL); // Revert to default or an empty string
        if (typeof window !== 'undefined') localStorage.setItem(COMPANY_LOGO_URL_STORAGE_KEY, DEFAULT_COMPANY_LOGO_URL);
    }
  }, []);
  
  if (loading && !user && typeof window !== 'undefined' && window.location.pathname !== '/login' && window.location.pathname !== '/register') {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }
  
  return (
    <AuthContext.Provider value={{ user, loading, userRole, logout, signInWithGoogle, setUser, companyName, companyLogoUrl, updateCompanyProfile }}>
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


"use client";

import type { User } from 'firebase/auth';
import { onAuthStateChanged, signOut as firebaseSignOut, GoogleAuthProvider, signInWithPopup, sendPasswordResetEmail, signInWithEmailAndPassword, updateProfile as firebaseUpdateProfile, createUserWithEmailAndPassword } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import type { PropsWithChildren} from 'react';
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { auth, firestore } from '@/lib/firebase/config';
import { doc, getDoc, setDoc, serverTimestamp, query, where, getDocs, collection, updateDoc } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import Swal from 'sweetalert2';
import type { UserRole, CompanyProfile, UserDocumentForAdmin } from '@/types';

const COMPANY_PROFILE_COLLECTION = 'company_profile';
const COMPANY_PROFILE_DOC_ID = 'main_profile';
const COMPANY_NAME_STORAGE_KEY = 'appCompanyName';
const COMPANY_LOGO_URL_STORAGE_KEY = 'appCompanyLogoUrl';
const DEFAULT_COMPANY_NAME = 'Smart Solution';
const DEFAULT_COMPANY_LOGO_URL = "https://firebasestorage.googleapis.com/v0/b/lc-vision.firebasestorage.app/o/logoa%20(1)%20(1).png?alt=media&token=b5be1b22-2d2b-4951-b433-df2e3ea7eb6e";

// Helper function to parse emails from environment variables
const getEmailsFromEnv = (envVar?: string): string[] => {
  if (!envVar) return [];
  return envVar.split(',').map(email => email.trim().toLowerCase()).filter(email => email);
};

const SUPER_ADMIN_EMAILS_FROM_ENV = getEmailsFromEnv(process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAILS);
const ADMIN_EMAILS_FROM_ENV = getEmailsFromEnv(process.env.NEXT_PUBLIC_ADMIN_EMAILS);
const SERVICE_EMAILS_FROM_ENV = getEmailsFromEnv(process.env.NEXT_PUBLIC_SERVICE_EMAILS);
const DEMO_MANAGER_EMAILS_FROM_ENV = getEmailsFromEnv(process.env.NEXT_PUBLIC_DEMO_MANAGER_EMAILS);
const STORE_MANAGER_EMAILS_FROM_ENV = getEmailsFromEnv(process.env.NEXT_PUBLIC_STORE_MANAGER_EMAILS);


interface AuthContextType {
  user: User | null;
  loading: boolean;
  userRole: UserRole | null;
  firestoreUser: UserDocumentForAdmin | null;
  login: (email: string, pass: string) => Promise<void>;
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
  const [firestoreUser, setFirestoreUser] = useState<UserDocumentForAdmin | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [companyName, setCompanyName] = useState<string>(DEFAULT_COMPANY_NAME);
  const [companyLogoUrl, setCompanyLogoUrl] = useState<string>(DEFAULT_COMPANY_LOGO_URL);
  const router = useRouter();

  const fetchInitialCompanyProfile = useCallback(async () => {
    try {
      const profileDocRef = doc(firestore, COMPANY_PROFILE_COLLECTION, COMPANY_PROFILE_DOC_ID);
      const profileDocSnap = await getDoc(profileDocRef);
      if (profileDocSnap.exists()) {
        const profileData = profileDocSnap.data() as CompanyProfile;
        const newName = profileData.companyName || DEFAULT_COMPANY_NAME;
        const newLogoUrl = profileData.companyLogoUrl || DEFAULT_COMPANY_LOGO_URL;
        setCompanyName(newName);
        setCompanyLogoUrl(newLogoUrl);
        if (typeof window !== 'undefined') {
          localStorage.setItem(COMPANY_NAME_STORAGE_KEY, newName);
          localStorage.setItem(COMPANY_LOGO_URL_STORAGE_KEY, newLogoUrl);
        }
      } else {
        const storedName = typeof window !== 'undefined' ? localStorage.getItem(COMPANY_NAME_STORAGE_KEY) : null;
        setCompanyName(storedName || DEFAULT_COMPANY_NAME);
        if (!storedName && typeof window !== 'undefined') localStorage.setItem(COMPANY_NAME_STORAGE_KEY, DEFAULT_COMPANY_NAME);

        const storedLogoUrl = typeof window !== 'undefined' ? localStorage.getItem(COMPANY_LOGO_URL_STORAGE_KEY) : null;
        setCompanyLogoUrl(storedLogoUrl || DEFAULT_COMPANY_LOGO_URL);
        if (!storedLogoUrl && typeof window !== 'undefined') localStorage.setItem(COMPANY_LOGO_URL_STORAGE_KEY, DEFAULT_COMPANY_LOGO_URL);
      }
    } catch (error: any) {
      console.error("AuthContext: Error fetching company profile from Firestore:", error);
      const storedName = typeof window !== 'undefined' ? localStorage.getItem(COMPANY_NAME_STORAGE_KEY) : null;
      setCompanyName(storedName || DEFAULT_COMPANY_NAME);
      const storedLogoUrl = typeof window !== 'undefined' ? localStorage.getItem(COMPANY_LOGO_URL_STORAGE_KEY) : null;
      setCompanyLogoUrl(storedLogoUrl || DEFAULT_COMPANY_LOGO_URL);
    }
  }, []);

  useEffect(() => {
    fetchInitialCompanyProfile();

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setLoading(true); 

      try {
        if (currentUser) {
          let roleFromEnv: UserRole | null = null;
          const lowercasedUserEmail = currentUser.email?.toLowerCase() || '';

          if (SUPER_ADMIN_EMAILS_FROM_ENV.includes(lowercasedUserEmail)) {
            roleFromEnv = "Super Admin";
          } else if (ADMIN_EMAILS_FROM_ENV.includes(lowercasedUserEmail)) {
            roleFromEnv = "Admin";
          } else if (SERVICE_EMAILS_FROM_ENV.includes(lowercasedUserEmail)) {
            roleFromEnv = "Service";
          } else if (DEMO_MANAGER_EMAILS_FROM_ENV.includes(lowercasedUserEmail)) {
            roleFromEnv = "DemoManager";
          } else if (STORE_MANAGER_EMAILS_FROM_ENV.includes(lowercasedUserEmail)) {
            roleFromEnv = "Store Manager";
          }

          const userDocRef = doc(firestore, "users", currentUser.uid);
          const userDocSnap = await getDoc(userDocRef);

          let finalUserRole: UserRole = "User"; // Default role

          if (userDocSnap.exists()) {
            const userProfileData = { id: userDocSnap.id, ...userDocSnap.data() } as UserDocumentForAdmin;
            const roleFromDb = userProfileData.role;

            if (roleFromEnv && roleFromEnv !== roleFromDb) {
              // ENV var role is the source of truth, update DB if different.
              await updateDoc(userDocRef, { role: roleFromEnv, updatedAt: serverTimestamp() });
              userProfileData.role = roleFromEnv; // Update local copy for immediate use
              finalUserRole = roleFromEnv;
              console.log(`User role for ${currentUser.email} updated in Firestore to: ${roleFromEnv}`);
            } else {
              // No ENV var role, or it matches DB. Use the role from DB.
              finalUserRole = roleFromDb || "User";
            }
            setFirestoreUser(userProfileData);

          } else {
            // User document doesn't exist, create it with the role from ENV var or default to "User"
            finalUserRole = roleFromEnv || "User";
            if (currentUser.displayName && currentUser.email) {
                const newProfileData = {
                    uid: currentUser.uid,
                    displayName: currentUser.displayName,
                    email: currentUser.email,
                    photoURL: currentUser.photoURL || null,
                    role: finalUserRole,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                };
                await setDoc(userDocRef, newProfileData);
                setFirestoreUser({id: currentUser.uid, ...newProfileData} as UserDocumentForAdmin);
            }
          }
          setUserRole(finalUserRole);
        } else {
          setFirestoreUser(null);
          setUserRole(null);
        }
      } catch (error) {
        console.error("AuthContext: Error during onAuthStateChanged profile/role processing:", error);
        setFirestoreUser(null);
        setUserRole(null);
      } finally {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [fetchInitialCompanyProfile]);


  const login = useCallback(async (email: string, pass: string) => {
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, pass);
      // onAuthStateChanged will handle setting user, firestoreUser, userRole, and setLoading(false)
      Swal.fire({
        title: "Login Successful",
        text: `Welcome back!`,
        icon: "success",
        timer: 2000,
        showConfirmButton: false,
      });
    } catch (error: any) {
      console.error("AuthContext: Error logging in: ", error);
      let errorMessage = "Failed to login. Please check your credentials.";
       if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential' || error.code === 'auth/invalid-email') {
        errorMessage = "Invalid email or password.";
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = "Too many login attempts. Please try again later.";
      } else if (error.code === 'permission-denied' || (error.message && (error.message.includes('permission') || error.message.includes('Missing or insufficient permissions')) )) {
        errorMessage = `Login failed: Missing or insufficient permissions to access user data. Original Firebase error: ${error.message}`;
      } else if (error.code) {
        errorMessage = `Login failed: ${error.message} (Code: ${error.code})`;
      } else {
        errorMessage = `Login failed: ${error.message || 'An unknown error occurred.'}`;
      }
      Swal.fire({ title: "Login Failed", text: errorMessage, icon: "error" });
      setLoading(false); 
      throw error;
    }
  }, []);

  const logout = useCallback(async () => {
    setLoading(true);
    try {
      await firebaseSignOut(auth);
      // onAuthStateChanged will handle clearing user, firestoreUser, userRole, and setting loading to false
      Swal.fire({
        title: "Logged Out",
        text: "You have been successfully logged out.",
        icon: "success",
        timer: 1500,
        showConfirmButton: false,
      });
      router.push('/login');
    } catch (error: any) {
      Swal.fire({
        title: "Logout Error",
        text: error.message || "Failed to log out. Please try again.",
        icon: "error",
      });
      setLoading(false);
    }
  }, [router]);

  const signInWithGoogle = useCallback(async () => {
    setLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
      // onAuthStateChanged takes care of user profile creation/update in Firestore and setting context state
      Swal.fire({
        title: "Sign-in Successful",
        text: `Welcome!`,
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
      } else if (error.code) {
        errorMessage = `Google Sign-In error: ${error.message} (Code: ${error.code})`;
      }
      Swal.fire({ title: "Google Sign-In Failed", text: errorMessage, icon: "error" });
      setLoading(false);
      throw error;
    }
  }, [router]);

  const updateCompanyProfile = useCallback((profile: Partial<Pick<CompanyProfile, 'companyName' | 'companyLogoUrl'>>) => {
    let newName = companyName;
    let newLogoUrl = companyLogoUrl;

    if (profile.companyName !== undefined) {
      newName = profile.companyName || DEFAULT_COMPANY_NAME;
      if (typeof window !== 'undefined') localStorage.setItem(COMPANY_NAME_STORAGE_KEY, newName);
    }
    if (profile.companyLogoUrl !== undefined) {
      newLogoUrl = profile.companyLogoUrl || DEFAULT_COMPANY_LOGO_URL;
      if (typeof window !== 'undefined') {
        localStorage.setItem(COMPANY_LOGO_URL_STORAGE_KEY, newLogoUrl);
      }
    }
    setCompanyName(newName);
    setCompanyLogoUrl(newLogoUrl);
  }, [companyName, companyLogoUrl]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', handleBeforeUnload);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('beforeunload', handleBeforeUnload);
      }
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, userRole, firestoreUser, login, logout, signInWithGoogle, setUser, companyName, companyLogoUrl, updateCompanyProfile }}>
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

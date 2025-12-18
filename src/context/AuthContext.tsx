

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
import type { UserRole, CompanyProfile, UserDocumentForAdmin, userRoles } from '@/types';

const FINANCIAL_SETTINGS_COLLECTION = 'financial_settings';
const FINANCIAL_SETTINGS_DOC_ID = 'main_settings';
const COMPANY_NAME_STORAGE_KEY = 'appCompanyName';
const COMPANY_LOGO_URL_STORAGE_KEY = 'appCompanyLogoUrl';
const INVOICE_LOGO_URL_STORAGE_KEY = 'appInvoiceLogoUrl';
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
const ACCOUNTS_EMAILS_FROM_ENV = getEmailsFromEnv(process.env.NEXT_PUBLIC_ACCOUNTS_EMAILS);
const VIEWER_EMAILS_FROM_ENV = getEmailsFromEnv(process.env.NEXT_PUBLIC_VIEWER_EMAILS);
const COMMERCIAL_EMAILS_FROM_ENV = getEmailsFromEnv(process.env.NEXT_PUBLIC_COMMERCIAL_EMAILS);
const HR_EMAILS_FROM_ENV = getEmailsFromEnv(process.env.NEXT_PUBLIC_HR_EMAILS);


interface AuthContextType {
  user: User | null;
  loading: boolean;
  userRole: UserRole[] | null; // Changed to array of roles
  firestoreUser: UserDocumentForAdmin | null;
  login: (email: string, pass: string) => Promise<void>;
  register: (email: string, pass: string, displayName: string, roles?: UserRole[]) => Promise<void>;
  logout: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  companyName: string;
  companyLogoUrl: string;
  invoiceLogoUrl: string;
  updateCompanyProfile: (profile: Partial<Pick<CompanyProfile, 'companyName' | 'companyLogoUrl' | 'invoiceLogoUrl'>>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const googleProvider = new GoogleAuthProvider();

export const AuthProvider = ({ children }: PropsWithChildren) => {
  const [user, setUser] = useState<User | null>(null);
  const [firestoreUser, setFirestoreUser] = useState<UserDocumentForAdmin | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<UserRole[] | null>(null); // Changed to array of roles
  const [companyName, setCompanyName] = useState<string>(DEFAULT_COMPANY_NAME);
  const [companyLogoUrl, setCompanyLogoUrl] = useState<string>(DEFAULT_COMPANY_LOGO_URL);
  const [invoiceLogoUrl, setInvoiceLogoUrl] = useState<string>(DEFAULT_COMPANY_LOGO_URL);
  const router = useRouter();

  const fetchInitialCompanyProfile = useCallback(async () => {
    try {
      const profileDocRef = doc(firestore, FINANCIAL_SETTINGS_COLLECTION, FINANCIAL_SETTINGS_DOC_ID);
      const profileDocSnap = await getDoc(profileDocRef);
      if (profileDocSnap.exists()) {
        const profileData = profileDocSnap.data() as CompanyProfile;
        const newName = profileData.companyName || DEFAULT_COMPANY_NAME;
        const newLogoUrl = profileData.companyLogoUrl || DEFAULT_COMPANY_LOGO_URL;
        const newInvoiceLogoUrl = profileData.invoiceLogoUrl || newLogoUrl;
        
        setCompanyName(newName);
        setCompanyLogoUrl(newLogoUrl);
        setInvoiceLogoUrl(newInvoiceLogoUrl);

        if (typeof window !== 'undefined') {
          localStorage.setItem(COMPANY_NAME_STORAGE_KEY, newName);
          localStorage.setItem(COMPANY_LOGO_URL_STORAGE_KEY, newLogoUrl);
          localStorage.setItem(INVOICE_LOGO_URL_STORAGE_KEY, newInvoiceLogoUrl);
        }
      } else {
        const storedName = typeof window !== 'undefined' ? localStorage.getItem(COMPANY_NAME_STORAGE_KEY) : null;
        setCompanyName(storedName || DEFAULT_COMPANY_NAME);
        if (!storedName && typeof window !== 'undefined') localStorage.setItem(COMPANY_NAME_STORAGE_KEY, DEFAULT_COMPANY_NAME);

        const storedLogoUrl = typeof window !== 'undefined' ? localStorage.getItem(COMPANY_LOGO_URL_STORAGE_KEY) : null;
        setCompanyLogoUrl(storedLogoUrl || DEFAULT_COMPANY_LOGO_URL);
        if (!storedLogoUrl && typeof window !== 'undefined') localStorage.setItem(COMPANY_LOGO_URL_STORAGE_KEY, DEFAULT_COMPANY_LOGO_URL);

        const storedInvoiceLogoUrl = typeof window !== 'undefined' ? localStorage.getItem(INVOICE_LOGO_URL_STORAGE_KEY) : null;
        setInvoiceLogoUrl(storedInvoiceLogoUrl || DEFAULT_COMPANY_LOGO_URL);
        if (!storedInvoiceLogoUrl && typeof window !== 'undefined') localStorage.setItem(INVOICE_LOGO_URL_STORAGE_KEY, DEFAULT_COMPANY_LOGO_URL);
      }
    } catch (error: any) {
      console.error("AuthContext: Error fetching company profile from Firestore:", error);
      const storedName = typeof window !== 'undefined' ? localStorage.getItem(COMPANY_NAME_STORAGE_KEY) : null;
      setCompanyName(storedName || DEFAULT_COMPANY_NAME);
      const storedLogoUrl = typeof window !== 'undefined' ? localStorage.getItem(COMPANY_LOGO_URL_STORAGE_KEY) : null;
      setCompanyLogoUrl(storedLogoUrl || DEFAULT_COMPANY_LOGO_URL);
      const storedInvoiceLogoUrl = typeof window !== 'undefined' ? localStorage.getItem(INVOICE_LOGO_URL_STORAGE_KEY) : null;
      setInvoiceLogoUrl(storedInvoiceLogoUrl || DEFAULT_COMPANY_LOGO_URL);
    }
  }, []);

  const handleUserAuth = useCallback(async (currentUser: User | null) => {
    if (currentUser) {
      try {
        const userDocRef = doc(firestore, "users", currentUser.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
          const userProfileData = { id: userDocSnap.id, ...userDocSnap.data() } as UserDocumentForAdmin;

          if (userProfileData.disabled) {
            await firebaseSignOut(auth);
            setUser(null);
            setFirestoreUser(null);
            setUserRole(null);
            Swal.fire({
              title: "Account Disabled",
              text: "Your account has been disabled. Please contact an administrator.",
              icon: "error",
            });
            router.push('/login');
            return;
          }

          setUser(currentUser);
          setFirestoreUser(userProfileData);
          setUserRole(Array.isArray(userProfileData.role) ? userProfileData.role : (userProfileData.role ? [userProfileData.role] : ["User"]));
        } else {
          console.warn(`Firestore document for user ${currentUser.uid} not found. Forcing logout.`);
          await firebaseSignOut(auth);
          setUser(null);
          setFirestoreUser(null);
          setUserRole(null);
          Swal.fire("Error", "User profile not found in database.", "error");
        }
      } catch (error) {
        console.error("AuthContext: Error fetching user document:", error);
        await firebaseSignOut(auth);
        setUser(null);
        setFirestoreUser(null);
        setUserRole(null);
      }
    } else {
      setUser(null);
      setFirestoreUser(null);
      setUserRole(null);
    }
    setLoading(false);
  }, [router]);

  useEffect(() => {
    fetchInitialCompanyProfile();
    const unsubscribe = onAuthStateChanged(auth, handleUserAuth);
    return () => unsubscribe();
  }, [fetchInitialCompanyProfile, handleUserAuth]);

  const login = useCallback(async (email: string, pass: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, pass);
      Swal.fire({
        title: "Login Successful",
        text: "Welcome back!",
        icon: "success",
        timer: 2000,
        showConfirmButton: false,
      });
    } catch (error: any) {
      console.error("AuthContext: Error logging in: ", error);
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
          Swal.fire({
              title: "Opps Login Failed.",
              text: "User Name or Password Wrong. Please contact with Admin",
              icon: "error"
          });
      } else {
          Swal.fire({
              title: "Login Failed",
              text: error.message || "An unknown error occurred.",
              icon: "error"
          });
      }
      throw error; // Re-throw to be caught by the login page if needed
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await firebaseSignOut(auth);
      Swal.fire({
        title: "Logged Out",
        icon: "success",
        timer: 1500,
        showConfirmButton: false,
      });
      router.push('/login');
    } catch (error: any) {
      Swal.fire("Logout Error", error.message || "Failed to log out.", "error");
    }
  }, [router]);
  
  const register = useCallback(async (email: string, pass: string, displayName: string, roles?: UserRole[]) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
      const user = userCredential.user;
  
      await firebaseUpdateProfile(user, { displayName });
  
      const userDocRef = doc(firestore, "users", user.uid);
      
      let assignedRoles: UserRole[] = [];
      if (roles && roles.length > 0) {
        assignedRoles = roles;
      } else {
        const lowercasedUserEmail = user.email?.toLowerCase() || '';
        if (SUPER_ADMIN_EMAILS_FROM_ENV.includes(lowercasedUserEmail)) assignedRoles.push("Super Admin");
        if (ADMIN_EMAILS_FROM_ENV.includes(lowercasedUserEmail)) assignedRoles.push("Admin");
        if (COMMERCIAL_EMAILS_FROM_ENV.includes(lowercasedUserEmail)) assignedRoles.push("Commercial");
        if (SERVICE_EMAILS_FROM_ENV.includes(lowercasedUserEmail)) assignedRoles.push("Service");
        if (DEMO_MANAGER_EMAILS_FROM_ENV.includes(lowercasedUserEmail)) assignedRoles.push("DemoManager");
        if (ACCOUNTS_EMAILS_FROM_ENV.includes(lowercasedUserEmail)) assignedRoles.push("Accounts");
        if (VIEWER_EMAILS_FROM_ENV.includes(lowercasedUserEmail)) assignedRoles.push("Viewer");
        if (HR_EMAILS_FROM_ENV.includes(lowercasedUserEmail)) assignedRoles.push("HR");
        if (assignedRoles.length === 0) assignedRoles.push("User");
      }
  
      const newProfileData = {
          uid: user.uid,
          displayName: displayName,
          email: user.email,
          photoURL: user.photoURL || null,
          role: [...new Set(assignedRoles)], // Ensure roles are unique
          disabled: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
      };
      await setDoc(userDocRef, newProfileData);
      
    } catch (error: any) {
      console.error("AuthContext: Error registering user: ", error);
      let errorMessage = "Failed to register. Please try again.";
      if (error.code === 'auth/email-already-in-use') errorMessage = "This email is already in use.";
      else if (error.code === 'auth/weak-password') errorMessage = "Password must be at least 6 characters.";
      else if (error.code === 'auth/invalid-email') errorMessage = "The email address is not valid.";
      else errorMessage = error.message || 'An unknown registration error occurred.';
      throw new Error(errorMessage);
    }
  }, []);
  
  const signInWithGoogle = useCallback(async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      
      const userDocRef = doc(firestore, "users", user.uid);
      const userDocSnap = await getDoc(userDocRef);
      
      if (!userDocSnap.exists()) {
          const lowercasedUserEmail = user.email?.toLowerCase() || '';
          const roles: UserRole[] = [];
          if (SUPER_ADMIN_EMAILS_FROM_ENV.includes(lowercasedUserEmail)) roles.push("Super Admin");
          if (ADMIN_EMAILS_FROM_ENV.includes(lowercasedUserEmail)) roles.push("Admin");
          if (COMMERCIAL_EMAILS_FROM_ENV.includes(lowercasedUserEmail)) roles.push("Commercial");
          if (SERVICE_EMAILS_FROM_ENV.includes(lowercasedUserEmail)) roles.push("Service");
          if (DEMO_MANAGER_EMAILS_FROM_ENV.includes(lowercasedUserEmail)) roles.push("DemoManager");
          if (ACCOUNTS_EMAILS_FROM_ENV.includes(lowercasedUserEmail)) roles.push("Accounts");
          if (VIEWER_EMAILS_FROM_ENV.includes(lowercasedUserEmail)) roles.push("Viewer");
          if (HR_EMAILS_FROM_ENV.includes(lowercasedUserEmail)) roles.push("HR");
          if (roles.length === 0) roles.push("User");
          
          const newProfileData = {
              uid: user.uid,
              displayName: user.displayName,
              email: user.email,
              photoURL: user.photoURL,
              role: roles,
              disabled: false,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
          };
          await setDoc(userDocRef, newProfileData);
      } else {
        const userData = userDocSnap.data() as UserDocumentForAdmin;
        if(userData.disabled) {
            await firebaseSignOut(auth);
            Swal.fire({
              title: "Account Disabled",
              text: "Your account has been disabled. Please contact an administrator.",
              icon: "error",
            });
            throw new Error("Account disabled");
        }
      }
      Swal.fire({
        title: "Sign-in Successful",
        text: `Welcome!`,
        icon: "success",
        timer: 2000,
        showConfirmButton: false,
      });
      router.push('/dashboard');
    } catch (error: any) {
      if (error.message !== "Account disabled") {
          console.error("Error signing in with Google: ", error);
          let errorMessage = "Failed to sign in with Google.";
          if (error.code === 'auth/account-exists-with-different-credential') errorMessage = "An account with this email already exists.";
          else if (error.code === 'auth/popup-closed-by-user') errorMessage = "Google Sign-In was cancelled.";
          else errorMessage = error.message || errorMessage;
          Swal.fire({ title: "Google Sign-In Failed", text: errorMessage, icon: "error" });
      }
      throw error;
    }
  }, [router]);

  const updateCompanyProfile = useCallback((profile: Partial<Pick<CompanyProfile, 'companyName' | 'companyLogoUrl' | 'invoiceLogoUrl'>>) => {
    let newName = companyName;
    let newLogoUrl = companyLogoUrl;
    let newInvoiceLogoUrl = invoiceLogoUrl;

    if (profile.companyName !== undefined) {
      newName = profile.companyName || DEFAULT_COMPANY_NAME;
      if (typeof window !== 'undefined') localStorage.setItem(COMPANY_NAME_STORAGE_KEY, newName);
    }
    if (profile.companyLogoUrl !== undefined) {
      newLogoUrl = profile.companyLogoUrl || DEFAULT_COMPANY_LOGO_URL;
      if (typeof window !== 'undefined') localStorage.setItem(COMPANY_LOGO_URL_STORAGE_KEY, newLogoUrl);
    }
    if (profile.invoiceLogoUrl !== undefined) {
      newInvoiceLogoUrl = profile.invoiceLogoUrl || newLogoUrl; // Fallback to main logo if cleared
      if (typeof window !== 'undefined') localStorage.setItem(INVOICE_LOGO_URL_STORAGE_KEY, newInvoiceLogoUrl);
    }

    setCompanyName(newName);
    setCompanyLogoUrl(newLogoUrl);
    setInvoiceLogoUrl(newInvoiceLogoUrl);
  }, [companyName, companyLogoUrl, invoiceLogoUrl]);

  return (
    <AuthContext.Provider value={{ user, loading, userRole, firestoreUser, login, register, logout, signInWithGoogle, setUser, companyName, companyLogoUrl, invoiceLogoUrl, updateCompanyProfile }}>
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

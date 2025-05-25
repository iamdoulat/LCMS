
"use client";

import type { User } from 'firebase/auth';
import { onAuthStateChanged, signOut as firebaseSignOut, GoogleAuthProvider, signInWithPopup, sendPasswordResetEmail, signInWithEmailAndPassword, updateProfile as firebaseUpdateProfile } from 'firebase/auth';
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

// Read role emails from environment variables
const getEmailsFromEnv = (envVar?: string): string[] => {
  if (!envVar) return [];
  return envVar.split(',').map(email => email.trim().toLowerCase()).filter(email => email);
};

const SUPER_ADMIN_EMAILS_FROM_ENV = getEmailsFromEnv(process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAILS);
const ADMIN_EMAILS_FROM_ENV = getEmailsFromEnv(process.env.NEXT_PUBLIC_ADMIN_EMAILS);
const SERVICE_EMAILS_FROM_ENV = getEmailsFromEnv(process.env.NEXT_PUBLIC_SERVICE_EMAILS);


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
        console.log("AuthContext: Company profile document does not exist in Firestore. Using defaults/localStorage.");
        const storedName = typeof window !== 'undefined' ? localStorage.getItem(COMPANY_NAME_STORAGE_KEY) : DEFAULT_COMPANY_NAME;
        setCompanyName(storedName || DEFAULT_COMPANY_NAME);
        if (!storedName && typeof window !== 'undefined') localStorage.setItem(COMPANY_NAME_STORAGE_KEY, DEFAULT_COMPANY_NAME);

        const storedLogoUrl = typeof window !== 'undefined' ? localStorage.getItem(COMPANY_LOGO_URL_STORAGE_KEY) : DEFAULT_COMPANY_LOGO_URL;
        setCompanyLogoUrl(storedLogoUrl || DEFAULT_COMPANY_LOGO_URL);
        if (!storedLogoUrl && typeof window !== 'undefined') localStorage.setItem(COMPANY_LOGO_URL_STORAGE_KEY, DEFAULT_COMPANY_LOGO_URL);
      }
    } catch (error: any) {
      console.error("AuthContext: Error fetching company profile from Firestore:", error);
      Swal.fire("Error", `Could not load company profile data from Firestore: ${error.message}. Using default or cached values.`, "error");
      const storedName = typeof window !== 'undefined' ? localStorage.getItem(COMPANY_NAME_STORAGE_KEY) : DEFAULT_COMPANY_NAME;
      setCompanyName(storedName || DEFAULT_COMPANY_NAME);
      const storedLogoUrl = typeof window !== 'undefined' ? localStorage.getItem(COMPANY_LOGO_URL_STORAGE_KEY) : DEFAULT_COMPANY_LOGO_URL;
      setCompanyLogoUrl(storedLogoUrl || DEFAULT_COMPANY_LOGO_URL);
    }
  }, []);


  useEffect(() => {
    fetchInitialCompanyProfile();

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setLoading(true);
      setUser(currentUser);
      console.log("AuthContext: onAuthStateChanged triggered. currentUser:", currentUser?.email);

      if (currentUser) {
        let assignedRole: UserRole | null = null;
        const lowercasedUserEmail = currentUser.email?.toLowerCase() || '';

        console.log(`AuthContext: Checking email '${lowercasedUserEmail}' against Super Admin list:`, SUPER_ADMIN_EMAILS_FROM_ENV);
        if (SUPER_ADMIN_EMAILS_FROM_ENV.includes(lowercasedUserEmail)) {
          assignedRole = "Super Admin";
          console.log(`AuthContext: Email '${lowercasedUserEmail}' MATCHED Super Admin.`);
        } else if (ADMIN_EMAILS_FROM_ENV.includes(lowercasedUserEmail)) {
          assignedRole = "Admin";
           console.log(`AuthContext: Email '${lowercasedUserEmail}' MATCHED Admin.`);
        } else if (SERVICE_EMAILS_FROM_ENV.includes(lowercasedUserEmail)) {
          assignedRole = "Service";
           console.log(`AuthContext: Email '${lowercasedUserEmail}' MATCHED Service.`);
        } else {
          console.log(`AuthContext: Email '${lowercasedUserEmail}' did not match any specific simulated role via environment variables.`);
        }
        console.log(`AuthContext: Role after email simulation for '${lowercasedUserEmail}': ${assignedRole}`);

        try {
          const userDocRef = doc(firestore, "users", currentUser.uid);
          const userDocSnap = await getDoc(userDocRef);

          if (userDocSnap.exists()) {
            const userProfileData = { id: userDocSnap.id, ...userDocSnap.data() } as UserDocumentForAdmin;
            setFirestoreUser(userProfileData);
            console.log("AuthContext: Fetched Firestore user profile:", userProfileData);

            if (userProfileData.role && (assignedRole === "User" || !assignedRole)) {
                assignedRole = userProfileData.role;
                console.log(`AuthContext: Role set from Firestore profile for '${lowercasedUserEmail}': ${assignedRole}`);
            } else if (assignedRole && userProfileData.role && assignedRole !== userProfileData.role) {
                 console.warn(`AuthContext: Role mismatch for ${lowercasedUserEmail}. ENV var role set '${assignedRole}', Firestore profile has '${userProfileData.role}'. Using role from ENV var due to precedence.`);
            } else if (!userProfileData.role && !assignedRole) {
                assignedRole = "User";
                console.log(`AuthContext: No role in Firestore profile for '${lowercasedUserEmail}', defaulting to 'User'.`);
            } else if (assignedRole && !userProfileData.role) {
                console.log(`AuthContext: Role for '${lowercasedUserEmail}' remains '${assignedRole}' (from ENV var) as no role found in Firestore profile.`);
            }

          } else {
            console.warn(`AuthContext: No Firestore profile found for user UID: ${currentUser.uid}. Creating one.`);
            setFirestoreUser(null);
            const userProfileDataToCreate: Omit<UserDocumentForAdmin, 'id' | 'createdAt' | 'updatedAt'> = {
                uid: currentUser.uid,
                displayName: currentUser.displayName || currentUser.email || "New User",
                email: currentUser.email || "",
                photoURL: currentUser.photoURL || undefined,
                role: assignedRole || "User",
            };
            await setDoc(doc(firestore, "users", currentUser.uid), {
                ...userProfileDataToCreate,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });
            console.log(`AuthContext: Created Firestore profile for UID: ${currentUser.uid} with role: ${assignedRole || "User"}`);
            const newUserDocSnap = await getDoc(userDocRef);
            if (newUserDocSnap.exists()) {
                setFirestoreUser({ id: newUserDocSnap.id, ...newUserDocSnap.data() } as UserDocumentForAdmin);
            }
             if (!assignedRole) assignedRole = "User";
          }
          setUserRole(assignedRole);
          console.log(`AuthContext: Final role for ${currentUser.email}: ${assignedRole}`);
        } catch (error: any) {
          console.error("AuthContext: Error fetching/creating Firestore user profile:", error);
          setFirestoreUser(null);
          setUserRole(assignedRole || "User");
          console.warn(`AuthContext: Role for ${currentUser.email} set to '${assignedRole || "User"}' due to Firestore error.`);
        } finally {
          setLoading(false);
        }
      } else {
        console.log("AuthContext: No current user (logged out).");
        setFirestoreUser(null);
        setUserRole(null);
        setUser(null);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [fetchInitialCompanyProfile]);

  const login = useCallback(async (email: string, pass: string) => {
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, pass);
      Swal.fire({
        title: "Login Successful",
        text: `Welcome back, ${userCredential.user.displayName || email}!`,
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
        errorMessage = `Login failed: Missing or insufficient permissions to access user data. Please check Firestore rules for the 'users' collection. Original error: ${error.message}`;
        console.error("AuthContext: Detailed login permission error:", error);
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
      Swal.fire({
        title: "Logged Out",
        text: "You have been successfully logged out.",
        icon: "success",
        timer: 1500,
        showConfirmButton: false,
      });
      router.push('/login');
    } catch (error: any) {
      console.error("AuthContext: Error signing out: ", error);
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
      const result = await signInWithPopup(auth, googleProvider);
      const firebaseUser = result.user;
      Swal.fire({
        title: "Sign-in Successful",
        text: `Welcome, ${firebaseUser.displayName || firebaseUser.email}!`,
        icon: "success",
        timer: 2000,
        showConfirmButton: false,
      });
    } catch (error: any) {
      console.error("AuthContext: Error signing in with Google: ", error);
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
  }, []);


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


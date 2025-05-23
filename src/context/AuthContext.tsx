
"use client";

import type { User } from 'firebase/auth';
import { onAuthStateChanged, signOut as firebaseSignOut, GoogleAuthProvider, signInWithPopup, sendPasswordResetEmail, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile as firebaseUpdateProfile } from 'firebase/auth';
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

// Hardcoded emails for simulated roles
const SIMULATED_SUPER_ADMIN_EMAILS = ['mddoulat@gmail.com', 'smswayapp@gmail.com'];
const SIMULATED_ADMIN_EMAIL = 'commercial@smartsolution-bd.com';


interface AuthContextType {
  user: User | null;
  loading: boolean;
  userRole: UserRole | null;
  firestoreUser: UserDocumentForAdmin | null;
  login: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  register: (displayName: string, email: string, pass: string) => Promise<void>;
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
      console.error("AuthContext: Error fetching company profile from Firestore:", error.message, error.code);
      const storedName = typeof window !== 'undefined' ? localStorage.getItem(COMPANY_NAME_STORAGE_KEY) : DEFAULT_COMPANY_NAME;
      setCompanyName(storedName || DEFAULT_COMPANY_NAME);
      const storedLogoUrl = typeof window !== 'undefined' ? localStorage.getItem(COMPANY_LOGO_URL_STORAGE_KEY) : DEFAULT_COMPANY_LOGO_URL;
      setCompanyLogoUrl(storedLogoUrl || DEFAULT_COMPANY_LOGO_URL);
    }
  }, []);


  useEffect(() => {
    fetchInitialCompanyProfile();

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const userDocRef = doc(firestore, "users", currentUser.uid);
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) {
            const userProfileData = userDocSnap.data() as UserDocumentForAdmin;
            setFirestoreUser(userProfileData);
            // Prioritize Firestore role, then simulated email-based role
            if (userProfileData.role) {
              setUserRole(userProfileData.role);
            } else if (SIMULATED_SUPER_ADMIN_EMAILS.includes(currentUser.email || '')) {
              setUserRole("Super Admin");
            } else if (currentUser.email === SIMULATED_ADMIN_EMAIL) {
              setUserRole("Admin");
            } else {
              setUserRole("User");
            }
          } else {
            console.warn(`AuthContext: No Firestore profile found for user UID: ${currentUser.uid}. Defaulting role.`);
            setFirestoreUser(null);
            if (SIMULATED_SUPER_ADMIN_EMAILS.includes(currentUser.email || '')) {
              setUserRole("Super Admin");
            } else if (currentUser.email === SIMULATED_ADMIN_EMAIL) {
              setUserRole("Admin");
            } else {
              setUserRole("User"); // Default to "User" if no Firestore profile and no email match
            }
          }
        } catch (error) {
          console.error("AuthContext: Error fetching Firestore user profile:", error);
          setFirestoreUser(null);
          // Fallback to email simulation if Firestore fetch fails
            if (SIMULATED_SUPER_ADMIN_EMAILS.includes(currentUser.email || '')) {
              setUserRole("Super Admin");
            } else if (currentUser.email === SIMULATED_ADMIN_EMAIL) {
              setUserRole("Admin");
            } else {
              setUserRole("User");
            }
        }
      } else {
        setFirestoreUser(null);
        setUserRole(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [fetchInitialCompanyProfile]);

  const login = useCallback(async (email: string, pass: string) => {
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, pass);
      const firebaseUser = userCredential.user;

      // Fetch Firestore profile to get the role after Firebase Auth login
      const userDocRef = doc(firestore, "users", firebaseUser.uid);
      const userDocSnap = await getDoc(userDocRef);
      if (userDocSnap.exists()) {
        const userProfileData = userDocSnap.data() as UserDocumentForAdmin;
        setFirestoreUser(userProfileData);
        setUserRole(userProfileData.role || "User"); // Default to "User" if role not set in Firestore
      } else {
        // If no Firestore profile, simulate role based on email
        console.warn(`AuthContext: No Firestore profile found for user UID: ${firebaseUser.uid} after login. Simulating role.`);
        if (SIMULATED_SUPER_ADMIN_EMAILS.includes(email)) {
          setUserRole("Super Admin");
        } else if (email === SIMULATED_ADMIN_EMAIL) {
          setUserRole("Admin");
        } else {
          setUserRole("User");
        }
        setFirestoreUser(null); // No specific firestore profile data
      }

      // The onAuthStateChanged listener will also update the main user state
      Swal.fire({
        title: "Login Successful",
        text: `Welcome back, ${firebaseUser.displayName || email}!`,
        icon: "success",
        timer: 2000,
        showConfirmButton: false,
      });
      router.push('/dashboard');
    } catch (error: any) {
      console.error("Error logging in:", error);
      let errorMessage = "Failed to login. Please check your credentials.";
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        errorMessage = "Invalid email or password.";
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = "Too many login attempts. Please try again later.";
      } else if (error.code === 'permission-denied' || (error.message && error.message.includes('permission'))) {
        errorMessage = "Missing or insufficient permissions. Please check Firestore rules.";
      } else if (error.code) {
        errorMessage = `Login failed: ${error.message} (Code: ${error.code})`;
      }
      Swal.fire({ title: "Login Failed", text: errorMessage, icon: "error" });
      setLoading(false);
      throw error;
    }
  }, [router]);

  const register = useCallback(async (displayName: string, email: string, pass: string) => {
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
      const firebaseUser = userCredential.user;
      await firebaseUpdateProfile(firebaseUser, { displayName });

      let assignedRole: UserRole = "User"; // Default role
      if (SIMULATED_SUPER_ADMIN_EMAILS.includes(email)) {
        assignedRole = "Super Admin";
      } else if (email === SIMULATED_ADMIN_EMAIL) {
        assignedRole = "Admin";
      }

      // Create user profile in Firestore
      const userProfileData: Omit<UserDocumentForAdmin, 'id' | 'createdAt' | 'updatedAt'> = {
        uid: firebaseUser.uid,
        displayName: displayName,
        email: email,
        photoURL: firebaseUser.photoURL || undefined,
        role: assignedRole,
      };
      await setDoc(doc(firestore, "users", firebaseUser.uid), {
        ...userProfileData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      
      Swal.fire({
        title: "Registration Successful",
        text: "Your account has been created. Redirecting to dashboard...",
        icon: "success",
        timer: 2000,
        showConfirmButton: false,
      });
      // onAuthStateChanged will handle setting user, firestoreUser, userRole
      router.push('/dashboard');
    } catch (error: any) {
      console.error("Error registering user:", error);
      Swal.fire({
        title: "Registration Failed",
        text: error.message || "Could not register user.",
        icon: "error",
      });
      setLoading(false);
      throw error;
    }
  }, [router]);


  const logout = useCallback(async () => {
    setLoading(true);
    try {
      await firebaseSignOut(auth);
      // User state will be cleared by onAuthStateChanged
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
      setLoading(false); // Ensure loading is false on error
    }
  }, [router]);

  const signInWithGoogle = useCallback(async () => {
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const firebaseUser = result.user;
      
      const userDocRef = doc(firestore, "users", firebaseUser.uid);
      const userDocSnap = await getDoc(userDocRef);
      
      let assignedRole: UserRole = "User"; 
      if (SIMULATED_SUPER_ADMIN_EMAILS.includes(firebaseUser.email || '')) {
        assignedRole = "Super Admin";
      } else if (firebaseUser.email === SIMULATED_ADMIN_EMAIL) {
        assignedRole = "Admin";
      }

      if (!userDocSnap.exists()) {
        const userProfileData: Omit<UserDocumentForAdmin, 'id' | 'createdAt' | 'updatedAt'> = {
          uid: firebaseUser.uid,
          displayName: firebaseUser.displayName || firebaseUser.email || "Google User",
          email: firebaseUser.email || "",
          photoURL: firebaseUser.photoURL || undefined,
          role: assignedRole,
        };
        await setDoc(userDocRef, {
          ...userProfileData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        const existingProfile = userDocSnap.data() as UserDocumentForAdmin;
        // Update existing Firestore profile if needed (e.g., if display name/photo changed in Google)
        // Or update role if it wasn't set or needs to align with simulated roles
        const updates: Partial<UserDocumentForAdmin> & {updatedAt: any} = { updatedAt: serverTimestamp() };
        if (firebaseUser.displayName && existingProfile.displayName !== firebaseUser.displayName) {
            updates.displayName = firebaseUser.displayName;
        }
        if (firebaseUser.photoURL && existingProfile.photoURL !== firebaseUser.photoURL) {
            updates.photoURL = firebaseUser.photoURL;
        }
        if (assignedRole !== existingProfile.role && (!existingProfile.role || SIMULATED_SUPER_ADMIN_EMAILS.includes(firebaseUser.email || '') || firebaseUser.email === SIMULATED_ADMIN_EMAIL) ) {
            // Only override if existing role is not set, or if email matches a simulated admin/superadmin
            updates.role = assignedRole;
        }
        if (Object.keys(updates).length > 1) { // Check if there's more than just updatedAt
            await updateDoc(userDocRef, updates);
        }
      }
      
      Swal.fire({
        title: "Login Successful",
        text: `Welcome, ${firebaseUser.displayName || firebaseUser.email}!`,
        icon: "success",
        timer: 2000,
        showConfirmButton: false,
      });
      // onAuthStateChanged will handle setting user, firestoreUser, userRole
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
    } else if (profile.companyLogoUrl === null) { 
        setCompanyLogoUrl(DEFAULT_COMPANY_LOGO_URL);
        if (typeof window !== 'undefined') localStorage.setItem(COMPANY_LOGO_URL_STORAGE_KEY, DEFAULT_COMPANY_LOGO_URL);
    }
  }, []);
  
  return (
    <AuthContext.Provider value={{ user, loading, userRole, firestoreUser, login, logout, signInWithGoogle, register, setUser, companyName, companyLogoUrl, updateCompanyProfile }}>
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


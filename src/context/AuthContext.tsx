
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
const SIMULATED_SUPER_ADMIN_EMAILS = ['mddoulat@gmail.com']; // Only mddoulat@gmail.com is Super Admin
const SIMULATED_ADMIN_EMAIL = 'commercial@smartsolution-bd.com';
const SIMULATED_SERVICE_EMAILS = ['service@smartsolution-bd.com'];


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

      if (currentUser) {
        try {
          console.log(`AuthContext: Auth state changed. Current user UID: ${currentUser.uid}, Email: ${currentUser.email}`);
          const userDocRef = doc(firestore, "users", currentUser.uid);
          const userDocSnap = await getDoc(userDocRef);

          if (userDocSnap.exists()) {
            const userProfileData = { id: userDocSnap.id, ...userDocSnap.data() } as UserDocumentForAdmin;
            setFirestoreUser(userProfileData);
            console.log("AuthContext: Fetched Firestore user profile:", userProfileData);

            if (userProfileData.role) {
              setUserRole(userProfileData.role);
              console.log(`AuthContext: Role set from Firestore profile: ${userProfileData.role}`);
            } else {
              // Fallback to simulated roles if Firestore profile has no role
              if (SIMULATED_SUPER_ADMIN_EMAILS.includes(currentUser.email || '')) {
                setUserRole("Super Admin");
                console.log("AuthContext: Role set by simulated email (Super Admin) because Firestore role missing.");
              } else if (SIMULATED_ADMIN_EMAIL === (currentUser.email || '')) {
                setUserRole("Admin");
                console.log("AuthContext: Role set by simulated email (Admin) because Firestore role missing.");
              } else if (SIMULATED_SERVICE_EMAILS.includes(currentUser.email || '')) {
                setUserRole("Service");
                console.log("AuthContext: Role set by simulated email (Service) because Firestore role missing.");
              } else {
                setUserRole("User");
                console.log("AuthContext: Role defaulted to User (no Firestore role, no email match).");
              }
            }
          } else {
            console.warn(`AuthContext: No Firestore profile found for user UID: ${currentUser.uid}. Creating one and simulating role.`);
            setFirestoreUser(null);
            let assignedRole: UserRole = "User";
            if (SIMULATED_SUPER_ADMIN_EMAILS.includes(currentUser.email || '')) {
              assignedRole = "Super Admin";
            } else if (SIMULATED_ADMIN_EMAIL === (currentUser.email || '')) {
              assignedRole = "Admin";
            } else if (SIMULATED_SERVICE_EMAILS.includes(currentUser.email || '')) {
              assignedRole = "Service";
            }
            setUserRole(assignedRole);
            // Create a basic profile in Firestore if it doesn't exist
            const userProfileDataToCreate: Omit<UserDocumentForAdmin, 'id' | 'createdAt' | 'updatedAt'> = {
                uid: currentUser.uid,
                displayName: currentUser.displayName || currentUser.email || "New User",
                email: currentUser.email || "",
                photoURL: currentUser.photoURL || undefined,
                role: assignedRole,
            };
            await setDoc(doc(firestore, "users", currentUser.uid), {
                ...userProfileDataToCreate,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });
            console.log(`AuthContext: Created Firestore profile for UID: ${currentUser.uid} with role: ${assignedRole}`);
          }
        } catch (error: any) {
          console.error("AuthContext: Error fetching/creating Firestore user profile:", error.code, error.message);
          setFirestoreUser(null);
          // Fallback to email simulation if Firestore fetch/create fails
            if (SIMULATED_SUPER_ADMIN_EMAILS.includes(currentUser.email || '')) {
                setUserRole("Super Admin");
            } else if (SIMULATED_ADMIN_EMAIL === (currentUser.email || '')) {
                setUserRole("Admin");
            } else if (SIMULATED_SERVICE_EMAILS.includes(currentUser.email || '')) {
                setUserRole("Service");
            } else {
                setUserRole("User");
            }
        } finally {
          setLoading(false);
        }
      } else {
        console.log("AuthContext: No current user.");
        setFirestoreUser(null);
        setUserRole(null);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [fetchInitialCompanyProfile]);

  const login = useCallback(async (email: string, pass: string) => {
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, pass);
      const firebaseUser = userCredential.user;
      // onAuthStateChanged will handle setting user, firestoreUser, userRole, and final loading state
      Swal.fire({
        title: "Login Successful",
        text: `Welcome back, ${firebaseUser.displayName || email}!`,
        icon: "success",
        timer: 2000,
        showConfirmButton: false,
      });
      router.push('/dashboard');
    } catch (error: any) {
      console.error("AuthContext: Error logging in: ", error);
      let errorMessage = "Failed to login. Please check your credentials.";
       if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential' || error.code === 'auth/invalid-email') {
        errorMessage = "Invalid email or password.";
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = "Too many login attempts. Please try again later.";
      } else if (error.code === 'permission-denied' || (error.message && (error.message.includes('permission') || error.message.includes('Missing or insufficient permissions')) )) {
        errorMessage = `Login failed: Missing or insufficient permissions to access user data. Please check Firestore rules for the 'users' collection. Original error: ${error.message}`;
      } else if (error.code) {
        errorMessage = `Login failed: ${error.message} (Code: ${error.code})`;
      } else {
        errorMessage = `Login failed: ${error.message || 'An unknown error occurred.'}`;
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

      let assignedRole: UserRole = "User";
      if (SIMULATED_SUPER_ADMIN_EMAILS.includes(email)) {
        assignedRole = "Super Admin";
      } else if (email === SIMULATED_ADMIN_EMAIL) {
        assignedRole = "Admin";
      } else if (SIMULATED_SERVICE_EMAILS.includes(email)) {
        assignedRole = "Service";
      }

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
      router.push('/dashboard');
    } catch (error: any) {
      console.error("AuthContext: Error registering user:", error);
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
      Swal.fire({
        title: "Logged Out",
        text: "You have been successfully logged out.",
        icon: "success",
        timer: 2000,
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

      const userDocRef = doc(firestore, "users", firebaseUser.uid);
      const userDocSnap = await getDoc(userDocRef);

      let assignedRole: UserRole = "User";
      if (SIMULATED_SUPER_ADMIN_EMAILS.includes(firebaseUser.email || '')) {
        assignedRole = "Super Admin";
      } else if (firebaseUser.email === SIMULATED_ADMIN_EMAIL) {
        assignedRole = "Admin";
      } else if (SIMULATED_SERVICE_EMAILS.includes(firebaseUser.email || '')) {
        assignedRole = "Service";
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
        const updates: Partial<Omit<UserDocumentForAdmin, 'id' | 'createdAt'>> & {updatedAt: any} = { updatedAt: serverTimestamp() };

        if (firebaseUser.displayName && existingProfile.displayName !== firebaseUser.displayName) {
            updates.displayName = firebaseUser.displayName;
        }
        if (firebaseUser.photoURL && existingProfile.photoURL !== firebaseUser.photoURL) {
            updates.photoURL = firebaseUser.photoURL;
        }
        
        let roleToSet = existingProfile.role || "User";
        if (SIMULATED_SUPER_ADMIN_EMAILS.includes(firebaseUser.email || '')) roleToSet = "Super Admin";
        else if (SIMULATED_ADMIN_EMAIL === (firebaseUser.email || '')) roleToSet = "Admin";
        else if (SIMULATED_SERVICE_EMAILS.includes(firebaseUser.email || '')) roleToSet = "Service";

        if (roleToSet !== existingProfile.role) {
            updates.role = roleToSet;
        }

        if (Object.keys(updates).length > 1) { 
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

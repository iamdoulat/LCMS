
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

// Hardcoded emails for simulated roles - ensure these are lowercase for comparison
// Super Admin has highest precedence
const SIMULATED_SUPER_ADMIN_EMAILS = ['mddoulat@gmail.com', 'smswayapp@gmail.com'].map(email => email.toLowerCase());
const SIMULATED_ADMIN_EMAIL = 'commercial@smartsolution-bd.com'.toLowerCase();
const SIMULATED_SERVICE_EMAILS = ['service@smartsolution-bd.com'].map(email => email.toLowerCase());

interface AuthContextType {
  user: User | null;
  loading: boolean;
  userRole: UserRole | null;
  firestoreUser: UserDocumentForAdmin | null;
  login: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  register: (displayName: string, email: string, pass: string) => Promise<void>;
  setUser: React.Dispatch<React.SetStateAction<User | null>>; // For profile updates
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
    fetchInitialCompanyProfile(); // Fetch once on mount

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      console.log("AuthContext: onAuthStateChanged triggered. currentUser:", currentUser?.email);
      setLoading(true);
      setUser(currentUser);

      if (currentUser) {
        let assignedRole: UserRole = "User"; // Default role
        const lowercasedUserEmail = currentUser.email?.toLowerCase() || '';
        
        console.log(`AuthContext: Checking email '${lowercasedUserEmail}' against Super Admin list:`, SIMULATED_SUPER_ADMIN_EMAILS);
        if (SIMULATED_SUPER_ADMIN_EMAILS.includes(lowercasedUserEmail)) {
          assignedRole = "Super Admin";
          console.log(`AuthContext: Email '${lowercasedUserEmail}' MATCHED Super Admin.`);
        } else {
          console.log(`AuthContext: Email '${lowercasedUserEmail}' DID NOT MATCH Super Admin.`);
          if (SIMULATED_ADMIN_EMAIL === lowercasedUserEmail) {
            assignedRole = "Admin";
            console.log(`AuthContext: Email '${lowercasedUserEmail}' MATCHED Admin.`);
          } else if (SIMULATED_SERVICE_EMAILS.includes(lowercasedUserEmail)) {
            assignedRole = "Service";
            console.log(`AuthContext: Email '${lowercasedUserEmail}' MATCHED Service.`);
          } else {
            console.log(`AuthContext: Email '${lowercasedUserEmail}' assigned default 'User' role initially.`);
          }
        }
        
        console.log(`AuthContext: Role after email simulation for '${lowercasedUserEmail}': ${assignedRole}`);

        try {
          const userDocRef = doc(firestore, "users", currentUser.uid);
          const userDocSnap = await getDoc(userDocRef);

          if (userDocSnap.exists()) {
            const userProfileData = { id: userDocSnap.id, ...userDocSnap.data() } as UserDocumentForAdmin;
            setFirestoreUser(userProfileData);
            console.log("AuthContext: Fetched Firestore user profile:", userProfileData);

            // Only use Firestore role if no higher-privilege simulated role was already assigned by email
            // AND if a role actually exists in the Firestore document.
            if (userProfileData.role && (assignedRole === "User")) {
              assignedRole = userProfileData.role;
              console.log(`AuthContext: Role updated from Firestore for '${lowercasedUserEmail}': ${assignedRole}`);
            } else if (userProfileData.role && assignedRole !== "User") {
              console.log(`AuthContext: Firestore role '${userProfileData.role}' for '${lowercasedUserEmail}' ignored because a higher privilege role '${assignedRole}' was already set by email simulation.`);
            } else if (!userProfileData.role) {
              console.log(`AuthContext: No 'role' field in Firestore profile for '${lowercasedUserEmail}'. Keeping simulated role: ${assignedRole}`);
            }
          } else {
            console.warn(`AuthContext: No Firestore profile found for user UID: ${currentUser.uid}. Creating one with role: ${assignedRole}`);
            setFirestoreUser(null);
            const userProfileDataToCreate: Omit<UserDocumentForAdmin, 'id' | 'createdAt' | 'updatedAt'> = {
                uid: currentUser.uid,
                displayName: currentUser.displayName || currentUser.email || "New User",
                email: currentUser.email || "",
                photoURL: currentUser.photoURL || undefined,
                role: assignedRole, // Use the role determined by email simulation or default
            };
            await setDoc(doc(firestore, "users", currentUser.uid), {
                ...userProfileDataToCreate,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });
            console.log(`AuthContext: Created Firestore profile for UID: ${currentUser.uid} with role: ${assignedRole}`);
            const newUserDocSnap = await getDoc(userDocRef); // Re-fetch to set firestoreUser
            if (newUserDocSnap.exists()) {
                setFirestoreUser({ id: newUserDocSnap.id, ...newUserDocSnap.data() } as UserDocumentForAdmin);
            }
          }
          setUserRole(assignedRole);
          console.log(`AuthContext: Final role for ${currentUser.email}: ${assignedRole}`);

        } catch (error: any) {
          console.error("AuthContext: Error fetching/creating Firestore user profile:", error);
          setFirestoreUser(null);
          // If Firestore operations fail, role remains as determined by email simulation.
          setUserRole(assignedRole); 
          console.warn(`AuthContext: Role for ${currentUser.email} set to '${assignedRole}' due to Firestore error.`);
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
      // onAuthStateChanged will handle setting user, firestoreUser, userRole, and final loading state
      Swal.fire({
        title: "Login Successful",
        text: `Welcome back, ${userCredential.user.displayName || email}!`,
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
        console.error("AuthContext: Detailed login permission error:", error);
      } else if (error.code) {
        errorMessage = `Login failed: ${error.message} (Code: ${error.code})`;
      } else {
        errorMessage = `Login failed: ${error.message || 'An unknown error occurred.'}`;
      }
      Swal.fire({ title: "Login Failed", text: errorMessage, icon: "error" });
      setLoading(false); // Explicitly set loading false on login error
      throw error;
    }
    // setLoading(false) is now handled by onAuthStateChanged's finally block
  }, [router]);

  const register = useCallback(async (displayName: string, email: string, pass: string) => {
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
      const firebaseUser = userCredential.user;
      await firebaseUpdateProfile(firebaseUser, { displayName });

      // Determine role based on email during registration
      const lowercasedUserEmail = firebaseUser.email?.toLowerCase() || '';
      let assignedRole: UserRole = "User"; // Default

      if (SIMULATED_SUPER_ADMIN_EMAILS.includes(lowercasedUserEmail)) {
        assignedRole = "Super Admin";
      } else if (SIMULATED_ADMIN_EMAIL === lowercasedUserEmail) {
        assignedRole = "Admin";
      } else if (SIMULATED_SERVICE_EMAILS.includes(lowercasedUserEmail)) {
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
      // onAuthStateChanged will handle the rest of the state updates including role and firestoreUser

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
      setLoading(false); // Explicitly set loading false on registration error
      throw error;
    }
    // setLoading(false) is handled by onAuthStateChanged
  }, [router]);


  const logout = useCallback(async () => {
    setLoading(true);
    try {
      await firebaseSignOut(auth);
      // setUser, setFirestoreUser, setUserRole will be cleared by onAuthStateChanged
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
    } finally {
      // onAuthStateChanged will set loading to false after clearing user states
    }
  }, [router]);

  const signInWithGoogle = useCallback(async () => {
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const firebaseUser = result.user;

      const userDocRef = doc(firestore, "users", firebaseUser.uid);
      const userDocSnap = await getDoc(userDocRef);

      const lowercasedUserEmail = firebaseUser.email?.toLowerCase() || '';
      let assignedRole: UserRole = "User"; // Default

      if (SIMULATED_SUPER_ADMIN_EMAILS.includes(lowercasedUserEmail)) {
        assignedRole = "Super Admin";
      } else if (SIMULATED_ADMIN_EMAIL === lowercasedUserEmail) {
        assignedRole = "Admin";
      } else if (SIMULATED_SERVICE_EMAILS.includes(lowercasedUserEmail)) {
        assignedRole = "Service";
      }

      if (userDocSnap.exists()) {
        const existingProfile = userDocSnap.data() as UserDocumentForAdmin;
        // Only update Firestore role if email simulation gives higher or same,
        // or if Firestore role is missing. Preserve higher roles from Firestore if email simulation is 'User'.
        let roleToSet = assignedRole;
        if (existingProfile.role && assignedRole === "User") { // If email simulation is default, prefer Firestore role
            roleToSet = existingProfile.role;
        } else if (existingProfile.role && assignedRole !== "Super Admin" && existingProfile.role === "Super Admin"){
            roleToSet = "Super Admin"; // Preserve super admin from firestore
        } else if (existingProfile.role && assignedRole !== "Admin" && existingProfile.role === "Admin" && assignedRole !== "Super Admin"){
             roleToSet = "Admin"; // Preserve admin from firestore
        }
        
        const updates: Partial<Omit<UserDocumentForAdmin, 'id' | 'createdAt'>> & {updatedAt: any} = { updatedAt: serverTimestamp() };
        let needsUpdate = false;
        if (firebaseUser.displayName && existingProfile.displayName !== firebaseUser.displayName) {
            updates.displayName = firebaseUser.displayName;
            needsUpdate = true;
        }
        if (firebaseUser.photoURL && existingProfile.photoURL !== firebaseUser.photoURL) {
            updates.photoURL = firebaseUser.photoURL;
            needsUpdate = true;
        }
        if (roleToSet !== existingProfile.role) { // Update role if different
            updates.role = roleToSet;
            needsUpdate = true;
        }
        if (needsUpdate) await updateDoc(userDocRef, updates);
      } else { // New user via Google, Firestore profile doesn't exist
        const userProfileData: Omit<UserDocumentForAdmin, 'id' | 'createdAt' | 'updatedAt'> = {
          uid: firebaseUser.uid,
          displayName: firebaseUser.displayName || firebaseUser.email || "Google User",
          email: firebaseUser.email || "",
          photoURL: firebaseUser.photoURL || undefined,
          role: assignedRole, // Use role determined by email simulation
        };
        await setDoc(userDocRef, {
          ...userProfileData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      // onAuthStateChanged will handle setting user, firestoreUser, userRole, and final loading state

      Swal.fire({
        title: "Login Successful",
        text: `Welcome, ${firebaseUser.displayName || firebaseUser.email}!`,
        icon: "success",
        timer: 2000,
        showConfirmButton: false,
      });
      router.push('/dashboard');
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
      setLoading(false); // Explicitly set loading false on Google sign-in error
    }
    // setLoading(false) is handled by onAuthStateChanged
  }, [router]);

 const updateCompanyProfile = useCallback((profile: Partial<Pick<CompanyProfile, 'companyName' | 'companyLogoUrl'>>) => {
    let newName = companyName;
    let newLogoUrl = companyLogoUrl;

    if (profile.companyName !== undefined) {
      newName = profile.companyName;
      if (typeof window !== 'undefined') localStorage.setItem(COMPANY_NAME_STORAGE_KEY, profile.companyName);
    }
    if (profile.companyLogoUrl !== undefined) {
      newLogoUrl = profile.companyLogoUrl || DEFAULT_COMPANY_LOGO_URL; // Fallback to default if cleared
      if (typeof window !== 'undefined') {
        localStorage.setItem(COMPANY_LOGO_URL_STORAGE_KEY, newLogoUrl);
      }
    }
    setCompanyName(newName);
    setCompanyLogoUrl(newLogoUrl);
  }, [companyName, companyLogoUrl]);


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

    
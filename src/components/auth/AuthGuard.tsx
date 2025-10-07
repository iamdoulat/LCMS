

"use client";

import type { User } from 'firebase/auth';
import { onAuthStateChanged, signOut as firebaseSignOut, GoogleAuthProvider, signInWithPopup, sendPasswordResetEmail, signInWithEmailAndPassword, updateProfile as firebaseUpdateProfile, createUserWithEmailAndPassword } from 'firebase/auth';
import { useRouter, usePathname } from 'next/navigation';
import type { PropsWithChildren} from 'react';
import React, { useEffect } from 'react';
import type { UserRole } from '@/types';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const publicPaths = ['/login', '/register']; // Paths accessible without authentication
const dashboardPath = '/dashboard';

// Paths that any authenticated user should be able to access regardless of role.
const coreAllowedPaths = [
    '/dashboard',
    '/dashboard/account-details',
    '/dashboard/notifications',
    '/dashboard/search'
];

// Define allowed path prefixes for restricted roles
// This now acts as a whitelist. If a role is not in this list for a given path, access is denied.
const roleAllowedPaths: Record<string, UserRole[]> = {
  "/dashboard/inventory": ["Super Admin", "Admin", "Accounts", "Viewer", "Commercial"],
  "/dashboard/quotations": ["Super Admin", "Admin", "Accounts", "Viewer", "Commercial"],
  "/dashboard/invoices": ["Super Admin", "Admin", "Accounts", "Viewer", "Commercial"],
  "/dashboard/pi": ["Super Admin", "Admin", "Accounts", "Viewer", "Commercial"],
  "/dashboard/purchase-orders": ["Super Admin", "Admin", "Accounts", "Viewer", "Commercial"],
  "/dashboard/inventory/orders": ["Super Admin", "Admin", "Accounts", "Viewer", "Commercial"],
  "/dashboard/payments": ["Super Admin", "Admin", "Accounts", "Viewer", "Commercial"],
  "/dashboard/financial-management": ["Super Admin", "Admin", "Accounts", "Viewer", "Commercial"],
  "/dashboard/commission-management": ["Super Admin", "Admin", "Viewer", "Commercial"],
  "/dashboard/total-lc": ["Super Admin", "Admin", "Viewer", "Commercial"],
  "/dashboard/reports": ["Super Admin", "Admin", "Viewer", "Commercial"],
  "/dashboard/shipments": ["Super Admin", "Admin", "Viewer", "Commercial"],
  "/dashboard/demo": ["Super Admin", "Admin", "DemoManager", "Viewer", "Commercial"],
  "/dashboard/warranty-management": ["Super Admin", "Admin", "Service", "Viewer", "Commercial"],
  "/dashboard/suppliers": ["Super Admin", "Admin", "Viewer", "Commercial", "Accounts", "Service", "DemoManager"],
  "/dashboard/customers": ["Super Admin", "Admin", "Viewer", "Commercial", "Accounts", "Service", "DemoManager"],
  "/dashboard/petty-cash": ["Super Admin", "Admin", "Accounts", "Viewer"],
  "/dashboard/petty_cash": ["Super Admin", "Admin", "Accounts", "Viewer"],
  "/dashboard/google-sheets": ["Super Admin", "Admin", "Viewer", "Commercial"],
  "/dashboard/google-drive": ["Super Admin", "Admin", "Viewer", "Commercial"],
  "/dashboard/settings": ["Super Admin", "Admin", "Viewer"],
  "/dashboard/hr": ["Super Admin", "Admin", "HR", "Viewer"],
};

// Define default redirect paths for restricted roles
const roleRedirects: Record<string, string> = {
  "User": '/dashboard', 
  "Service": process.env.NEXT_PUBLIC_REDIRECT_PATH_SERVICE || '/dashboard/warranty-management/search',
  "DemoManager": process.env.NEXT_PUBLIC_REDIRECT_PATH_DEMO_MANAGER || '/dashboard/demo/demo-machine-search',
  "Accounts": process.env.NEXT_PUBLIC_REDIRECT_PATH_ACCOUNTS || '/dashboard/petty-cash/dashboard',
  "HR": '/dashboard/hr/dashboard',
  "Viewer": '/dashboard',
  "Commercial": '/dashboard/total-lc',
};


export default function AuthGuard({ children }: PropsWithChildren) {
  const { user, userRole, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) {
      return; // Wait until auth state and role are fully loaded
    }

    if (!user) {
      if (!publicPaths.includes(pathname)) {
        router.replace('/login');
      }
      return;
    }

    if (publicPaths.includes(pathname)) {
      router.replace(dashboardPath);
      return;
    }
    
    if (userRole) {
      const userRoles = Array.isArray(userRole) ? userRole : [userRole];

      if (userRoles.includes("Super Admin") || userRoles.includes("Admin")) {
        return; // Admins have full access
      }

      if (coreAllowedPaths.some(corePath => pathname.startsWith(corePath))) {
        return; // Core paths are accessible to all authenticated users
      }
      
      const matchedPathPrefix = Object.keys(roleAllowedPaths).find(prefix => pathname.startsWith(prefix));

      if (matchedPathPrefix) {
        const allowedRolesForPath = roleAllowedPaths[matchedPathPrefix];
        // Check if ALL of the user's roles are included in the allowed list for the path
        const hasAccess = userRoles.every(role => allowedRolesForPath.includes(role));
        
        if (!hasAccess) {
          // If any role is not permitted, redirect
          const primaryRole = userRoles[0]; 
          router.replace(roleRedirects[primaryRole] || dashboardPath);
        }
      } else {
        // If the path doesn't match any defined prefix, it's considered restricted.
        const primaryRole = userRoles[0];
        router.replace(roleRedirects[primaryRole] || dashboardPath);
      }
    }
  }, [user, userRole, loading, router, pathname]);

  // Show loading spinner while auth state or role is being determined
  if (loading || (!user && !publicPaths.includes(pathname))) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }
  
  // Render children if authenticated and access is permitted
  return <>{children}</>; 
}

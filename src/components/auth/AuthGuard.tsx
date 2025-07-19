
"use client";

import { useAuth } from '@/context/AuthContext';
import { Loader2 } from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';
import type { PropsWithChildren} from 'react';
import React, { useEffect } from 'react';
import type { UserRole } from '@/types';

const publicPaths = ['/login', '/register']; // Paths accessible without authentication
const dashboardPath = '/dashboard';

// Define allowed path prefixes for restricted roles
const roleAllowedPaths: Record<string, string[]> = {
  "Service": ['/dashboard/warranty-management'],
  "DemoManager": ['/dashboard/demo'],
  "Store Manager": [
    '/dashboard/items', 
    '/dashboard/inventory', 
    '/dashboard/quotes', 
    '/dashboard/invoices', 
    '/dashboard/orders', 
    '/dashboard/payments', 
    '/dashboard/financial-management'
  ],
};

// Define paths that are explicitly disallowed for certain roles.
const roleDisallowedPaths: Partial<Record<UserRole, string[]>> = {
  "User": ['/dashboard/total-lc'],
};


// Define default redirect paths for restricted roles
// Fallback values are provided in case the environment variables are not set.
const roleRedirects: Record<string, string> = {
  "User": '/dashboard', // Default for "User" role if they access a disallowed path
  "Service": process.env.NEXT_PUBLIC_REDIRECT_PATH_SERVICE || '/dashboard/warranty-management/search',
  "DemoManager": process.env.NEXT_PUBLIC_REDIRECT_PATH_DEMO_MANAGER || '/dashboard/demo/demo-machine-search',
  "Store Manager": process.env.NEXT_PUBLIC_REDIRECT_PATH_STORE_MANAGER || '/dashboard/items/list',
};


export default function AuthGuard({ children }: PropsWithChildren) {
  const { user, userRole, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) {
      return; // Wait until auth state and role are fully loaded
    }

    // If not authenticated, redirect to login unless on a public page
    if (!user) {
      if (!publicPaths.includes(pathname)) {
        router.replace('/login');
      }
      return;
    }

    // If authenticated, handle redirection and access control
    if (user && userRole) {
      // Redirect away from public pages if logged in
      if (publicPaths.includes(pathname)) {
        router.replace(dashboardPath);
        return;
      }
      
      const userRoles = Array.isArray(userRole) ? userRole : [userRole];

      // Check for explicitly disallowed paths first
      for (const role of userRoles) {
        const disallowed = roleDisallowedPaths[role as UserRole];
        if (disallowed && disallowed.some(prefix => pathname.startsWith(prefix))) {
          const redirectPath = roleRedirects[role] || dashboardPath;
          router.replace(redirectPath);
          return;
        }
      }
      
      // Determine the primary role for redirection purposes (could be the first in the list, or a prioritized one)
      const primaryRole = userRoles[0]; // Simple approach: use the first role for redirects

      // Check for roles with limited allowed paths
      if (roleAllowedPaths[primaryRole]) {
        let isPathAllowed = userRoles.some(role => {
          const allowed = roleAllowedPaths[role];
          return allowed && allowed.some(prefix => pathname.startsWith(prefix));
        });

        // Also allow access to core pages like account settings and notifications
        const isCorePathAllowed = pathname === dashboardPath || pathname.startsWith('/dashboard/account-details') || pathname.startsWith('/dashboard/notifications');

        if (!isPathAllowed && !isCorePathAllowed) {
          // If not allowed, redirect to their designated homepage
          router.replace(roleRedirects[primaryRole]);
        } else if (pathname === dashboardPath) {
          // If they land on the main dashboard, redirect them to their specific start page
           router.replace(roleRedirects[primaryRole]);
        }
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

    
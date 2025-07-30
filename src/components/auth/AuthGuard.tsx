

"use client";

import { useAuth } from '@/context/AuthContext';
import { Loader2 } from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';
import type { PropsWithChildren} from 'react';
import React, { useEffect } from 'react';
import type { UserRole } from '@/types';

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
const roleAllowedPaths: Record<string, string[]> = {
  "Service": ['/dashboard/warranty-management'],
  "DemoManager": ['/dashboard/demo'],
  "Accounts": [
    '/dashboard/items', 
    '/dashboard/inventory', 
    '/dashboard/quotes', 
    '/dashboard/invoices', 
    '/dashboard/orders', 
    '/dashboard/payments', 
    '/dashboard/financial-management',
    '/dashboard/purchase-orders'
  ],
  "Viewer": [
    '/dashboard/items',
    '/dashboard/inventory',
    '/dashboard/quotes',
    '/dashboard/invoices',
    '/dashboard/orders',
    '/dashboard/purchase-orders',
    '/dashboard/payments',
    '/dashboard/financial-management',
    '/dashboard/commission-management',
    '/dashboard/total-lc',
    '/dashboard/reports',
    '/dashboard/shipments',
    '/dashboard/demo',
    '/dashboard/warranty-management',
    '/dashboard/suppliers',
    '/dashboard/customers',
    '/dashboard/purchase-orders',
  ],
  "Commercial": [
    '/dashboard/quotes', 
    '/dashboard/invoices', 
    '/dashboard/orders', 
    '/dashboard/payments', 
    '/dashboard/financial-management',
    '/dashboard/commission-management',
    '/dashboard/total-lc',
    '/dashboard/reports',
    '/dashboard/shipments',
    '/dashboard/demo',
    '/dashboard/warranty-management',
    '/dashboard/suppliers',
    '/dashboard/customers',
    '/dashboard/purchase-orders',
  ]
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
  "Accounts": process.env.NEXT_PUBLIC_REDIRECT_PATH_ACCOUNTS || '/dashboard/items/list',
  "Viewer": '/dashboard', // Viewers land on the main dashboard
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

      // Super Admins and Admins have full access
      if (userRoles.includes("Super Admin") || userRoles.includes("Admin")) {
        return;
      }

      // Check if the current path is one of the core paths allowed for all users.
      if (coreAllowedPaths.some(corePath => pathname.startsWith(corePath))) {
        return;
      }
      
      // Check for explicitly disallowed paths for any of the user's roles
      for (const role of userRoles) {
        const disallowed = roleDisallowedPaths[role as UserRole];
        if (disallowed && disallowed.some(prefix => pathname.startsWith(prefix))) {
          const redirectPath = roleRedirects[role] || dashboardPath;
          router.replace(redirectPath);
          return;
        }
      }
      
      // For users with specific roles, check if the current path is allowed for AT LEAST ONE of their roles.
      let isPathAllowed = false;
      for (const role of userRoles) {
        const allowed = roleAllowedPaths[role];
        // If a role has no specific restrictions (allowed is undefined), it doesn't grant access on its own here.
        // We must find an explicit match in the roleAllowedPaths for one of the user's roles.
        if (allowed && allowed.some(prefix => pathname.startsWith(prefix))) {
          isPathAllowed = true;
          break; // Found a role that allows access, no need to check further.
        }
      }

      if (!isPathAllowed) {
        // If no role grants access, redirect. Use the first role for a deterministic redirect path.
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

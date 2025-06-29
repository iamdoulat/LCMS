
"use client";

import { useAuth } from '@/context/AuthContext';
import { Loader2 } from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';
import type { PropsWithChildren} from 'react';
import React, { useEffect } from 'react';

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

// Define default redirect paths for restricted roles
const roleRedirects: Record<string, string> = {
  "Service": '/dashboard/warranty-management/search',
  "DemoManager": '/dashboard/demo/demo-machine-search',
  "Store Manager": '/dashboard/items/list',
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
    if (user) {
      // Redirect away from public pages if logged in
      if (publicPaths.includes(pathname)) {
        router.replace(dashboardPath);
        return;
      }
      
      const restrictedRole = userRole as keyof typeof roleRedirects;

      // Check if the user has a restricted role with a defined redirect path
      if (roleRedirects[restrictedRole]) {
        const allowedPaths = roleAllowedPaths[restrictedRole] || [];
        // Check if the current path is allowed for this role
        const isPathAllowed = allowedPaths.some(prefix => pathname.startsWith(prefix));
        
        // Also allow access to core pages like account settings and notifications
        const isCorePathAllowed = pathname === dashboardPath || pathname.startsWith('/dashboard/account-details') || pathname.startsWith('/dashboard/notifications');

        if (!isPathAllowed && !isCorePathAllowed) {
          // If not allowed, redirect to their designated homepage
          router.replace(roleRedirects[restrictedRole]);
        } else if (pathname === dashboardPath) {
          // If they land on the main dashboard, redirect them to their specific start page
          router.replace(roleRedirects[restrictedRole]);
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

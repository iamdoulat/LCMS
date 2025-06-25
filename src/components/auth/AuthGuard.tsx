
"use client";

import { useAuth } from '@/context/AuthContext';
import { Loader2 } from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';
import type { PropsWithChildren} from 'react';
import React, { useEffect } from 'react';

const publicPaths = ['/login', '/register']; // Paths accessible without authentication
const dashboardPath = '/dashboard';

export default function AuthGuard({ children }: PropsWithChildren) {
  const { user, userRole, loading } = useAuth(); // Get userRole from context
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) {
      return; // Wait until auth state and role are fully loaded
    }

    // If not authenticated and trying to access a protected page
    if (!user && !publicPaths.includes(pathname)) {
      router.replace('/login');
      return;
    }

    // If authenticated...
    if (user) {
      // and trying to access a public page like login/register
      if (publicPaths.includes(pathname)) {
        router.replace(dashboardPath);
        return;
      }

      // Role-based redirection logic
      // This runs only if the user is on the main dashboard page
      if (pathname === dashboardPath) {
        let redirectPath = '';
        switch (userRole) {
          case 'Service':
            const serviceRedirect = process.env.NEXT_PUBLIC_REDIRECT_PATH_SERVICE;
            redirectPath = serviceRedirect && serviceRedirect.trim() !== '' ? serviceRedirect : '/dashboard/warranty-management/search';
            break;
          case 'DemoManager':
            const demoManagerRedirect = process.env.NEXT_PUBLIC_REDIRECT_PATH_DEMO_MANAGER;
            redirectPath = demoManagerRedirect && demoManagerRedirect.trim() !== '' ? demoManagerRedirect : '/dashboard/demo/demo-machine-search';
            break;
          case 'Store Manager':
             const storeManagerRedirect = process.env.NEXT_PUBLIC_REDIRECT_PATH_STORE_MANAGER;
             redirectPath = storeManagerRedirect && storeManagerRedirect.trim() !== '' ? storeManagerRedirect : '/dashboard/items/list';
            break;
          default:
            // No redirect for other roles, they stay on the main dashboard
            break;
        }

        if (redirectPath && redirectPath !== pathname) {
          router.replace(redirectPath);
        }
      }
    }
  }, [user, userRole, loading, router, pathname]);

  // Show loading spinner while auth state or role is being determined
  // Or if we are about to redirect
  if (loading || (!user && !publicPaths.includes(pathname))) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }
  
  // Render children if authenticated and not redirecting, or on a public path
  return <>{children}</>; 
}

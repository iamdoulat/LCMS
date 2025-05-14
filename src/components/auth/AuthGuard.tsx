
"use client";

import { useAuth } from '@/context/AuthContext';
import { Loader2 } from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';
import type { PropsWithChildren} from 'react';
import React, { useEffect } from 'react';

const publicPaths = ['/login', '/register']; // Paths accessible without authentication

export default function AuthGuard({ children }: PropsWithChildren) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading) {
      if (!user && !publicPaths.includes(pathname)) {
        router.push('/login');
      } else if (user && publicPaths.includes(pathname)) {
        // If user is logged in and tries to access login/register, redirect to dashboard
        router.push('/dashboard');
      }
    }
  }, [user, loading, router, pathname]);

  if (loading || (!user && !publicPaths.includes(pathname))) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }
  
  // If user is logged in OR if the path is public, render children
  if (user || publicPaths.includes(pathname)) {
      return <>{children}</>;
  }

  // Fallback, should be covered by loading or redirect
  return null; 
}

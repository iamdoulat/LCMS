
"use client"; // This page needs to be a client component to use hooks

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Loader2 } from 'lucide-react';

export default function HomePage() {
  const { user, userRole, loading, viewMode } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (user) {
        // Priority 1: User's saved preference
        if (viewMode === 'mobile') {
          router.replace('/mobile/dashboard');
        } else if (viewMode === 'web') {
          router.replace('/dashboard');
        }
        // Priority 2: Role-based default
        else if (userRole?.includes('Employee')) {
          router.replace('/mobile/dashboard');
        } else {
          router.replace('/dashboard');
        }
      } else {
        router.replace('/login');
      }
    }
  }, [user, userRole, loading, router, viewMode]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-background">
      <Loader2 className="h-12 w-12 animate-spin text-primary" />
      <p className="mt-4 text-muted-foreground">Loading Indent & LC Management System...</p>
    </main>
  );
}


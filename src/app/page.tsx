
"use client"; // This page needs to be a client component to use hooks

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Loader2 } from 'lucide-react';

export default function HomePage() {
  const { user, loading, userRole } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (user) {
        const isEmployee = userRole?.includes('Employee');
        router.replace(isEmployee ? '/mobile/dashboard' : '/dashboard');
      } else {
        router.replace('/login');
      }
    }
  }, [user, loading, userRole, router]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-background">
      <Loader2 className="h-12 w-12 animate-spin text-primary" />
      <p className="mt-4 text-muted-foreground">Loading Indent & LC Management System...</p>
    </main>
  );
}


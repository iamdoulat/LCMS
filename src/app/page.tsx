"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { MobileSplashScreen } from '@/components/mobile/MobileSplashScreen';

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

  return <MobileSplashScreen message="Indent & LC Management System" />;
}


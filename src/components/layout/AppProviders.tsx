
"use client";

import type { PropsWithChildren } from 'react';
import { ThemeProvider } from 'next-themes';
import { AuthProvider } from '@/context/AuthContext';

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      disableTransitionOnChange
    >
      <AuthProvider>
        {children}
      </AuthProvider>
    </ThemeProvider>
  );
}


"use client";

import type { PropsWithChildren } from 'react';
import * as React from 'react';
import { ThemeProvider } from 'next-themes';
import { AuthProvider } from '@/context/AuthContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from "@/components/ui/toaster"; // Import Toaster

import { BinaryLockProvider } from '@/components/layout/BinaryLockProvider';

export function AppProviders({ children }: PropsWithChildren) {
  const [queryClient] = React.useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        enableSystem={false}
        disableTransitionOnChange
      >
        <AuthProvider>
          <BinaryLockProvider>
            {children}
            <Toaster />
          </BinaryLockProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

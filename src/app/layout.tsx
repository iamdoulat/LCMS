
import type { Metadata, Viewport } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { AppProviders } from '@/components/layout/AppProviders';
import './globals.css';
import '@/styles/mobile-optimizations.css';
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import React, { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { ServiceWorkerRegistration } from '@/components/ServiceWorkerRegistration';

import OfflineStatus from '@/components/common/OfflineStatus';

export const metadata: Metadata = {
  //...
};
//...
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="font-sans antialiased">
        <ServiceWorkerRegistration />
        <OfflineStatus />
        <AppProviders>
          <Suspense fallback={<div className="flex min-h-screen w-full items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>}>
            {children}
          </Suspense>
          <Analytics />
          <SpeedInsights />
        </AppProviders>
      </body>
    </html>
  );
}


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

export const metadata: Metadata = {
  title: 'Nextsew - Indenting & LC Management System',
  description: 'Nextsew Indenting & LC Management System - Modern Business Solutions',
  manifest: '/manifest.json',
  icons: {
    icon: '/icons/favicon.ico',
    apple: '/icons/icon-192x192.png',
  },
  applicationName: 'Nextsew',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Nextsew',
  },
  formatDetection: {
    telephone: false,
  },
  other: {
    "mobile-web-app-capable": "yes",
    "msapplication-TileColor": "#3498db",
    "msapplication-tap-highlight": "no",
  }
};

export const viewport: Viewport = {
  themeColor: '#3498db',
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="font-sans antialiased">
        <ServiceWorkerRegistration />
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

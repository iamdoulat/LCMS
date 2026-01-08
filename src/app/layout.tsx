
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
import { admin } from '@/lib/firebase/admin';

const FINANCIAL_SETTINGS_COLLECTION = 'financial_settings';
const COMPANY_PROFILE_DOC_ID = 'main_settings';
const DEFAULT_FAVICON_URL = 'https://res.cloudinary.com/iamdoulat/image/upload/v1735712111/favicon_pjr3zn.ico';

export async function generateMetadata(): Promise<Metadata> {
  try {
    const db = admin.firestore();
    const docRef = db.collection(FINANCIAL_SETTINGS_COLLECTION).doc(COMPANY_PROFILE_DOC_ID);
    const docSnap = await docRef.get();

    let faviconUrl = DEFAULT_FAVICON_URL;
    let title = 'NextSew';

    if (docSnap.exists) {
      const data = docSnap.data();
      if (data?.faviconUrl) {
        faviconUrl = data.faviconUrl;
      }
      if (data?.companyName) {
        title = data.companyName;
      }
    }

    return {
      title: title,
      icons: {
        icon: faviconUrl,
      },
      manifest: '/manifest.json',
    };
  } catch (error) {
    console.error('Error generating metadata:', error);
    return {
      title: 'NextSew',
      icons: {
        icon: DEFAULT_FAVICON_URL,
      },
    };
  }
}
//...
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="font-sans antialiased">
        <AppProviders>
          <ServiceWorkerRegistration />
          <OfflineStatus />
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

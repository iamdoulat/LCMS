
import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { AppProviders } from '@/components/layout/AppProviders'; // Import the new wrapper
import './globals.css'; 
import { Analytics } from "@vercel/analytics/next"; // Import Vercel Analytics

export const metadata: Metadata = {
  title: 'LC Management System - Letter of Credit Management',
  description: 'Modern Letter of Credit Management Software',
  manifest: '/manifest.json',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Standard Favicon */}
        <link rel="icon" href="/favicon.ico" sizes="any" />
        {/* PNG Favicons (optional, but good for quality) */}
        <link rel="icon" href="/icons/favicon-32x32.png" type="image/png" sizes="32x32" />
        <link rel="icon" href="/icons/favicon-16x16.png" type="image/png" sizes="16x16" />
        
        {/* PWA and Apple Specific Meta Tags */}
        <meta name="application-name" content="LC Vision" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="LC Vision" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-TileColor" content="#3498db" />
        <meta name="msapplication-tap-highlight" content="no" />
        <meta name="theme-color" content="#3498db" />

        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        {/* 
          For a better PWA experience, consider adding more Apple touch icons for different sizes:
          e.g., <link rel="apple-touch-icon" sizes="152x152" href="/icons/apple-touch-icon-152x152.png" />
        */}
      </head>
      <body className={`${GeistSans.variable} ${GeistMono.variable} font-sans antialiased`}>
        <AppProviders> {/* Use the wrapper component here */}
          {children}
          <Analytics /> {/* Add Vercel Analytics component here */}
        </AppProviders>
      </body>
    </html>
  );
}

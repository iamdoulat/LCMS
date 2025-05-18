
import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { ThemeProvider } from 'next-themes';
import { AuthProvider } from '@/context/AuthContext';
import './globals.css'; 

export const metadata: Metadata = {
  title: 'LC Management System - Letter of Credit Management',
  description: 'Modern Letter of Credit Management Software',
  manifest: '/manifest.json', // Added manifest link here
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="application-name" content="LC Vision" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="LC Vision" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-TileColor" content="#3498db" />
        <meta name="msapplication-tap-highlight" content="no" />
        <meta name="theme-color" content="#3498db" />

        <link rel="apple-touch-icon" href="https://firebasestorage.googleapis.com/v0/b/lc-vision.firebasestorage.app/o/playstore.png?alt=media&token=9d432d10-f694-4737-ac61-a55a7662d1ad" />
        {/* 
          For a better PWA experience, consider adding more Apple touch icons for different sizes:
          <link rel="apple-touch-icon" sizes="152x152" href="/icons/touch-icon-ipad.png" />
          <link rel="apple-touch-icon" sizes="180x180" href="/icons/touch-icon-iphone-retina.png" />
          <link rel="apple-touch-icon" sizes="167x167" href="/icons/touch-icon-ipad-retina.png" />
        */}
      </head>
      <body className={`${GeistSans.variable} ${GeistMono.variable} font-sans antialiased`}>
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
      </body>
    </html>
  );
}

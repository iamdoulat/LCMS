
"use client";

import * as React from 'react';
import Link from 'next/link';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/context/AuthContext';

export function AppFooter() {
  const currentYear = new Date().getFullYear();
  const { appVersion } = useAuth();

  return (
    <footer className="mt-auto hidden md:block noprint h-14 border-t">
      <div className="w-full px-6 h-full flex items-center justify-center text-sm text-muted-foreground whitespace-nowrap">
        <p>
          &copy; {currentYear} - Designed and Developed by{" "}
          <Link
            href="https://vcard.mddoulat.com/iamdoulat"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Doulat
          </Link>{" "}
          {appVersion}
        </p>
      </div>
    </footer>
  );
}

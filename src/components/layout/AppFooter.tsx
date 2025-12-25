
"use client";

import * as React from 'react';
import Link from 'next/link';
import { Separator } from '@/components/ui/separator';

export function AppFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="mt-auto hidden md:block noprint">
      <Separator />
      <div className="w-full px-5 py-4 text-center text-sm text-muted-foreground">
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
          v1.1
        </p>
      </div>
    </footer>
  );
}

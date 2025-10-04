"use client";

import * as React from 'react';
import Link from 'next/link';
import { Separator } from '@/components/ui/separator';

export function AppFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="mt-auto hidden md:block noprint">
      <Separator />
      <div className="container mx-auto py-4 text-center text-sm text-muted-foreground">
        <p>
          &copy; {currentYear} LC Management System. All Rights Reserved. | Contact:{" "}
          <Link
            href="https://cards.mddoulat.com/iamdoulat"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            mddoulat.com
          </Link>
        </p>
      </div>
    </footer>
  );
}

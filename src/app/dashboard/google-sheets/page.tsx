
"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Sheet as SheetIcon, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle as AlertTitleShadCN } from '@/components/ui/alert'; // Renamed to avoid conflict

export default function GoogleSheetsPage() {
  const sheetParams = process.env.NEXT_PUBLIC_GOOGLE_SHEET_PARAMS;
  const embedUrl = sheetParams && sheetParams !== "YOUR_GOOGLE_SHEET_ID_AND_GID_PARAMS_HERE"
    ? `https://docs.google.com/spreadsheets/d/${sheetParams}&rm=minimal&embedded=true&chrome=false`
    : null;

  return (
    <div className="container mx-auto py-8">
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className={cn("flex items-center gap-2", "font-bold text-2xl lg:text-3xl bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
            <SheetIcon className="h-7 w-7 text-primary" />
            Google Sheets Integration
          </CardTitle>
          <CardDescription>
            View and interact with the configured Google Sheet.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {embedUrl ? (
            <div className="aspect-video w-full"> {/* Using aspect-video for responsive height based on width */}
              <iframe
                src={embedUrl}
                width="100%"
                height="100%" // iframe will take full height of parent
                frameBorder="0"
                allowFullScreen
                title="Embedded Google Sheet"
                className="rounded-md border"
              >
                Loading Google Sheet...
              </iframe>
            </div>
          ) : (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitleShadCN>Configuration Missing</AlertTitleShadCN>
              <AlertDescription>
                The Google Sheet parameters are not configured. Please set the{' '}
                <code>NEXT_PUBLIC_GOOGLE_SHEET_PARAMS</code> environment variable in your{' '}
                <code>.env.local</code> file and restart the server.
                <br />
                Example: <code>NEXT_PUBLIC_GOOGLE_SHEET_PARAMS="YOUR_SHEET_ID/edit?gid=YOUR_GID"</code>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Sheet as SheetIcon, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription as AlertDescriptionShadCN, AlertTitle as AlertTitleShadCN } from '@/components/ui/alert'; // Renamed to avoid conflict

export default function GoogleSheetsPage() {
  const sheetParams = process.env.NEXT_PUBLIC_GOOGLE_SHEET_PARAMS;
  const embedUrl = sheetParams && sheetParams !== "YOUR_GOOGLE_SHEET_ID_AND_GID_PARAMS_HERE"
    ? `https://docs.google.com/spreadsheets/d/${sheetParams}&rm=minimal&embedded=true&chrome=false`
    : null;

  return (
    <div className="container mx-auto py-8 space-y-8">
      <Card 
        className="shadow-xl max-w-6xl mx-auto relative overflow-hidden"
        // style={{ background: 'radial-gradient(circle, rgba(34,190,195,1) 65%, rgba(191,177,163,1) 100%)' }} // Optional: radial gradient from search page
      >
        <div className="relative z-10 bg-card/90 dark:bg-card/80 rounded-lg"> {/* Wrapper for content over GIF */}
          <CardHeader className="text-center">
            <CardTitle className={cn("flex items-center justify-center gap-2 font-bold text-2xl lg:text-3xl bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out", "text-card-foreground")}>
              <SheetIcon className="h-7 w-7 text-primary" />
              Google Sheets Integration
            </CardTitle>
            <CardDescription className="text-center pt-2 text-card-foreground/80">
              View and interact with the configured Google Sheet.
            </CardDescription>
          </CardHeader>
        </div>
      </Card>

      <Card 
        className="shadow-xl max-w-6xl mx-auto"
        style={{
          background: 'linear-gradient(0deg, rgba(203, 247, 247, 0.2) 30%, rgba(232, 227, 218, 0.1) 100%)', // Lighter gradient for content
        }}
      >
        <CardContent className="pt-6"> {/* Added pt-6 for padding if CardHeader is removed from this card */}
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
              <AlertDescriptionShadCN>
                The Google Sheet parameters are not configured. Please set the{' '}
                <code>NEXT_PUBLIC_GOOGLE_SHEET_PARAMS</code> environment variable in your{' '}
                <code>.env.local</code> file and restart the server.
                <br />
                Example: <code>NEXT_PUBLIC_GOOGLE_SHEET_PARAMS="YOUR_SHEET_ID/edit?gid=YOUR_GID"</code>
              </AlertDescriptionShadCN>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

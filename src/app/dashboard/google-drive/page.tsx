
"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { FolderOpen, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription as AlertDescriptionShadCN, AlertTitle as AlertTitleShadCN } from '@/components/ui/alert';

export default function GoogleDrivePage() {
  const folderId = process.env.NEXT_PUBLIC_GOOGLE_DRIVE_FOLDER_ID;
  const isConfigured = folderId && folderId !== "YOUR_GOOGLE_DRIVE_FOLDER_ID_HERE";
  const embedUrl = isConfigured
    ? `https://drive.google.com/embeddedfolderview?id=${folderId}#list`
    : null;

  return (
    <div className="container mx-auto py-8 space-y-8">
      <Card
        className="shadow-xl max-w-screen-2xl mx-auto relative overflow-hidden"
      >
        <div className="relative z-10 bg-card/90 dark:bg-card/80 rounded-lg">
          <CardHeader className="text-center">
            <CardTitle className={cn("flex items-center justify-center gap-2 font-bold text-2xl lg:text-3xl bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out", "text-card-foreground")}>
              <FolderOpen className="h-7 w-7 text-primary" />
              Google Drive Manager
            </CardTitle>
            <CardDescription className="text-center pt-2 text-card-foreground/80">
              View and interact with files in the configured Google Drive folder.
            </CardDescription>
          </CardHeader>
        </div>
      </Card>

      <Card
        className="shadow-xl max-w-screen-2xl mx-auto"
        style={{
          background: 'linear-gradient(0deg, rgba(203, 247, 247, 0.2) 30%, rgba(232, 227, 218, 0.1) 100%)',
        }}
      >
        <CardContent className="pt-6">
          {embedUrl ? (
            <div className="aspect-video w-full">
              <iframe
                src={embedUrl}
                width="100%"
                height="100%"
                frameBorder="0"
                allowFullScreen
                title="Embedded Google Drive Folder"
                className="rounded-md border"
              >
                Loading Google Drive folder...
              </iframe>
            </div>
          ) : (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitleShadCN>Configuration Missing</AlertTitleShadCN>
              <AlertDescriptionShadCN>
                The Google Drive folder ID is not configured. Please set the{' '}
                <code>NEXT_PUBLIC_GOOGLE_DRIVE_FOLDER_ID</code> environment variable in your{' '}
                <code>.env</code> file and restart the server.
                <br />
                Example: <code>NEXT_PUBLIC_GOOGLE_DRIVE_FOLDER_ID="YOUR_FOLDER_ID_HERE"</code>
              </AlertDescriptionShadCN>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

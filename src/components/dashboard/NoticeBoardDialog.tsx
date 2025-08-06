
"use client";

import * as React from 'react';
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import type { NoticeBoardSettings } from '@/types';
import { X } from 'lucide-react';

interface NoticeBoardDialogProps {
  notice: NoticeBoardSettings;
}

const NOTICE_DISMISSED_KEY = 'noticeDismissedTimestamp';

export function NoticeBoardDialog({ notice }: NoticeBoardDialogProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const noticeTimestamp = notice.updatedAt?.seconds || 0; // Assuming `updatedAt` is a Firestore Timestamp

  React.useEffect(() => {
    const dismissedTimestamp = localStorage.getItem(NOTICE_DISMISSED_KEY);
    // Show the dialog if there's no dismissal timestamp,
    // or if the notice has been updated since it was last dismissed.
    if (!dismissedTimestamp || noticeTimestamp > parseInt(dismissedTimestamp, 10)) {
      setIsOpen(true);
    }
  }, [noticeTimestamp]);

  const handleDismiss = () => {
    // Store the timestamp of the notice being dismissed
    localStorage.setItem(NOTICE_DISMISSED_KEY, noticeTimestamp.toString());
    setIsOpen(false);
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            Important Notice
          </AlertDialogTitle>
          <AlertDialogDescription>
            Please review the following information.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="prose prose-sm dark:prose-invert max-h-[60vh] overflow-y-auto p-1">
          {/* We will use a library to render markdown safely later */}
          {notice.content}
        </div>
        <AlertDialogFooter>
          <AlertDialogAction onClick={handleDismiss}>
            <X className="mr-2 h-4 w-4" />
            Dismiss
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

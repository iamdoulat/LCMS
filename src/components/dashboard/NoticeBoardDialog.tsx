
"use client";

import * as React from 'react';
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import type { NoticeBoardSettings } from '@/types';
import { X } from 'lucide-react';
import type { Timestamp } from 'firebase/firestore';

interface NoticeBoardDialogProps {
  notice: NoticeBoardSettings & {updatedAt?: Timestamp | null};
}

const NOTICE_DISMISSED_KEY = 'noticeDismissedTimestamp';

export function NoticeBoardDialog({ notice }: NoticeBoardDialogProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  // Extract the timestamp in seconds. Fallback to 0 if it doesn't exist.
  const noticeTimestamp = notice.updatedAt?.seconds || 0;

  React.useEffect(() => {
    // This effect runs when the component mounts or the notice data changes.
    // It decides whether to show the dialog.
    if (noticeTimestamp > 0) { // Only proceed if we have a valid notice timestamp
      const dismissedTimestampString = localStorage.getItem(NOTICE_DISMISSED_KEY);
      const lastDismissedTimestamp = dismissedTimestampString ? parseInt(dismissedTimestampString, 10) : 0;
      
      // Show the dialog if the current notice is newer than the last one the user dismissed.
      if (noticeTimestamp > lastDismissedTimestamp) {
        setIsOpen(true);
      }
    }
  }, [noticeTimestamp]);

  const handleDismiss = () => {
    // When dismissing, store the timestamp of the *current* notice.
    // This marks this specific version of the notice as "seen".
    if (noticeTimestamp > 0) {
        localStorage.setItem(NOTICE_DISMISSED_KEY, noticeTimestamp.toString());
    }
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

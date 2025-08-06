
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

  const noticeTimestamp = notice.updatedAt?.seconds || 0;

  React.useEffect(() => {
    if (noticeTimestamp > 0) { 
      const dismissedTimestampString = localStorage.getItem(NOTICE_DISMISSED_KEY);
      const lastDismissedTimestamp = dismissedTimestampString ? parseInt(dismissedTimestampString, 10) : 0;
      
      if (noticeTimestamp > lastDismissedTimestamp) {
        setIsOpen(true);
      }
    }
  }, [noticeTimestamp]);

  const handleDismiss = () => {
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
            {notice.title || "Important Notice"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            Please review the following information.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="prose prose-sm dark:prose-invert max-h-[60vh] overflow-y-auto p-1">
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


"use client";

import * as React from 'react';
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import type { NoticeBoardSettings } from '@/types';
import { X } from 'lucide-react';
import type { Timestamp } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';

interface NoticeBoardDialogProps {
  notice: NoticeBoardSettings | null;
}

const NOTICE_DISMISSED_KEY_PREFIX = 'noticeDismissed_';

export function NoticeBoardDialog({ notice }: NoticeBoardDialogProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const { userRole } = useAuth();

  React.useEffect(() => {
    // Only proceed if we have a valid notice, its timestamp, and the user's roles have been loaded.
    if (notice && notice.isEnabled && notice.isPopupEnabled && notice.updatedAt && userRole) {
      const noticeId = (notice as any).id; // Assuming notice object has an ID
      if (!noticeId) return; // Cannot track dismissal without a unique ID

      const userHasTargetRole = userRole.some(role => notice.targetRoles?.includes(role));
      
      // If the user does not have a role targeted by the notice, do nothing.
      if (!userHasTargetRole) {
        setIsOpen(false);
        return;
      }

      const noticeTimestamp = (notice.updatedAt as Timestamp).seconds;
      const dismissedTimestampString = localStorage.getItem(`${NOTICE_DISMISSED_KEY_PREFIX}${noticeId}`);
      const lastDismissedTimestamp = dismissedTimestampString ? parseInt(dismissedTimestampString, 10) : 0;
      
      // Show the dialog only if the notice's timestamp is newer than the last dismissal for this specific notice.
      if (noticeTimestamp > lastDismissedTimestamp) {
        setIsOpen(true);
      } else {
        setIsOpen(false);
      }
    } else {
      setIsOpen(false);
    }
  }, [notice, userRole]);

  const handleDismiss = () => {
    if (notice && notice.updatedAt) {
        const noticeId = (notice as any).id;
        if (noticeId) {
            localStorage.setItem(`${NOTICE_DISMISSED_KEY_PREFIX}${noticeId}`, (notice.updatedAt as Timestamp).seconds.toString());
        }
    }
    setIsOpen(false);
  };

  if (!notice || !isOpen) {
    return null;
  }

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

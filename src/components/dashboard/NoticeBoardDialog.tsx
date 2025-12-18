
"use client";

import * as React from 'react';
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import type { NoticeBoardSettings } from '@/types';
import { X } from 'lucide-react';
import type { Timestamp } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import DOMPurify from 'dompurify';

interface NoticeBoardDialogProps {
  notice: (NoticeBoardSettings & { id: string }) | null;
}

const NOTICE_DISMISSED_KEY_PREFIX = 'noticeDismissed_';

export function NoticeBoardDialog({ notice }: NoticeBoardDialogProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const { userRole } = useAuth();
  const [sanitizedContent, setSanitizedContent] = React.useState('');


  React.useEffect(() => {
    if (notice && notice.isEnabled && notice.isPopupEnabled && notice.updatedAt && userRole) {
      const noticeId = notice.id;
      if (!noticeId) return;

      const userHasTargetRole = userRole.some(role => notice.targetRoles?.includes(role));
      
      if (!userHasTargetRole) {
        setIsOpen(false);
        return;
      }
      
      const noticeTimestamp = (notice.updatedAt as Timestamp).seconds;
      const dismissedTimestampString = localStorage.getItem(`${NOTICE_DISMISSED_KEY_PREFIX}${noticeId}`);
      const lastDismissedTimestamp = dismissedTimestampString ? parseInt(dismissedTimestampString, 10) : 0;
      
      if (noticeTimestamp > lastDismissedTimestamp) {
        setIsOpen(true);
      } else {
        setIsOpen(false);
      }
    } else {
      setIsOpen(false);
    }
  }, [notice, userRole]);

  React.useEffect(() => {
    if (notice?.content) {
      // Sanitize the HTML content on the client-side before rendering
      setSanitizedContent(DOMPurify.sanitize(notice.content));
    }
  }, [notice?.content]);

  const handleDismiss = () => {
    if (notice && notice.updatedAt) {
      const noticeId = notice.id;
      if (noticeId) {
          const timestampToStore = (notice.updatedAt as Timestamp).seconds;
          localStorage.setItem(`${NOTICE_DISMISSED_KEY_PREFIX}${noticeId}`, timestampToStore.toString());
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
        <div 
          className="prose prose-sm dark:prose-invert max-h-[60vh] overflow-y-auto p-1"
          dangerouslySetInnerHTML={{ __html: sanitizedContent }}
        />
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

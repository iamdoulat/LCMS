import type { PropsWithChildren } from 'react';

// Dedicated layout for print pages. It renders only the children without any dashboard UI.
export default function PrintLayout({ children }: PropsWithChildren) {
  return (
    <div className="print-preview-wrapper bg-gray-200 dark:bg-gray-800 p-8">
      {children}
    </div>
  );
}

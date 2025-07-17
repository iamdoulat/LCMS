
import type { PropsWithChildren } from 'react';

// Dedicated layout for print pages. It renders only the children without any dashboard UI.
export default function PrintLayout({ children }: PropsWithChildren) {
  return <div>{children}</div>;
}

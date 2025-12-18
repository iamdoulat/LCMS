
"use client";

import * as React from 'react';
import dynamic from 'next/dynamic';
import 'react-quill/dist/quill.snow.css';

// Dynamically import the client-side editor component
const RichTextEditorClient = dynamic(() => import('./RichTextEditorClient'), {
  ssr: false,
  loading: () => <div className="bg-muted rounded-md border h-[239px] animate-pulse" />, // Placeholder while loading
});

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function RichTextEditor({ value, onChange, placeholder }: RichTextEditorProps) {
  // This component acts as a server-safe wrapper.
  // It dynamically imports the actual editor, which is marked as a client component.
  return (
    <RichTextEditorClient
      value={value}
      onChange={onChange}
      placeholder={placeholder}
    />
  );
}

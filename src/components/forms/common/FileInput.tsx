"use client"
import * as React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface FileInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  labelSrOnly?: boolean;
  onFileChange?: (file: File | null) => void;
}

const FileInput = React.forwardRef<HTMLInputElement, FileInputProps>(
  ({ className, label, id, labelSrOnly, onFileChange, onChange, ...props }, ref) => {
    const internalRef = React.useRef<HTMLInputElement>(null);
    React.useImperativeHandle(ref, () => internalRef.current!);

    const [fileName, setFileName] = React.useState<string>("");

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0] || null;
      setFileName(file ? file.name : "");
      if (onFileChange) {
        onFileChange(file);
      }
      if (onChange) {
        onChange(event); // Propagate the original event if needed by react-hook-form
      }
    };
    
    return (
      <div className="grid w-full items-center gap-1.5">
        {label && <Label htmlFor={id} className={cn(labelSrOnly && "sr-only")}>{label}</Label>}
        <div className="relative">
            <Input
            id={id}
            type="file"
            className={cn(
                "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
                "cursor-pointer", // Make the whole input area clickable for file dialog
                className
            )}
            ref={internalRef}
            onChange={handleFileChange}
            {...props}
            />
            {fileName && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground bg-background px-1 pointer-events-none truncate max-w-[calc(100%-3rem)]">
                {fileName}
            </span>
            )}
        </div>
      </div>
    );
  }
);
FileInput.displayName = 'FileInput';
export { FileInput };

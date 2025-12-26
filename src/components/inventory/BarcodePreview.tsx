"use client";

import React from 'react';
import { BarcodeLabelComponent } from './BarcodeLabel';
import type { BarcodeLabel, BarcodeType, BarcodeLabelSize } from '@/types';
import { Button } from '@/components/ui/button';
import { Printer, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BarcodePreviewProps {
    labels: BarcodeLabel[];
    type: BarcodeType;
    size: BarcodeLabelSize;
    showPrice: boolean;
    showName: boolean;
    showCode: boolean;
    onRemoveLabel?: (id: string) => void;
    onPrint?: () => void;
}

export function BarcodePreview({
    labels,
    type,
    size,
    showPrice,
    showName,
    showCode,
    onRemoveLabel,
    onPrint,
}: BarcodePreviewProps) {
    const handlePrint = () => {
        if (onPrint) {
            onPrint();
        } else {
            window.print();
        }
    };

    if (labels.length === 0) {
        return (
            <div className="text-center py-12 text-muted-foreground">
                <p className="text-lg">No labels generated yet</p>
                <p className="text-sm mt-2">Configure your options and click "Generate Labels" to begin</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Print Controls */}
            <div className="flex justify-between items-center no-print">
                <div className="text-sm text-muted-foreground">
                    {labels.length} label{labels.length !== 1 ? 's' : ''} ready to print
                </div>
                <Button onClick={handlePrint} className="gap-2">
                    <Printer className="h-4 w-4" />
                    Print All Labels
                </Button>
            </div>

            {/* Labels Grid */}
            <div
                className={cn(
                    "barcode-grid grid gap-2",
                    "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5",
                    "print:grid-cols-4 print:gap-[2mm]"
                )}
            >
                {labels.map((label) => (
                    <div key={label.id} className="relative group">
                        <BarcodeLabelComponent
                            item={label}
                            type={type}
                            size={size}
                            showPrice={showPrice}
                            showName={showName}
                            showCode={showCode}
                        />
                        {onRemoveLabel && (
                            <button
                                onClick={() => onRemoveLabel(label.id)}
                                className="no-print absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Remove label"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

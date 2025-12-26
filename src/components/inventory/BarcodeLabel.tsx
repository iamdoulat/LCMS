"use client";

import React from 'react';
import Barcode from 'react-barcode';
import { QRCodeSVG } from 'qrcode.react';
import type { BarcodeLabel, BarcodeType, BarcodeLabelSize } from '@/types';
import { cn } from '@/lib/utils';

interface BarcodeLabelProps {
    item: BarcodeLabel;
    type: BarcodeType;
    size: BarcodeLabelSize;
    showPrice: boolean;
    showName: boolean;
    showCode: boolean;
}

const sizeConfig = {
    small: {
        container: 'w-[40mm] h-[20mm]',
        barcode: { width: 1.2, height: 25 },
        qrcode: 50,
        fontSize: 'text-[6pt]',
        padding: 'p-[1mm]',
    },
    medium: {
        container: 'w-[50mm] h-[25mm]',
        barcode: { width: 1.5, height: 32 },
        qrcode: 65,
        fontSize: 'text-[7pt]',
        padding: 'p-[1.5mm]',
    },
    large: {
        container: 'w-[60mm] h-[30mm]',
        barcode: { width: 1.8, height: 38 },
        qrcode: 80,
        fontSize: 'text-[8pt]',
        padding: 'p-[2mm]',
    },
};

export function BarcodeLabelComponent({ item, type, size, showPrice, showName, showCode }: BarcodeLabelProps) {
    const config = sizeConfig[size];
    const code = item.itemCode || item.id;

    return (
        <div
            className={cn(
                "barcode-label border border-gray-300 bg-white flex flex-col items-center justify-center",
                config.container,
                config.padding,
                "page-break-inside-avoid"
            )}
        >
            {/* Barcode or QR Code */}
            <div className="flex-shrink-0 flex items-center justify-center mb-[0.5mm]">
                {type === 'barcode' ? (
                    <Barcode
                        value={code}
                        width={config.barcode.width}
                        height={config.barcode.height}
                        fontSize={size === 'small' ? 8 : size === 'medium' ? 10 : 12}
                        margin={0}
                        displayValue={showCode}
                    />
                ) : (
                    <QRCodeSVG
                        value={item.qrData}
                        size={config.qrcode}
                        level="M"
                        includeMargin={false}
                    />
                )}
            </div>

            {/* Item Info */}
            <div className={cn("w-full text-center", config.fontSize, "leading-tight space-y-[0.2mm]")}>
                {showName && (
                    <div className="font-semibold truncate" title={item.itemName}>
                        {item.itemName}
                    </div>
                )}
                {showCode && type === 'qrcode' && (
                    <div className="font-mono text-[5pt]">
                        {code}
                    </div>
                )}
                {showPrice && item.price !== undefined && (
                    <div className="font-bold">
                        {item.currency || 'BDT'} {item.price.toFixed(2)}
                    </div>
                )}
            </div>
        </div>
    );
}

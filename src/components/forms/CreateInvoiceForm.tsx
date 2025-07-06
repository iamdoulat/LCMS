
"use client";

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Info } from 'lucide-react';

export function CreateInvoiceForm() {
  return (
    <Card className="bg-blue-500/10 border-blue-500/30">
        <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-700">
                <Info className="h-5 w-5" />
                Under Construction
            </CardTitle>
        </CardHeader>
        <CardContent>
            <p className="text-blue-700/90">
                This form is temporarily disabled to resolve a build error. It will be re-enabled shortly.
            </p>
        </CardContent>
    </Card>
  );
}

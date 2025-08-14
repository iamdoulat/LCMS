
"use client";

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Wrench } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NewInstallationReportForm } from '@/components/forms/NewInstallationReportForm';

export default function NewInstallationReportPage() {
  return (
    <div className="container mx-auto py-8">
            <CardContent>
                <NewInstallationReportForm />
            </CardContent>
    </div>
  );
}


"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CalendarClock } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function UpcomingShipmentsPagePlaceholder() {
  return (
    <div className="container mx-auto py-8">
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className={cn("flex items-center gap-2", "font-bold text-xl lg:text-2xl text-primary", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
            <CalendarClock className="h-7 w-7 text-primary" />
            Upcoming L/C Shipment Dates
          </CardTitle>
          <CardDescription>
            This page is currently a placeholder.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-muted-foreground/30 rounded-lg bg-muted/20 p-6">
            <p className="text-xl font-semibold text-muted-foreground">
              Upcoming Shipments data will be displayed here.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

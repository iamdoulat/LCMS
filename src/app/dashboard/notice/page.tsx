
"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BellRing, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';

export default function NoticesPage() {

  return (
    <div className="container mx-auto py-8">
      <Card className="shadow-xl max-w-3xl mx-auto">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className={cn("flex items-center gap-2", "font-bold text-2xl lg:text-3xl bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
                <BellRing className="h-7 w-7 text-primary" />
                Notices
              </CardTitle>
              <CardDescription>
                View and manage your recent notices.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <Separator className="my-4" />
        <CardContent>
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
              <Info className="h-10 w-10 mb-2" />
              <p className="text-lg">No notices yet.</p>
              <p className="text-sm">We'll let you know when something new happens.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

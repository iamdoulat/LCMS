
"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export default function PISettingsPage() {
  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle className={cn("flex items-center gap-2", "font-bold text-2xl lg:text-3xl text-primary", "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
            <Settings className="h-7 w-7 text-primary" />
            PI Settings
          </CardTitle>
          <CardDescription>
            Manage settings for Proforma Invoices.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="pi-name">Name</Label>
                <Input id="pi-name" placeholder="Enter a name" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pi-address">Address</Label>
                <Textarea id="pi-address" placeholder="Enter an address" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="pi-email">Email</Label>
                <Input id="pi-email" type="email" placeholder="Enter an email" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pi-phone">Phone Number</Label>
                <Input id="pi-phone" type="tel" placeholder="Enter a phone number" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

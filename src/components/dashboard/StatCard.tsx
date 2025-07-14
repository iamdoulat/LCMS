import type { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  icon?: ReactNode;
  description?: string; // Kept for backward compatibility, but title is now primary
  footer?: ReactNode;
  className?: string; // Allow custom className for gradients
}

export function StatCard({ title, value, icon, description, footer, className }: StatCardProps) {
  return (
    <Card
      className={cn(
        "relative overflow-hidden rounded-xl border-none shadow-lg transition-shadow duration-300 hover:shadow-xl",
        className // This is where the gradient classes will be passed
      )}
    >
       {icon && (
        <div className="absolute -right-2 -top-2 z-0 p-4 opacity-20">
            <div className="h-16 w-16 text-foreground">
                {icon}
            </div>
        </div>
      )}
      <CardContent className="relative z-10 p-6">
        <div className="flex justify-between items-start">
            <div className="flex flex-col space-y-1">
                 <div className="text-4xl font-bold text-foreground">{value}</div>
                 <p className="text-sm text-muted-foreground pt-1">{description || title}</p>
            </div>
        </div>
        {footer && <div className="pt-4">{footer}</div>}
      </CardContent>
    </Card>
  );
}

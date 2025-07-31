
import type { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: ReactNode; // Changed to ReactNode to allow for more complex values like JSX
  icon?: ReactNode;
  description?: string;
  footer?: ReactNode;
  className?: string;
  valueClassName?: string;
}

export function StatCard({ title, value, icon, description, footer, className, valueClassName }: StatCardProps) {
  return (
    <Card
      className={cn(
        "relative rounded-xl border-none shadow-lg text-primary-foreground overflow-hidden",
        className // Pass solid background color classes here
      )}
    >
      <CardContent className="relative z-10 p-6 flex justify-between items-center">
        <div className="flex flex-col space-y-1">
          <p className="text-sm font-medium text-primary-foreground/90">{title}</p>
          <div className={cn("text-4xl font-bold", valueClassName)}>{value}</div>
          <p className="text-xs text-primary-foreground/80 pt-1">{description || footer}</p>
        </div>
        {icon && (
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-white/20">
            <div className="h-6 w-6 text-primary-foreground">
                {icon}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

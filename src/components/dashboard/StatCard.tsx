import type { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface StatCardProps {
  title: string;
  value: ReactNode;
  icon?: ReactNode;
  description?: string;
  footer?: ReactNode;
  className?: string;
  valueClassName?: string;
}

export function StatCard({ title, value, icon, description, footer, className, valueClassName }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
      className="w-full"
    >
      <Card
        className={cn(
          "relative rounded-2xl border-none shadow-xl text-white overflow-hidden group hover-lift animate-shine",
          className
        )}
      >
        {/* Glossy Overlay */}
        <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

        <CardContent className="relative z-10 p-6 flex justify-between items-center overflow-hidden">
          <div className="flex flex-col space-y-2">
            <p className="text-sm font-semibold text-white/80 uppercase tracking-wider">{title}</p>
            <div className={cn("text-4xl font-extrabold tracking-tight", valueClassName)}>{value}</div>
            <p className="text-xs text-white/70 font-medium flex items-center gap-1">
              {description || footer}
            </p>
          </div>
          {icon && (
            <motion.div
              whileHover={{ rotate: 10, scale: 1.1 }}
              className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-md shadow-inner border border-white/10"
            >
              <div className="h-7 w-7 text-white">
                {icon}
              </div>
            </motion.div>
          )}
        </CardContent>

        {/* Bottom edge highlight */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      </Card>
    </motion.div>
  );
}


"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FileText, ListChecks, Receipt, Laptop, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";


const navItems = [
  { href: '/dashboard/total-lc', label: 'LC', icon: FileText, pathPrefix: '/dashboard/total-lc' },
  { href: '/dashboard/quotations/list', label: 'Quotes', icon: ListChecks, pathPrefix: '/dashboard/quotations' },
  { href: '/dashboard/pi/list', label: 'Invoices', icon: Receipt, pathPrefix: '/dashboard/pi' },
  { href: '/dashboard/demo/demo-machine-search', label: 'Demo', icon: Laptop, pathPrefix: '/dashboard/demo' },
  { href: '/dashboard/warranty-management/search', label: 'Warranty', icon: ShieldCheck, pathPrefix: '/dashboard/warranty-management' },
];

export function BottomNavBar() {
  const pathname = usePathname();

  const isActive = (pathPrefix: string) => {
    return pathname.startsWith(pathPrefix);
  };

  return (
    <div className="fixed bottom-0 left-0 z-50 w-full h-16 bg-card border-t md:hidden noprint pb-[5px]">
      <div className="grid h-full max-w-lg grid-cols-5 mx-auto">
        <TooltipProvider>
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.pathPrefix);
            return (
              <Tooltip key={item.label}>
                <TooltipTrigger asChild>
                  <Link href={item.href} passHref>
                    <button
                      type="button"
                      className={cn(
                        "inline-flex flex-col items-center justify-center px-5 hover:bg-muted group w-full h-full",
                        active ? "text-primary" : "text-muted-foreground"
                      )}
                    >
                      <Icon className="w-6 h-6 mb-1" />
                      <span className="text-xs">{item.label}</span>
                    </button>
                  </Link>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{item.label}</p>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </TooltipProvider>
      </div>
    </div>
  );
}

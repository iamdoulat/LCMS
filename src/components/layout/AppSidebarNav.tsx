
"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarSeparator,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  LayoutDashboard,
  ListChecks, 
  FilePlus2,  
  Truck,
  CalendarClock,
  Users as UsersIcon,
  Settings,
  LogOut,
  Briefcase,
  Loader2,
  Store,      
  UserPlus
  // ChevronDown is no longer needed here as AccordionTrigger provides its own
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';

const mainNavItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/total-lc', label: 'Total L/C', icon: ListChecks },
  { href: '/dashboard/new-lc-entry', label: 'New L/C Entry', icon: FilePlus2 },
];

const managementNavItems: NavItem[] = [
  {
    isGroup: true,
    groupLabel: 'Suppliers',
    icon: Store,
    subLinks: [
      { href: '/dashboard/suppliers', label: 'View Suppliers', icon: ListChecks },
      { href: '/dashboard/suppliers/add', label: 'Add New Supplier', icon: FilePlus2 },
    ],
  },
  {
    isGroup: true,
    groupLabel: 'Customers',
    icon: UsersIcon,
    subLinks: [
      { href: '/dashboard/customers', label: 'View Customers', icon: ListChecks },
      { href: '/dashboard/customers/add', label: 'Add New Customer', icon: UserPlus },
    ],
  },
  { href: '/dashboard/recent-shipments', label: 'Recent Shipments', icon: Truck },
  { href: '/dashboard/upcoming-shipments', label: 'Upcoming Shipments', icon: CalendarClock },
];

const settingsNavItems = [
  { href: '/dashboard/settings/users', label: 'Users', icon: UsersIcon },
  { href: '/dashboard/settings/smtp', label: 'SMTP Settings', icon: Settings },
];

export function AppSidebarNav() {
  const pathname = usePathname();
  const { logout, loading: authLoading } = useAuth();

  const isActive = (href: string) => {
    // Exact match for top-level items or items that aren't parent paths
    if (href === '/dashboard' && pathname === '/dashboard') return true;
    if (href !== '/dashboard' && pathname === href) return true;
    // For group parent paths, check if the current path starts with the group's base href
    // e.g., if href is '/dashboard/suppliers', it's active if pathname is '/dashboard/suppliers' or '/dashboard/suppliers/add'
    if ( (href === '/dashboard/suppliers' && pathname.startsWith('/dashboard/suppliers')) ||
         (href === '/dashboard/customers' && pathname.startsWith('/dashboard/customers')) ) {
        return true;
    }
    // General case for non-group items that might have sub-routes but are not groups themselves
    // (though current structure doesn't use this much for direct links)
    return href !== '/dashboard' && pathname.startsWith(href) && !pathname.substring(href.length).startsWith('/');
  };
  
  const isGroupActive = (subLinks: Array<{ href: string }>) => {
    return subLinks.some(sub => pathname.startsWith(sub.href));
  };

  // Determine which accordions should be open by default based on current path
  const defaultOpenAccordions = managementNavItems
    .filter(item => item.isGroup && item.subLinks && isGroupActive(item.subLinks))
    .map(item => item.groupLabel || '');


  return (
    <>
      <SidebarHeader className="border-b">
        <Link href="/dashboard" className="flex items-center gap-2 text-lg font-semibold text-primary whitespace-nowrap">
          <Briefcase className="h-6 w-6" />
          <span className="group-data-[collapsible=icon]:hidden">LC Management System</span>
        </Link>
      </SidebarHeader>
      <SidebarContent className="p-0">
        <SidebarMenu className="gap-0 px-2 py-2">
          {mainNavItems.map((item) => (
            <SidebarMenuItem key={item.href}>
              <Link href={item.href} passHref legacyBehavior>
                <SidebarMenuButton
                  asChild
                  isActive={isActive(item.href)}
                  className={cn(isActive(item.href) && "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90 hover:text-sidebar-primary-foreground")}
                  tooltip={{children: item.label, side: "right", className: "ml-2"}}
                >
                  <a>
                    <item.icon className="h-5 w-5" />
                    <span className="group-data-[collapsible=icon]:hidden">{item.label}</span>
                  </a>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>

        <SidebarSeparator />
        
        <SidebarGroup className="p-0">
          <SidebarGroupLabel className="px-4 text-xs font-semibold uppercase text-muted-foreground group-data-[collapsible=icon]:hidden">
            Management
          </SidebarGroupLabel>
          <Accordion type="multiple" defaultValue={defaultOpenAccordions} className="w-full">
            {managementNavItems.map((item, index) => (
              item.isGroup && item.subLinks ? (
                <AccordionItem value={item.groupLabel || `group-${index}`} key={item.groupLabel || `group-${index}`} className="border-none">
                  <TooltipProvider delayDuration={0}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                         <AccordionTrigger
                            className={cn(
                              "flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-none ring-sidebar-ring transition-all hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 group-has-[[data-sidebar=menu-action]]/menu-item:pr-8 aria-disabled:pointer-events-none aria-disabled:opacity-50",
                              "hover:no-underline justify-between group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:p-2",
                              // Hide the default chevron when in icon mode
                              "group-data-[collapsible=icon]:[&>svg]:hidden", 
                              isGroupActive(item.subLinks) && "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <item.icon className="h-5 w-5" />
                              <span className="group-data-[collapsible=icon]:hidden">{item.groupLabel}</span>
                            </div>
                            {/* The AccordionTrigger component from ShadCN UI already includes its own ChevronDown icon, so we remove the manual one here. */}
                          </AccordionTrigger>
                      </TooltipTrigger>
                       <TooltipContent side="right" className="ml-2 group-data-[collapsible=expanded]:hidden">
                        <p>{item.groupLabel}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <AccordionContent className="pt-0 pb-0 pl-6 pr-2 group-data-[collapsible=icon]:hidden overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
                    <SidebarMenu className="gap-0 py-1">
                      {item.subLinks.map((subLink) => (
                        <SidebarMenuItem key={subLink.href}>
                          <Link href={subLink.href} passHref legacyBehavior>
                            <SidebarMenuButton
                              asChild
                              isActive={pathname === subLink.href} 
                              className={cn(
                                pathname === subLink.href && "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90 hover:text-sidebar-primary-foreground",
                                "h-8 text-xs" 
                              )}
                              tooltip={{ children: subLink.label, side: "right", className: "ml-2" }}
                            >
                              <a>
                                {subLink.icon && <subLink.icon className="h-4 w-4" />}
                                <span className="group-data-[collapsible=icon]:hidden">{subLink.label}</span>
                              </a>
                            </SidebarMenuButton>
                          </Link>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </AccordionContent>
                </AccordionItem>
              ) : ( 
                <SidebarMenuItem key={item.href || `item-${index}`}>
                  <Link href={item.href!} passHref legacyBehavior>
                    <SidebarMenuButton 
                      asChild 
                      isActive={isActive(item.href!)}
                      className={cn(isActive(item.href!) && "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90 hover:text-sidebar-primary-foreground")}
                      tooltip={{children: item.label!, side: "right", className: "ml-2"}}
                    >
                      <a>
                        <item.icon className="h-5 w-5" />
                        <span className="group-data-[collapsible=icon]:hidden">{item.label}</span>
                      </a>
                    </SidebarMenuButton>
                  </Link>
                </SidebarMenuItem>
              )
            ))}
          </Accordion>
        </SidebarGroup>
        
        <SidebarSeparator />
        
        <SidebarGroup className="p-0">
          <SidebarGroupLabel className="px-4 text-xs font-semibold uppercase text-muted-foreground group-data-[collapsible=icon]:hidden">
            Settings
          </SidebarGroupLabel>
          <SidebarMenu className="gap-0 px-2 py-1">
            {settingsNavItems.map((item) => (
              <SidebarMenuItem key={item.href}>
                <Link href={item.href} passHref legacyBehavior>
                  <SidebarMenuButton 
                    asChild 
                    isActive={isActive(item.href)}
                    className={cn(isActive(item.href) && "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90 hover:text-sidebar-primary-foreground")}
                    tooltip={{children: item.label, side: "right", className: "ml-2"}}
                  >
                    <a>
                      <item.icon className="h-5 w-5" />
                      <span className="group-data-[collapsible=icon]:hidden">{item.label}</span>
                    </a>
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="mt-auto border-t p-2">
        <Button 
          variant="ghost" 
          className="w-full justify-start gap-2 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:justify-center"
          onClick={logout}
          disabled={authLoading}
          title="Logout"
        >
          {authLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <LogOut className="h-5 w-5" />
          )}
          <span className="group-data-[collapsible=icon]:hidden">Logout</span>
        </Button>
      </SidebarFooter>
    </>
  );
}

// Helper type for nav items, accommodating groups
type NavItem = {
  href?: string;
  label?: string;
  icon: React.ElementType;
  isGroup?: boolean;
  groupLabel?: string;
  defaultOpen?: boolean; 
  subLinks?: Array<{
    href: string;
    label: string;
    icon?: React.ElementType;
  }>;
};


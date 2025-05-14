
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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';

const mainDashboardLink: NavItem = { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard };

const lcManagementNavItems: NavItem[] = [
  {
    isGroup: true,
    groupLabel: 'L/C Management',
    icon: Briefcase, // Icon for the L/C Management group
    subLinks: [
      { href: '/dashboard/total-lc', label: 'Total L/C', icon: ListChecks },
      { href: '/dashboard/new-lc-entry', label: 'New L/C Entry', icon: FilePlus2 },
    ],
  },
];

const generalManagementNavItems: NavItem[] = [
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
  {
    isGroup: true,
    groupLabel: 'Shipments',
    icon: Truck,
    subLinks: [
      { href: '/dashboard/recent-shipments', label: 'Recent Shipments', icon: Truck },
      { href: '/dashboard/upcoming-shipments', label: 'Upcoming Shipments', icon: CalendarClock },
    ],
  },
];

const settingsNavItems: NavItem[] = [ // Changed to NavItem[]
  { href: '/dashboard/settings/users', label: 'Users', icon: UsersIcon },
  { href: '/dashboard/settings/smtp', label: 'SMTP Settings', icon: Settings },
];

export function AppSidebarNav() {
  const pathname = usePathname();
  const { logout, loading: authLoading } = useAuth();

  const isActive = (href: string) => {
    if (href === '/dashboard' && pathname === '/dashboard') return true;
    if (href !== '/dashboard' && pathname === href) return true;
     if (
      (href === '/dashboard/suppliers' && pathname.startsWith('/dashboard/suppliers')) ||
      (href === '/dashboard/customers' && pathname.startsWith('/dashboard/customers')) ||
      (href === '/dashboard/recent-shipments' && pathname.startsWith('/dashboard/recent-shipments')) ||
      (href === '/dashboard/upcoming-shipments' && pathname.startsWith('/dashboard/upcoming-shipments')) ||
      (href === '/dashboard/total-lc' && pathname.startsWith('/dashboard/total-lc')) ||
      (href === '/dashboard/new-lc-entry' && pathname.startsWith('/dashboard/new-lc-entry'))
    ) {
      return true;
    }
    if (href !== '/dashboard' && pathname.startsWith(href)) {
        const isPartOfActiveGroup = generalManagementNavItems.some(group => 
            group.isGroup && 
            group.subLinks?.some(sub => pathname.startsWith(sub.href)) && 
            href.startsWith(group.subLinks?.[0].href.substring(0, group.subLinks[0].href.lastIndexOf('/')) || '')
        ) || lcManagementNavItems.some(group => 
            group.isGroup &&
            group.subLinks?.some(sub => pathname.startsWith(sub.href)) &&
            href.startsWith(group.subLinks?.[0].href.substring(0, group.subLinks[0].href.lastIndexOf('/')) || '')
        );

        if (isPartOfActiveGroup) return false; 
        return true;
    }
    return false;
  };
  
  const isGroupActive = (subLinks: Array<{ href: string }>) => {
    return subLinks.some(sub => pathname.startsWith(sub.href));
  };

  const combinedNavGroups = [...lcManagementNavItems, ...generalManagementNavItems];

  const defaultOpenAccordions = combinedNavGroups
    .filter(item => item.isGroup && item.subLinks && isGroupActive(item.subLinks))
    .map(item => item.groupLabel || '');


  const renderNavGroup = (item: NavItem, index: number) => (
    item.isGroup && item.subLinks ? (
      <AccordionItem value={item.groupLabel || `group-${index}`} key={item.groupLabel || `group-${index}`} className="border-none">
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
                <AccordionTrigger
                  className={cn(
                    "flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-none ring-sidebar-ring transition-all hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 group-has-[[data-sidebar=menu-action]]/menu-item:pr-8 aria-disabled:pointer-events-none aria-disabled:opacity-50",
                    "hover:no-underline justify-between group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:p-2",
                    "group-data-[collapsible=icon]:[&>svg.lucide-chevron-down]:hidden", 
                    isGroupActive(item.subLinks) && "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <item.icon className="h-5 w-5" />
                    <span className="group-data-[collapsible=icon]:hidden">{item.groupLabel}</span>
                  </div>
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
       item.href && ( // Fallback for non-group items, though not expected in these arrays currently
          <SidebarMenu key={item.href || `item-${index}`} className="px-2 py-1">
          <SidebarMenuItem>
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
          </SidebarMenu>
       )
    )
  );


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
            <SidebarMenuItem key={mainDashboardLink.href!}>
              <Link href={mainDashboardLink.href!} passHref legacyBehavior>
                <SidebarMenuButton
                  asChild
                  isActive={isActive(mainDashboardLink.href!)}
                  className={cn(isActive(mainDashboardLink.href!) && "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90 hover:text-sidebar-primary-foreground")}
                  tooltip={{children: mainDashboardLink.label!, side: "right", className: "ml-2"}}
                >
                  <a>
                    <mainDashboardLink.icon className="h-5 w-5" />
                    <span className="group-data-[collapsible=icon]:hidden">{mainDashboardLink.label}</span>
                  </a>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
        </SidebarMenu>

        <SidebarSeparator />
        
        <SidebarGroup className="p-0">
          <SidebarGroupLabel className="px-4 text-xs font-semibold uppercase text-muted-foreground group-data-[collapsible=icon]:hidden">
            L/C Tools
          </SidebarGroupLabel>
          <Accordion type="multiple" defaultValue={defaultOpenAccordions} className="w-full">
            {lcManagementNavItems.map(renderNavGroup)}
          </Accordion>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup className="p-0">
          <SidebarGroupLabel className="px-4 text-xs font-semibold uppercase text-muted-foreground group-data-[collapsible=icon]:hidden">
            Management
          </SidebarGroupLabel>
          <Accordion type="multiple" defaultValue={defaultOpenAccordions} className="w-full">
            {generalManagementNavItems.map(renderNavGroup)}
          </Accordion>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup className="p-0">
          <SidebarGroupLabel className="px-4 text-xs font-semibold uppercase text-muted-foreground group-data-[collapsible=icon]:hidden">
            Settings
          </SidebarGroupLabel>
          <SidebarMenu className="gap-0 px-2 py-1">
            {settingsNavItems.map((item) => (
              item.href && // Ensure item.href is defined
              <SidebarMenuItem key={item.href}>
                <Link href={item.href} passHref legacyBehavior>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.href)}
                    className={cn(isActive(item.href) && "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90 hover:text-sidebar-primary-foreground")}
                    tooltip={{children: item.label!, side: "right", className: "ml-2"}}
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

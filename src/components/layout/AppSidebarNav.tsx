
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
  UserPlus,
  Building,
  FileText,
  FileEdit,
  ImageIcon // Changed from Image to avoid conflict with next/image
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext'; 
import Image from 'next/image'; 
import type { UserRole } from '@/types';
import React from 'react'; // Ensure React is imported for console.log

const mainDashboardLink: NavItem = { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard };

const lcManagementNavItems: NavItemGroup[] = [
  {
    groupLabel: 'L/C Management',
    icon: Briefcase, 
    subLinks: [
      { href: '/dashboard/total-lc', label: 'Total L/C', icon: ListChecks },
      { href: '/dashboard/new-lc-entry', label: 'New L/C Entry', icon: FilePlus2 },
    ],
  },
];

const managementNavItems: NavItemGroup[] = [
 {
    groupLabel: 'Suppliers / Beneficiary',
    icon: Store,
    subLinks: [
      { href: '/dashboard/suppliers', label: 'View Beneficiaries', icon: ListChecks },
      { href: '/dashboard/suppliers/add', label: 'Add New Beneficiary', icon: FilePlus2 },
    ],
  },
  {
    groupLabel: 'Customers / Applicants',
    icon: UsersIcon,
    subLinks: [
      { href: '/dashboard/customers', label: 'View Applicants', icon: ListChecks },
      { href: '/dashboard/customers/add', label: 'Add New Applicant', icon: UserPlus },
    ],
  },
  {
    groupLabel: 'Shipments',
    icon: Truck,
    subLinks: [
      { href: '/dashboard/recent-shipments', label: 'Recent Shipments', icon: Truck },
      { href: '/dashboard/upcoming-shipments', label: 'Upcoming Shipments', icon: CalendarClock },
      { href: '/dashboard/shipments/recent-draft-lcs', label: 'Recent Draft LCs', icon: FileEdit },
    ],
  },
];

const settingsNavItems: NavItemWithRoles[] = [
  { href: '/dashboard/settings/company-setup', label: 'Company Setup', icon: Building, roles: ["Super Admin", "Admin"] },
  { href: '/dashboard/settings/users', label: 'Users', icon: UsersIcon, roles: ["Super Admin", "Admin"] },
  { href: '/dashboard/settings/smtp', label: 'SMTP Settings', icon: Settings, roles: ["Super Admin", "Admin"] },
];


export function AppSidebarNav() {
  const pathname = usePathname();
  const { userRole, logout, loading: authLoading, companyName, companyLogoUrl } = useAuth(); 

  // For debugging role-based visibility
  React.useEffect(() => {
    console.log("Current User Role in Sidebar:", userRole);
  }, [userRole]);

  const isActive = (href: string) => {
    if (href === '/dashboard' && pathname === '/dashboard') return true;
    if (href !== '/dashboard' && pathname.startsWith(href)) {
        // More specific checks for parent routes that shouldn't be active if a child is
        if (
          (href === '/dashboard/suppliers' && pathname.startsWith('/dashboard/suppliers/add')) ||
          (href === '/dashboard/suppliers' && pathname.startsWith('/dashboard/suppliers/') && pathname.includes('/edit')) ||
          (href === '/dashboard/customers' && pathname.startsWith('/dashboard/customers/add')) ||
          (href === '/dashboard/customers' && pathname.startsWith('/dashboard/customers/') && pathname.includes('/edit')) ||
          (href === '/dashboard/total-lc' && pathname.startsWith('/dashboard/total-lc/') && pathname.includes('/edit'))
        ) {
          return pathname === href; 
        }
        return true; 
    }
    return false;
  };
  
  const isGroupActive = (subLinks: Array<{ href: string }>) => {
    return subLinks.some(sub => isActive(sub.href));
  };

  const combinedNavGroups = [...lcManagementNavItems, ...managementNavItems];

  const defaultOpenAccordions = combinedNavGroups
    .filter(item => item.subLinks && isGroupActive(item.subLinks))
    .map(item => item.groupLabel || '');


  const renderNavGroup = (item: NavItemGroup, index: number) => (
    item.subLinks ? (
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
                    isActive={pathname === subLink.href} // Exact match for sub-items
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
    ) : null
  );


  return (
    <>
      <SidebarHeader className="border-b">
        {/* TODO: Company name and logo should be fetched from settings/database */}
        <Link href="/dashboard" className="flex items-center gap-2 p-2">
          {companyLogoUrl ? (
             <Image
                src={companyLogoUrl} 
                alt="Company Logo"
                width={32}
                height={32}
                className="rounded-sm object-contain"
                data-ai-hint="company logo"
              />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-muted text-muted-foreground">
              <ImageIcon className="h-5 w-5" /> {/* Using Lucide's ImageIcon for placeholder */}
            </div>
          )}
          <span className={cn(
            "group-data-[collapsible=icon]:hidden font-bold text-lg bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out"
            )}
          >
            {companyName || "Smart Solution"} 
          </span>
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
            {managementNavItems.map(renderNavGroup)}
          </Accordion>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup className="p-0">
          <SidebarGroupLabel className="px-4 text-xs font-semibold uppercase text-muted-foreground group-data-[collapsible=icon]:hidden">
            Settings
          </SidebarGroupLabel>
          <SidebarMenu className="gap-0 px-2 py-1">
            {settingsNavItems.map((item) => {
              const canView = !item.roles || (userRole && item.roles.includes(userRole));
              if (!canView) return null;

              return (
                item.href &&
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
              );
            })}
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

type NavItem = {
  href?: string;
  label?: string;
  icon: React.ElementType;
};

type NavItemWithRoles = NavItem & {
  roles?: UserRole[];
};


type NavItemGroup = {
  groupLabel?: string;
  icon: React.ElementType; 
  subLinks?: Array<{
    href: string;
    label: string;
    icon?: React.ElementType; 
  }>;
};


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
  useSidebar,
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
  Settings,
  LogOut,
  Briefcase,
  Loader2,
  UserPlus,
  Building,
  FileText,
  Package,
  History,
  Search,
  DollarSign,
  CalendarClock,
  PanelLeftClose,
  PanelRightClose,
  Factory,
  Truck,
  Ship,
  ShieldCheck,
  BarChart3,
  Users as UsersIcon,
  Wrench,
  ClipboardList,
  ShieldOff,
  Archive,
  FileEdit,
  PackageCheck,
  Microscope, // Added Microscope for consistency if used elsewhere
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import Image from 'next/image';
import type { UserRole } from '@/types';
import React from 'react';

const mainDashboardLink: NavItem = { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard };
const globalSearchLink: NavItem = { href: '/dashboard/search', label: 'Global Search', icon: Search };

const coreModulesNavItems: NavItemGroup[] = [
  {
    groupLabel: 'T/T OR L/C Management',
    icon: FileText,
    subLinks: [
      { href: '/dashboard/total-lc', label: 'Total T/T OR L/C List', icon: ListChecks },
      { href: '/dashboard/new-lc-entry', label: 'New T/T OR L/C Entry', icon: FilePlus2 },
      { href: '/dashboard/shipments/recent-draft-lcs', label: 'Recent Draft L/Cs', icon: FileEdit },
    ],
  },
  {
    groupLabel: 'Commission Management',
    icon: Briefcase,
    subLinks: [
      { href: '/dashboard/commission-management/add-pi', label: 'Add New PI', icon: FilePlus2 },
      { href: '/dashboard/commission-management/issued-pi-list', label: 'Issued PI List', icon: ListChecks },
    ],
  },
];

const managementNavItems: NavItemGroup[] = [
  {
    groupLabel: 'Suppliers / Beneficiary',
    icon: Truck,
    subLinks: [
      { href: '/dashboard/suppliers', label: 'View Beneficiaries', icon: ListChecks },
      { href: '/dashboard/suppliers/add', label: 'Add New Beneficiary', icon: FilePlus2 },
    ],
  },
  {
    groupLabel: 'Customers / Applicants',
    icon: Factory,
    subLinks: [
      { href: '/dashboard/customers', label: 'View Applicants', icon: ListChecks },
      { href: '/dashboard/customers/add', label: 'Add New Applicant', icon: UserPlus },
    ],
  },
  {
    groupLabel: 'Shipment Management',
    icon: Ship,
    subLinks: [
      { href: '/dashboard/recent-shipments', label: 'Recent Shipments', icon: PackageCheck },
      { href: '/dashboard/shipments/upcoming-lc-shipment-dates', label: 'Upcoming L/C Shipment Dates', icon: CalendarClock },
      { href: '/dashboard/shipments/shipment-on-the-way', label: 'Shipment On The Way', icon: Package },
      { href: '/dashboard/shipments/lc-payment-done', label: 'L/C Payment Done', icon: DollarSign },
    ],
  },
];

const warrantyManagementNavItems: NavItemGroup[] = [
  {
    groupLabel: 'Warranty Management',
    icon: ShieldCheck,
    subLinks: [
      { href: '/dashboard/warranty-management/search', label: 'Warranty Search', icon: Search },
      { href: '/dashboard/warranty-management/new-installation-report', label: 'New Installation Report', icon: Wrench },
      { href: '/dashboard/warranty-management/installation-reports-view', label: 'Installation Reports View', icon: ClipboardList },
      { href: '/dashboard/warranty-management/machine-under-warranty', label: 'Machine Under Warranty', icon: ShieldCheck },
      { href: '/dashboard/warranty-management/machine-out-of-warranty', label: 'Machine Out of Warranty', icon: ShieldOff },
      { href: '/dashboard/warranty-management/missing-and-found', label: 'Missing and Found', icon: Archive },
    ],
  },
];

const reportingManagementNavItems: NavItemGroup[] = [
  {
    groupLabel: 'Reporting Management',
    icon: BarChart3,
    subLinks: [
      // Add sub-links here later if needed
    ],
  },
];


const settingsNavItems: NavItem[] = [
  { href: '/dashboard/settings/company-setup', label: 'Company Setup', icon: Building },
  { href: '/dashboard/settings/users', label: 'Users', icon: UserPlus },
  { href: '/dashboard/settings/smtp', label: 'SMTP Settings', icon: Settings },
  { href: '/dashboard/settings/logs', label: 'Logs', icon: History },
];

export function AppSidebarNav() {
  const pathname = usePathname();
  const { userRole, logout, loading: authLoading, companyName, companyLogoUrl } = useAuth();
  const sidebar = useSidebar();

  const companyLogoUrlFromContext = companyLogoUrl || "https://firebasestorage.googleapis.com/v0/b/lc-vision.firebasestorage.app/o/logoa%20(1)%20(1).png?alt=media&token=b5be1b22-2d2b-4951-b433-df2e3ea7eb6e";
  const displayCompanyName = companyName || "Smart Solution";

  React.useEffect(() => {
    if (typeof window !== 'undefined' && userRole) {
      // console.log("AppSidebarNav: Current User Role in Sidebar:", userRole);
    }
  }, [userRole]);

  const isActive = (href: string) => {
    if (href === '/dashboard' && pathname === '/dashboard') return true;
    if (href === '/dashboard/search' && pathname.startsWith('/dashboard/search')) return true;

    if (href !== '/dashboard' && href !== '/dashboard/search' && pathname.startsWith(href)) {
      const parentRoutes = [
        '/dashboard/suppliers',
        '/dashboard/customers',
        '/dashboard/total-lc',
        '/dashboard/commission-management/issued-pi-list',
        '/dashboard/settings/users',
        '/dashboard/warranty-management/installation-reports-view',
      ];
      if (parentRoutes.some(parent => href === parent && (pathname === parent || pathname.startsWith(`${parent}/`)))) {
        return true;
      }
      if (pathname === href) {
        return true;
      }
      return false;
    }
    return false;
  };

  const isGroupActive = (subLinks: Array<{ href: string }>) => {
    return subLinks.some(sub => isActive(sub.href));
  };

  const allAccordionGroups = [...coreModulesNavItems, ...managementNavItems, ...warrantyManagementNavItems, ...reportingManagementNavItems];

  const defaultOpenAccordions = React.useMemo(() => {
    return allAccordionGroups
      .filter(item => item.subLinks && isGroupActive(item.subLinks))
      .map(item => item.groupLabel || '');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);


  const renderNavGroup = (item: NavItemGroup, index: number) => {
    const IconComponent = item.icon;

    return (
      <AccordionItem value={item.groupLabel || `group-${index}`} key={item.groupLabel || `group-${index}`} className="border-none">
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
                <AccordionTrigger
                  className={cn(
                    "flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-none ring-sidebar-ring transition-all hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 group-has-[[data-sidebar=menu-action]]/menu-item:pr-8 aria-disabled:pointer-events-none aria-disabled:opacity-50",
                    "hover:no-underline justify-start group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:p-2",
                    "[&>svg.lucide-chevron-down]:group-data-[collapsible=icon]:hidden",
                    (defaultOpenAccordions.includes(item.groupLabel || '') && "bg-sidebar-accent text-sidebar-accent-foreground font-medium")
                  )}
                >
                  <div className="flex items-center gap-2">
                    <IconComponent className="h-5 w-5 text-primary" />
                    <span className="group-data-[collapsible=icon]:hidden">{item.groupLabel}</span>
                  </div>
                </AccordionTrigger>
            </TooltipTrigger>
             <TooltipContent side="right" className="ml-2 group-data-[collapsible=expanded]:hidden">
              <p>{item.groupLabel}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        {item.subLinks && item.subLinks.length > 0 && (
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
        )}
      </AccordionItem>
    )
  };

  return (
    <>
      <SidebarHeader className="border-b">
        <div className="flex items-center justify-between p-2">
            <Link href="/dashboard" className="flex items-center gap-2">
            <Image
                src={companyLogoUrlFromContext}
                alt="Company Logo"
                data-ai-hint="company logo"
                width={32}
                height={32}
                className="rounded-sm object-contain"
                priority
            />
            <span className={cn(
                "font-bold text-lg group-data-[collapsible=icon]:hidden",
                "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out"
                )}
            >
                {displayCompanyName}
            </span>
            </Link>
            {!sidebar.isMobile && (
                 <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    onClick={sidebar.toggleSidebar}
                    aria-label={sidebar.state === 'expanded' ? "Collapse Sidebar" : "Expand Sidebar"}
                 >
                    {sidebar.state === 'expanded' ? <PanelLeftClose className="h-5 w-5" /> : <PanelRightClose className="h-5 w-5" />}
                    <span className="sr-only">{sidebar.state === 'expanded' ? "Collapse Sidebar" : "Expand Sidebar"}</span>
                </Button>
            )}
        </div>
      </SidebarHeader>
      <SidebarContent className="p-0">
        <SidebarMenu className="gap-0 px-2 py-2">
            {[mainDashboardLink, globalSearchLink].map((item) => (
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
                      {item.icon && <item.icon className="h-5 w-5 text-primary" />}
                      <span className="group-data-[collapsible=icon]:hidden">{item.label}</span>
                    </a>
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
            ))}
        </SidebarMenu>

        <SidebarSeparator />
        <SidebarGroupLabel className="px-4 text-xs font-semibold uppercase text-muted-foreground group-data-[collapsible=icon]:hidden">
            Core Modules
        </SidebarGroupLabel>
        <Accordion type="multiple" defaultValue={defaultOpenAccordions} className="w-full">
            {coreModulesNavItems.map(renderNavGroup)}
        </Accordion>

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
            Warranty Management
          </SidebarGroupLabel>
          <Accordion type="multiple" defaultValue={defaultOpenAccordions} className="w-full">
              {warrantyManagementNavItems.map(renderNavGroup)}
          </Accordion>
        </SidebarGroup>
        
        <SidebarSeparator />
        <SidebarGroup className="p-0">
          <SidebarGroupLabel className="px-4 text-xs font-semibold uppercase text-muted-foreground group-data-[collapsible=icon]:hidden">
            Reporting Management
          </SidebarGroupLabel>
          <Accordion type="multiple" defaultValue={defaultOpenAccordions} className="w-full">
              {reportingManagementNavItems.map(renderNavGroup)}
          </Accordion>
        </SidebarGroup>


        <SidebarSeparator />
        <SidebarGroup className="p-0">
          <SidebarGroupLabel className="px-4 text-xs font-semibold uppercase text-muted-foreground group-data-[collapsible=icon]:hidden">
            Settings
          </SidebarGroupLabel>
          <SidebarMenu className="gap-0 px-2 py-1">
             {settingsNavItems.map((item) => (
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
                        {item.icon && <item.icon className="h-5 w-5 text-primary" />}
                        <span className="group-data-[collapsible=icon]:hidden">{item.label}</span>
                      </a>
                    </SidebarMenuButton>
                  </Link>
                </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="mt-auto border-t p-2 flex items-center justify-between">
        <Button
          variant="ghost"
          className="flex-grow justify-start gap-2 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:justify-center"
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

interface NavItem {
  href?: string;
  label?: string;
  icon: React.ElementType;
  roles?: UserRole[];
}

interface NavItemGroup {
  groupLabel?: string;
  icon: React.ElementType;
  subLinks?: Array<{
    href: string;
    label: string;
    icon?: React.ElementType;
  }>;
}

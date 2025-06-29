
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
  Ship,
  CalendarClock,
  PanelLeftClose,
  PanelRightClose,
  Settings,
  LogOut,
  History,
  Search,
  Wrench,
  ClipboardList,
  Archive,
  ShieldCheck,
  ShieldOff,
  BarChart3,
  DollarSign,
  Package,
  Sheet,
  Briefcase,
  FileText,
  Factory,
  Truck,
  Building,
  Laptop,
  AppWindow,
  FileCode,
  FileEdit,
  PackageCheck,
  Microscope,
  Users as UsersIcon,
  Receipt,
  ShoppingCart,
  CreditCard,
  Undo2,
  PlusCircle,
  Loader2,
  LayoutGrid,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import Image from 'next/image';
import type { UserRole } from '@/types';
import React from 'react';

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
    roles?: UserRole[];
  }>;
  roles?: UserRole[];
}

const mainDashboardLink: NavItem = { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ["Super Admin", "Admin", "User"] };
const globalSearchLink: NavItem = { href: '/dashboard/search', label: 'Global Search', icon: Search, roles: ["Super Admin", "Admin"] };

const coreModulesNavItems: NavItemGroup[] = [
  {
    groupLabel: 'T/T OR L/C Management',
    icon: FileText,
    roles: ["Super Admin", "Admin"],
    subLinks: [
      { href: '/dashboard/total-lc', label: 'Total T/T OR L/C List', icon: ListChecks },
      { href: '/dashboard/shipments/recent-draft-lcs', label: 'Recent Draft L/Cs', icon: FileEdit },
      { href: '/dashboard/google-sheets', label: 'Google Sheets', icon: Sheet },
    ],
  },
  {
    groupLabel: 'Commission Management',
    icon: Briefcase,
    roles: ["Super Admin", "Admin"],
    subLinks: [
      { href: '/dashboard/commission-management/issued-pi-list', label: 'Issued PI List', icon: ListChecks },
    ],
  },
];

const financialNavItems: NavItemGroup[] = [
  {
    groupLabel: 'Invoicing & Quote',
    icon: Receipt,
    roles: ["Super Admin", "Admin", "Store Manager"],
    subLinks: [
      { href: '/dashboard/quotes/list', label: 'Quotes List', icon: ListChecks },
      { href: '/dashboard/quotes/create', label: 'Create Quote', icon: FilePlus2 },
      { href: '/dashboard/invoices/list', label: 'Invoices List', icon: ListChecks },
      { href: '/dashboard/invoices/create', label: 'Create Invoice', icon: FilePlus2 },
      { href: '/dashboard/orders/list', label: 'Orders List', icon: ListChecks },
      { href: '/dashboard/orders/create', label: 'Create Order', icon: ShoppingCart },
      { href: '/dashboard/payments/apply', label: 'Apply Payment', icon: CreditCard },
      { href: '/dashboard/payments/view', label: 'View Payments', icon: ListChecks },
      { href: '/dashboard/payments/refunds', label: 'Refunds & Returns', icon: Undo2 },
      { href: '/dashboard/financial-management/invoicing-sales/layout', label: 'Layout', icon: LayoutGrid, roles: ["Super Admin", "Admin"] },
      { href: '/dashboard/financial-management/invoicing-sales/setting', label: 'Setting', icon: Settings, roles: ["Super Admin", "Admin"] },
    ],
  },
];

const inventoryManagementNavItems: NavItemGroup[] = [
  {
    groupLabel: 'Inventory Management',
    icon: Package,
    roles: ["Super Admin", "Admin", "Store Manager"],
    subLinks: [
      { href: '/dashboard/items/add', label: 'Add New Item', icon: PlusCircle },
      { href: '/dashboard/items/list', label: 'Items List', icon: ListChecks },
      { href: '/dashboard/inventory/sales', label: 'Record New Sale', icon: DollarSign },
      { href: '/dashboard/inventory/sales-list', label: 'Sales List', icon: ListChecks },
      { href: '/dashboard/inventory/refunds-returns', label: 'Refunds & Returns', icon: Undo2 },
    ],
  },
];

const managementNavItems: NavItemGroup[] = [
  {
    groupLabel: 'Suppliers / Beneficiary',
    icon: Truck,
    roles: ["Super Admin", "Admin"],
    subLinks: [
      { href: '/dashboard/suppliers', label: 'View Beneficiaries', icon: ListChecks },
    ],
  },
  {
    groupLabel: 'Customers / Applicants',
    icon: Factory,
    roles: ["Super Admin", "Admin"],
    subLinks: [
      { href: '/dashboard/customers', label: 'View Applicants', icon: ListChecks },
    ],
  },
  {
    groupLabel: 'Shipment Management',
    icon: Ship,
    roles: ["Super Admin", "Admin"],
    subLinks: [
      { href: '/dashboard/recent-shipments', label: 'Recent Shipments', icon: PackageCheck },
      { href: '/dashboard/shipments/upcoming-lc-shipment-dates', label: 'Upcoming L/C Shipments', icon: CalendarClock },
      { href: '/dashboard/shipments/shipment-on-the-way', label: 'Shipment On The Way', icon: Package },
      { href: '/dashboard/shipments/lc-payment-done', label: 'L/C Payment Done', icon: DollarSign },
    ],
  },
];

const demoMachineManagementNavItems: NavItemGroup[] = [
  {
    groupLabel: 'Demo M/C Management',
    icon: Laptop,
    roles: ["Super Admin", "Admin", "DemoManager"],
    subLinks: [
      { href: '/dashboard/demo/demo-machine-search', label: 'Demo Machine Search', icon: Search },
      { href: '/dashboard/demo/demo-machine-list', label: 'Demo Machine List', icon: ListChecks },
      { href: '/dashboard/demo/demo-machine-factories-list', label: 'Demo Machine Factories List', icon: ListChecks },
      { href: '/dashboard/demo/demo-machine-program', label: 'Demo Machine Program', icon: FileCode },
      { href: '/dashboard/demo/demo-mc-date-overdue', label: 'Demo M/C Date Overdue', icon: CalendarClock },
    ],
  },
];

const warrantyManagementNavItems: NavItemGroup[] = [
 {
    groupLabel: 'Warranty Management',
    icon: ShieldCheck,
    roles: ["Super Admin", "Admin", "Service"],
    subLinks: [
      { href: '/dashboard/warranty-management/search', label: 'Warranty Search', icon: Search },
      { href: '/dashboard/warranty-management/installation-reports-view', label: 'Installation Reports View', icon: ClipboardList },
      { href: '/dashboard/warranty-management/missing-and-found', label: 'Missing and Found', icon: Archive },
      { href: '/dashboard/warranty-management/machine-under-warranty', label: 'Machines Under Warranty', icon: ShieldCheck },
      { href: '/dashboard/warranty-management/machine-out-of-warranty', label: 'Machines Out of Warranty', icon: ShieldOff },
    ],
  },
];

const reportingManagementNavItems: NavItemGroup[] = [
  {
    groupLabel: 'Reporting Management',
    icon: BarChart3,
    roles: ["Super Admin", "Admin"],
    subLinks: [
    ],
  },
];

const settingsNavItems: NavItem[] = [
  { href: '/dashboard/settings/company-setup', label: 'Company Setup', icon: Building, roles: ["Super Admin", "Admin"] },
  { href: '/dashboard/settings/users', label: 'User Management', icon: UsersIcon, roles: ["Super Admin", "Admin"] },
  { href: '/dashboard/settings/smtp', label: 'SMTP Settings', icon: Settings, roles: ["Super Admin"] },
  { href: '/dashboard/settings/logs', label: 'Logs', icon: History, roles: ["Super Admin"] },
];

const allAccordionGroups = [
  ...coreModulesNavItems,
  ...financialNavItems,
  ...inventoryManagementNavItems,
  ...managementNavItems,
  ...demoMachineManagementNavItems,
  ...warrantyManagementNavItems,
  ...reportingManagementNavItems,
];

export function AppSidebarNav() {
  const pathname = usePathname();
  const { user, userRole, logout, loading: authLoading, companyName, companyLogoUrl } = useAuth();
  const sidebar = useSidebar();
  const [mounted, setMounted] = React.useState(false);

  const companyLogoUrlFromSettings = companyLogoUrl || "https://firebasestorage.googleapis.com/v0/b/lc-vision.firebasestorage.app/o/logoa%20(1)%20(1).png?alt=media&token=b5be1b22-2d2b-4951-b433-df2e3ea7eb6e";
  const displayCompanyNameFromSettings = companyName || "Smart Solution";
  const [openAccordions, setOpenAccordions] = React.useState<string[]>([]);

  const isGroupActive = React.useCallback((subLinks: NavItemGroup['subLinks']) => {
    if (!subLinks) return false;
    return subLinks.some(sub => sub.href && pathname.startsWith(sub.href));
  }, [pathname]);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (!mounted) return;

    const activeGroupOnLoad = allAccordionGroups.find(group => 
      group.subLinks && isGroupActive(group.subLinks)
    );
    
    let defaultOpenGroup = '';
    if (activeGroupOnLoad?.groupLabel) {
        defaultOpenGroup = activeGroupOnLoad.groupLabel;
    } else {
        switch(userRole) {
            case 'Service':
                defaultOpenGroup = 'Warranty Management';
                break;
            case 'DemoManager':
                defaultOpenGroup = 'Demo M/C Management';
                break;
            case 'Store Manager':
                defaultOpenGroup = 'Inventory Management';
                break;
            default:
                break; 
        }
    }
    
    setOpenAccordions(defaultOpenGroup ? [defaultOpenGroup] : []);

  }, [pathname, userRole, isGroupActive, mounted]);


  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === href;
    return pathname.startsWith(href) && (pathname === href || pathname.charAt(href.length) === '/');
  };

  const renderNavGroup = (item: NavItemGroup, index: number) => {
    // A user can see a group if their role is Super Admin, or if their role is in the item's role list.
    const hasGroupAccess =
      userRole === "Super Admin" || (item.roles && userRole && item.roles.includes(userRole as UserRole));

    if (!hasGroupAccess) {
        return null;
    }

    // Filter sublinks based on the user's role
    const visibleSubLinks = item.subLinks?.filter(subLink => 
        userRole === "Super Admin" || 
        !subLink.roles || // Show if sublink has no specific role restriction (inherits from group)
        (userRole && subLink.roles.includes(userRole as UserRole))
    ) || [];

    // If after filtering, there are no visible sublinks, don't render the group at all.
    if (visibleSubLinks.length === 0) {
        return null;
    }
    
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
                    (isGroupActive(visibleSubLinks) && "bg-sidebar-accent text-sidebar-accent-foreground font-medium")
                  )}
                >
                  <span className="flex items-center gap-2">
                    <IconComponent className="h-5 w-5 text-primary" />
                    <span className="group-data-[collapsible=icon]:hidden">{item.groupLabel}</span>
                  </span>
                </AccordionTrigger>
            </TooltipTrigger>
             <TooltipContent side="right" className="ml-2 group-data-[collapsible=expanded]:hidden">
              <p>{item.groupLabel}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        {visibleSubLinks.length > 0 && (
          <AccordionContent className="pt-0 pb-0 pl-6 pr-2 group-data-[collapsible=icon]:hidden overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
            <SidebarMenu className="gap-0 py-1">
              {visibleSubLinks.map((subLink) => (
                  <SidebarMenuItem key={subLink.href}>
                    <Link href={subLink.href} passHref>
                      <SidebarMenuButton
                        asChild
                        isActive={subLink.href ? isActive(subLink.href) : false}
                        className={cn(
                          (subLink.href && isActive(subLink.href)) && "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90 hover:text-sidebar-primary-foreground",
                          "h-8 text-xs"
                        )}
                        tooltip={{ children: subLink.label, side: "right", className: "ml-2" }}
                      >
                        <span className="flex items-center gap-2">
                           {subLink.icon && <subLink.icon className="h-4 w-4" />}
                          <span className="group-data-[collapsible=icon]:hidden">{subLink.label}</span>
                        </span>
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
              src={companyLogoUrlFromSettings}
              alt="Company Logo"
              data-ai-hint="company logo"
              width={32}
              height={32}
              className="rounded-sm object-contain"
              priority
            />
            <span
              className={cn(
                "font-bold text-lg group-data-[collapsible=icon]:hidden",
                "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out"
              )}
            >
              {displayCompanyNameFromSettings}
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
          { (userRole === "Super Admin" || userRole === "Admin" || userRole === "User") && mainDashboardLink.href && (
              <SidebarMenuItem key={mainDashboardLink.href}>
                <Link href={mainDashboardLink.href} passHref>
                  <SidebarMenuButton asChild isActive={isActive(mainDashboardLink.href)} className={cn(isActive(mainDashboardLink.href) && "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90 hover:text-sidebar-primary-foreground")} tooltip={{children: mainDashboardLink.label!, side: "right", className: "ml-2"}}>
                    <span className="flex items-center gap-2">
                      {mainDashboardLink.icon && <mainDashboardLink.icon className="h-5 w-5 text-primary" />}
                      <span className="group-data-[collapsible=icon]:hidden">{mainDashboardLink.label}</span>
                    </span>
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
          )}
          { (userRole === "Super Admin" || userRole === "Admin") && globalSearchLink.href && (
              <SidebarMenuItem key={globalSearchLink.href}>
                  <Link href={globalSearchLink.href} passHref>
                  <SidebarMenuButton asChild isActive={isActive(globalSearchLink.href)} className={cn(isActive(globalSearchLink.href) && "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90 hover:text-sidebar-primary-foreground")} tooltip={{children: globalSearchLink.label!, side: "right", className: "ml-2"}}>
                       <span className="flex items-center gap-2">
                        {globalSearchLink.icon && <globalSearchLink.icon className="h-5 w-5 text-primary" />}
                        <span className="group-data-[collapsible=icon]:hidden">{globalSearchLink.label}</span>
                      </span>
                  </SidebarMenuButton>
                  </Link>
              </SidebarMenuItem>
          )}
        </SidebarMenu>

        <Accordion type="multiple" value={openAccordions} onValueChange={setOpenAccordions} className="w-full">
            <SidebarSeparator />
            <SidebarGroup className="p-0">
                <SidebarGroupLabel className="px-4 text-xs font-semibold uppercase text-muted-foreground group-data-[collapsible=icon]:hidden">
                    Core Modules
                </SidebarGroupLabel>
                {coreModulesNavItems.map((item, index) => renderNavGroup(item, index))}
            </SidebarGroup>

            <SidebarSeparator />
            <SidebarGroup className="p-0">
                <SidebarGroupLabel className="px-4 text-xs font-semibold uppercase text-muted-foreground group-data-[collapsible=icon]:hidden">
                    Financial Management
                </SidebarGroupLabel>
                {financialNavItems.map((item, index) => renderNavGroup(item, index))}
                {inventoryManagementNavItems.map((item, index) => renderNavGroup(item, index))}
            </SidebarGroup>

            <SidebarSeparator />
            <SidebarGroup className="p-0">
              <SidebarGroupLabel className="px-4 text-xs font-semibold uppercase text-muted-foreground group-data-[collapsible=icon]:hidden">
                General Management
              </SidebarGroupLabel>
              {managementNavItems.map((item, index) => renderNavGroup(item, index))}
            </SidebarGroup>

            <SidebarSeparator />
            <SidebarGroup className="p-0">
              <SidebarGroupLabel className="px-4 text-xs font-semibold uppercase text-muted-foreground group-data-[collapsible=icon]:hidden">
                Demo M/C Management
              </SidebarGroupLabel>
              {demoMachineManagementNavItems.map((item, index) => renderNavGroup(item, index))}
            </SidebarGroup>
            
            <SidebarSeparator />
            <SidebarGroup className="p-0">
              <SidebarGroupLabel className="px-4 text-xs font-semibold uppercase text-muted-foreground group-data-[collapsible=icon]:hidden">
                Warranty Management
              </SidebarGroupLabel>
              {warrantyManagementNavItems.map((item, index) => renderNavGroup(item, index))}
            </SidebarGroup>

            <SidebarSeparator />
            <SidebarGroup className="p-0">
              <SidebarGroupLabel className="px-4 text-xs font-semibold uppercase text-muted-foreground group-data-[collapsible=icon]:hidden">
                Reporting Management
              </SidebarGroupLabel>
              {reportingManagementNavItems.map((item, index) => renderNavGroup(item, index))}
            </SidebarGroup>
        </Accordion>

        <SidebarSeparator />
        <SidebarGroup className="p-0">
          <SidebarGroupLabel className="px-4 text-xs font-semibold uppercase text-muted-foreground group-data-[collapsible=icon]:hidden">
            Settings
          </SidebarGroupLabel>
          <SidebarMenu className="gap-0 px-2 py-1">
             {settingsNavItems.map((item) => {
                const isVisible = userRole === "Super Admin" || (item.roles && userRole && item.roles.includes(userRole as UserRole));
                if (isVisible && item.href) {
                  return (
                    <SidebarMenuItem key={item.href}>
                      <Link href={item.href} passHref>
                        <SidebarMenuButton
                          asChild
                          isActive={isActive(item.href)}
                          className={cn(isActive(item.href) && "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90 hover:text-sidebar-primary-foreground")}
                          tooltip={{children: item.label!, side: "right", className: "ml-2"}}
                        >
                          <span className="flex items-center gap-2">
                            {item.icon && <item.icon className="h-5 w-5 text-primary" />}
                            <span className="group-data-[collapsible=icon]:hidden">{item.label}</span>
                          </span>
                        </SidebarMenuButton>
                      </Link>
                    </SidebarMenuItem>
                  );
                }
                return null;
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="mt-auto border-t p-2 flex items-center justify-between">
        <Button
          variant="ghost"
          className="flex-grow justify-start gap-2 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:justify-center"
          onClick={logout}
          disabled={authLoading}
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

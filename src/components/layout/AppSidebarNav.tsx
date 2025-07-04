
"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React from 'react';
import {
  useSidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
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
  DollarSign,
  Package,
  Sheet,
  Briefcase,
  FileText,
  Factory,
  Truck,
  Building,
  Laptop,
  FileCode,
  FileEdit,
  PackageCheck,
  Microscope,
  Users as UsersIcon,
  Receipt,
  ShoppingCart,
  CreditCard,
  Undo2,
  Loader2,
  LayoutGrid,
  Minus,
  Plus,
  PlusCircle,
  FolderOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import Image from 'next/image';
import type { UserRole } from '@/types';

interface NavItem {
  href: string;
  label: string;
  icon?: React.ElementType;
}

interface NavItemGroup {
  groupLabel: string;
  icon: React.ElementType;
  subLinks: NavItem[];
}

// Define Navigation Items
const mainNavItems: NavItem[] = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
];

const inventoryNavItems: NavItem[] = [
    { href: '/dashboard/items/add', label: 'Add New Item', icon: PlusCircle },
    { href: '/dashboard/items/list', label: 'Items List', icon: ListChecks },
    { href: '/dashboard/inventory/sales', label: 'Record New Sale', icon: DollarSign },
    { href: '/dashboard/inventory/sales-list', label: 'Sales List', icon: ListChecks },
    { href: '/dashboard/inventory/refunds-returns', label: 'Inventory Returns', icon: Undo2 },
];

const financialNavItems: NavItem[] = [
    { href: '/dashboard/quotes/list', label: 'Quotes List', icon: ListChecks },
    { href: '/dashboard/quotes/create', label: 'Create Quote', icon: FilePlus2 },
    { href: '/dashboard/invoices/list', label: 'Invoices List', icon: ListChecks },
    { href: '/dashboard/invoices/create', label: 'Create Invoice', icon: FilePlus2 },
    { href: '/dashboard/orders/list', label: 'Orders List', icon: ListChecks },
    { href: '/dashboard/orders/create', label: 'Create Order', icon: ShoppingCart },
    { href: '/dashboard/payments/apply', label: 'Apply Payment', icon: CreditCard },
    { href: '/dashboard/payments/view', label: 'View Payments', icon: ListChecks },
    { href: '/dashboard/payments/refunds', label: 'Refunds & Returns', icon: Undo2 },
    { href: '/dashboard/financial-management/invoicing-sales/layout', label: 'Layout', icon: LayoutGrid },
    { href: '/dashboard/financial-management/invoicing-sales/setting', label: 'Setting', icon: Settings },
];

const commissionManagementNavItems: NavItem[] = [
    { href: '/dashboard/commission-management/issued-pi-list', label: 'Issued PI List', icon: ListChecks },
];

const lcManagementNavItems: NavItem[] = [
    { href: '/dashboard/total-lc', label: 'Total T/T OR L/C List', icon: ListChecks },
    { href: '/dashboard/google-sheets', label: 'Google Sheets', icon: Sheet },
    { href: '/dashboard/google-drive', label: 'Google Drive', icon: FolderOpen },
];

const partiesNavItems: NavItem[] = [
    { href: '/dashboard/suppliers', label: 'View Beneficiaries', icon: Truck },
    { href: '/dashboard/customers', label: 'View Applicants', icon: Factory },
];

const shipmentNavItems: NavItem[] = [
    { href: '/dashboard/shipments/upcoming-lc-shipment-dates', label: 'Upcoming L/C Shipments', icon: CalendarClock },
    { href: '/dashboard/shipments/shipment-on-the-way', label: 'Shipment Done', icon: PackageCheck },
    { href: '/dashboard/shipments/lc-payment-pending', label: 'Payment Pending', icon: DollarSign },
    { href: '/dashboard/shipments/lc-payment-done', label: 'L/C Payment Done', icon: DollarSign },
];

const demoNavItems: NavItem[] = [
    { href: '/dashboard/demo/demo-machine-search', label: 'Demo Machine Search', icon: Search },
    { href: '/dashboard/demo/demo-machine-list', label: 'Demo Machine List', icon: ListChecks },
    { href: '/dashboard/demo/demo-machine-factories-list', label: 'Demo Machine Factories List', icon: ListChecks },
    { href: '/dashboard/demo/demo-machine-program', label: 'Demo Machine Program', icon: FileCode },
    { href: '/dashboard/demo/demo-mc-date-overdue', label: 'Demo M/C Date Overdue', icon: CalendarClock },
];

const serviceNavItems: NavItem[] = [
    { href: '/dashboard/warranty-management/search', label: 'Warranty Search', icon: Search },
    { href: '/dashboard/warranty-management/installation-reports-view', label: 'Installation Reports View', icon: ClipboardList },
    { href: '/dashboard/warranty-management/missing-and-found', label: 'Missing and Found', icon: Archive },
    { href: '/dashboard/warranty-management/machine-under-warranty', label: 'Machines Under Warranty', icon: ShieldCheck },
    { href: '/dashboard/warranty-management/machine-out-of-warranty', label: 'Machines Out of Warranty', icon: ShieldOff },
];

const settingsNavItems: NavItem[] = [
    { href: '/dashboard/settings/company-setup', label: 'Company Setup', icon: Building },
    { href: '/dashboard/settings/users', label: 'User Management', icon: UsersIcon },
    { href: '/dashboard/settings/smtp', label: 'SMTP Settings', icon: Settings },
    { href: '/dashboard/settings/logs', label: 'Logs', icon: History },
];

// Define Group Structure
const allNavGroups: NavItemGroup[] = [
  { groupLabel: 'Inventory Management', icon: Package, subLinks: inventoryNavItems },
  { groupLabel: 'Financial Management', icon: Receipt, subLinks: financialNavItems },
  { groupLabel: "Commission Management", icon: Briefcase, subLinks: commissionManagementNavItems },
  { groupLabel: "T/T OR L/C Management", icon: FileText, subLinks: lcManagementNavItems },
  { groupLabel: 'Customers / Applicants', icon: UsersIcon, subLinks: partiesNavItems },
  { groupLabel: 'Shipment Management', icon: Ship, subLinks: shipmentNavItems },
  { groupLabel: 'Demo M/C Management', icon: Laptop, subLinks: demoNavItems },
  { groupLabel: 'Warranty Management', icon: ShieldCheck, subLinks: serviceNavItems },
  { groupLabel: 'Settings', icon: Settings, subLinks: settingsNavItems },
];

export function AppSidebarNav() {
  const pathname = usePathname();
  const { logout, loading: authLoading, companyName, companyLogoUrl } = useAuth();
  const sidebar = useSidebar();
  
  const companyLogoUrlFromSettings = companyLogoUrl || "https://firebasestorage.googleapis.com/v0/b/lc-vision.firebasestorage.app/o/logoa%20(1)%20(1).png?alt=media&token=b5be1b22-2d2b-4951-b433-df2e3ea7eb6e";
  const displayCompanyNameFromSettings = companyName || "Smart Solution";

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === href;
    return pathname.startsWith(href) && (pathname === href || pathname.charAt(href.length) === '/');
  };

  const [openAccordions, setOpenAccordions] = React.useState<string[]>([]);
  
  React.useEffect(() => {
    const isGroupActive = (subLinks: NavItem[]) => subLinks.some(sub => isActive(sub.href));
    
    const activeGroup = allNavGroups.find(group => isGroupActive(group.subLinks));
    if (activeGroup) {
      setOpenAccordions([activeGroup.groupLabel]);
    } else if (allNavGroups.length > 0) {
      // Default to opening the first group if no route is active
      setOpenAccordions([allNavGroups[0].groupLabel]);
    } else {
      setOpenAccordions([]);
    }
  }, [pathname]);

  return (
    <>
      <SidebarHeader className="border-b">
        <div className="flex items-center justify-between p-2">
          <Link href="/dashboard" className="flex items-center gap-2">
            <Image
              src={companyLogoUrlFromSettings}
              alt="Company Logo"
              width={32}
              height={32}
              className="rounded-sm object-contain"
              priority
              data-ai-hint="company logo"
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
          <SidebarMenu key="main-navigation" className="gap-0 px-2 py-2">
                {mainNavItems.map(subLink => (
                    <SidebarMenuItem key={subLink.href}>
                        <Link href={subLink.href} passHref>
                        <SidebarMenuButton asChild isActive={isActive(subLink.href)} className={cn(isActive(subLink.href) && "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90 hover:text-sidebar-primary-foreground")} tooltip={{children: subLink.label!, side: "right", className: "ml-2"}}>
                            <span className="flex items-center gap-2">
                            {subLink.icon && <subLink.icon className="h-5 w-5" />}
                            <span className="group-data-[collapsible=icon]:hidden">{subLink.label}</span>
                            </span>
                        </SidebarMenuButton>
                        </Link>
                    </SidebarMenuItem>
                ))}
            </SidebarMenu>
          <Accordion type="multiple" value={openAccordions} onValueChange={setOpenAccordions} className="w-full">
            {allNavGroups.map((group) => {
              const IconComponent = group.icon;
              return (
                <AccordionItem value={group.groupLabel} key={group.groupLabel} className="border-none">
                  <TooltipProvider delayDuration={0}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                          <AccordionTrigger
                            className={cn(
                              "flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-none ring-sidebar-ring transition-all hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 group-has-[[data-sidebar=menu-action]]/menu-item:pr-8 aria-disabled:pointer-events-none aria-disabled:opacity-50",
                              "hover:no-underline justify-start group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:p-2",
                              "[&>svg.lucide-chevron-down]:group-data-[collapsible=icon]:hidden",
                              (openAccordions.includes(group.groupLabel) && "bg-sidebar-accent text-sidebar-accent-foreground font-medium")
                            )}
                          >
                            <span className="flex items-center gap-2">
                              <IconComponent className="h-5 w-5" />
                              <span className="group-data-[collapsible=icon]:hidden">{group.groupLabel}</span>
                            </span>
                          </AccordionTrigger>
                      </TooltipTrigger>
                       <TooltipContent side="right" className="ml-2 group-data-[collapsible=expanded]:hidden">
                        <p>{group.groupLabel}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <AccordionContent className="pt-0 pb-0 pl-6 pr-2 group-data-[collapsible=icon]:hidden overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
                    <SidebarMenu className="gap-0 py-1">
                      {group.subLinks.map((subLink) => (
                          <SidebarMenuItem key={subLink.href}>
                            <Link href={subLink.href} passHref>
                              <SidebarMenuButton
                                asChild
                                isActive={isActive(subLink.href)}
                                className={cn(
                                  isActive(subLink.href) && "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90 hover:text-sidebar-primary-foreground",
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
                </AccordionItem>
              )
            })}
          </Accordion>
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

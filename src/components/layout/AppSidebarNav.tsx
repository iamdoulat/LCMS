

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
  Bell,
  BarChart3,
  Wallet,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import Image from 'next/image';
import type { UserRole } from '@/types';

interface NavItem {
  href: string;
  label: string;
  icon?: React.ElementType;
  iconColorClass?: string;
}

interface NavItemGroup {
  groupLabel: string;
  icon: React.ElementType;
  iconColorClass?: string;
  allowedRoles: UserRole[]; // Added to control group visibility
}

// Define Navigation Items
const mainNavItems: NavItem[] = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, iconColorClass: 'bg-icon-dashboard' },
];

const inventoryNavItems: NavItem[] = [
    { href: '/dashboard/petty-cash/dashboard', label: 'Account Dashboard', icon: LayoutDashboard, iconColorClass: 'bg-icon-dashboard' },
    { href: '/dashboard/inventory/items/list', label: 'Stock Items', icon: ListChecks, iconColorClass: 'bg-icon-list' },
    { href: '/dashboard/inventory/sales-invoices', label: 'Sales Invoices', icon: Receipt, iconColorClass: 'bg-icon-sale' },
    { href: '/dashboard/inventory/delivery-challan', label: 'Delivery Challan', icon: Truck, iconColorClass: 'bg-icon-shipment-done' },
    { href: '/dashboard/inventory/inventory-orders/list', label: 'Orders List', icon: ListChecks, iconColorClass: 'bg-icon-list' },
    { href: '/dashboard/payments/apply', label: 'Apply Payment', icon: CreditCard, iconColorClass: 'bg-icon-payment' },
    { href: '/dashboard/payments/view', label: 'View Payments', icon: ListChecks, iconColorClass: 'bg-icon-list' },
    { href: '/dashboard/payments/refunds', label: 'Refunds & Returns', icon: Undo2, iconColorClass: 'bg-icon-return' },
    { href: '/dashboard/petty-cash/reports', label: 'Reports', icon: BarChart3, iconColorClass: 'bg-icon-reports' },
    { href: '/dashboard/petty-cash/settings', label: 'Settings', icon: Settings, iconColorClass: 'bg-icon-settings' },
];

const financialNavItems: NavItem[] = [
    { href: '/dashboard/quotations/list', label: 'Quotation List', icon: ListChecks, iconColorClass: 'bg-icon-list' },
    { href: '/dashboard/pi/list', label: 'Proforma Invoice List', icon: ListChecks, iconColorClass: 'bg-icon-list' },
    { href: '/dashboard/quotations/items', label: 'Products Lists', icon: ListChecks, iconColorClass: 'bg-icon-list' },
    { href: '/dashboard/purchase-orders/list', label: 'Purchase Orders', icon: ShoppingCart, iconColorClass: 'bg-icon-list' },
    { href: '/dashboard/pi/pi-settings', label: 'PI Settings', icon: Settings, iconColorClass: 'bg-icon-settings' },
];

const commissionManagementNavItems: NavItem[] = [
    { href: '/dashboard/commission-management/add-pi', label: 'Add New PI', icon: PlusCircle, iconColorClass: 'bg-icon-add' },
    { href: '/dashboard/commission-management/issued-pi-list', label: 'Issued PI List', icon: ListChecks, iconColorClass: 'bg-icon-list' },
];

const lcManagementNavItems: NavItem[] = [
    { href: '/dashboard/total-lc', label: 'Total T/T OR L/C List', icon: ListChecks, iconColorClass: 'bg-icon-lc' },
    { href: '/dashboard/reports', label: 'Reports', icon: BarChart3, iconColorClass: 'bg-icon-reports' },
    { href: '/dashboard/google-sheets', label: 'Google Sheets', icon: Sheet, iconColorClass: 'bg-icon-sheets' },
    { href: '/dashboard/google-drive', label: 'Google Drive', icon: FolderOpen, iconColorClass: 'bg-icon-drive' },
];

const partiesNavItems: NavItem[] = [
    { href: '/dashboard/suppliers', label: 'View Beneficiaries', icon: Truck, iconColorClass: 'bg-icon-beneficiary' },
    { href: '/dashboard/customers', label: 'View Applicants', icon: Factory, iconColorClass: 'bg-icon-applicant' },
];

const shipmentNavItems: NavItem[] = [
    { href: '/dashboard/shipments/upcoming-lc-shipment-dates', label: 'Upcoming L/C Shipments', icon: CalendarClock, iconColorClass: 'bg-icon-upcoming' },
    { href: '/dashboard/shipments/shipment-on-the-way', label: 'Shipment Done', icon: PackageCheck, iconColorClass: 'bg-icon-shipment-done' },
    { href: '/dashboard/shipments/lc-payment-pending', label: 'Payment Pending', icon: DollarSign, iconColorClass: 'bg-icon-payment-pending' },
    { href: '/dashboard/shipments/lc-payment-done', label: 'L/C Payment Done', icon: DollarSign, iconColorClass: 'bg-icon-payment-done' },
];

const demoNavItems: NavItem[] = [
    { href: '/dashboard/demo/demo-machine-search', label: 'Demo Machine Search', icon: Search, iconColorClass: 'bg-icon-search' },
    { href: '/dashboard/demo/demo-machine-list', label: 'Demo Machine List', icon: ListChecks, iconColorClass: 'bg-icon-list' },
    { href: '/dashboard/demo/demo-machine-factories-list', label: 'Demo Machine Factories List', icon: ListChecks, iconColorClass: 'bg-icon-list' },
    { href: '/dashboard/demo/demo-machine-program', label: 'Demo Machine Program', icon: FileCode, iconColorClass: 'bg-icon-program' },
    { href: '/dashboard/demo/demo-machine-challan', label: 'Demo Machine Challan', icon: Truck, iconColorClass: 'bg-icon-shipment-done' },
    { href: '/dashboard/demo/demo-mc-date-overdue', label: 'Demo M/C Date Overdue', icon: CalendarClock, iconColorClass: 'bg-icon-overdue' },
];

const serviceNavItems: NavItem[] = [
    { href: '/dashboard/warranty-management/search', label: 'Warranty Search', icon: Search, iconColorClass: 'bg-icon-search' },
    { href: '/dashboard/warranty-management/new-installation-report', label: 'New Installation Report', icon: PlusCircle, iconColorClass: 'bg-icon-add' },
    { href: '/dashboard/warranty-management/installation-reports-view', label: 'View Installation Reports', icon: ClipboardList, iconColorClass: 'bg-icon-reports' },
    { href: '/dashboard/warranty-management/missing-and-found', label: 'Missing and Found', icon: Archive, iconColorClass: 'bg-icon-archive' },
    { href: '/dashboard/warranty-management/machine-under-warranty', label: 'Machines Under Warranty', icon: ShieldCheck, iconColorClass: 'bg-icon-warranty' },
    { href: '/dashboard/warranty-management/machine-out-of-warranty', label: 'Machines Out of Warranty', icon: ShieldOff, iconColorClass: 'bg-icon-no-warranty' },
];

const settingsNavItems: NavItem[] = [
    { href: '/dashboard/notifications', label: 'Notifications', icon: Bell, iconColorClass: 'bg-icon-notifications' },
    { href: '/dashboard/settings/company-setup', label: 'Company Setup', icon: Building, iconColorClass: 'bg-icon-company' },
    { href: '/dashboard/settings/users', label: 'User Management', icon: UsersIcon, iconColorClass: 'bg-icon-users' },
    { href: '/dashboard/financial-management/invoicing-sales/setting', label: 'Invoice Header Settings', icon: LayoutGrid, iconColorClass: 'bg-icon-settings' },
    { href: '/dashboard/settings/smtp', label: 'SMTP Settings', icon: Settings, iconColorClass: 'bg-icon-settings' },
    { href: '/dashboard/settings/logs', label: 'Logs', icon: History, iconColorClass: 'bg-icon-logs' },
];

// Define Group Structure
const allNavGroups: (NavItemGroup & { subLinks: NavItem[] })[] = [
  { groupLabel: "T/T OR L/C Management", icon: FileText, iconColorClass: 'bg-icon-lc', subLinks: lcManagementNavItems, allowedRoles: ["Super Admin", "Admin", "Viewer", "Commercial"] },
  { groupLabel: "Quotations and Invoices", icon: DollarSign, iconColorClass: 'bg-icon-financial', subLinks: financialNavItems, allowedRoles: ["Super Admin", "Admin", "Viewer", "Commercial"] },
  { groupLabel: "Accounts and Inventory", icon: Package, iconColorClass: 'bg-icon-list', subLinks: inventoryNavItems, allowedRoles: ["Super Admin", "Admin", "Accounts", "Viewer"] },
  { groupLabel: "Comm. Management", icon: Briefcase, iconColorClass: 'bg-icon-list', subLinks: commissionManagementNavItems, allowedRoles: ["Super Admin", "Admin", "Viewer", "Commercial"] },
  { groupLabel: "Suppliers / Applicants", icon: UsersIcon, iconColorClass: 'bg-icon-users', subLinks: partiesNavItems, allowedRoles: ["Super Admin", "Admin", "Viewer", "Commercial"] },
  { groupLabel: 'Shipment Management', icon: Ship, iconColorClass: 'bg-icon-shipment-done', subLinks: shipmentNavItems, allowedRoles: ["Super Admin", "Admin", "Viewer", "Commercial"] },
  { groupLabel: 'Demo M/C Management', icon: Laptop, iconColorClass: 'bg-icon-dashboard', subLinks: demoNavItems, allowedRoles: ["Super Admin", "Admin", "DemoManager", "Viewer", "Commercial"] },
  { groupLabel: 'Warranty Management', icon: ShieldCheck, iconColorClass: 'bg-icon-warranty', subLinks: serviceNavItems, allowedRoles: ["Super Admin", "Admin", "Service", "Viewer", "Commercial"] },
  { groupLabel: 'Settings', icon: Settings, iconColorClass: 'bg-icon-settings', subLinks: settingsNavItems, allowedRoles: ["Super Admin", "Admin"] },
];

export function AppSidebarNav() {
  const pathname = usePathname();
  const { userRole, logout, loading: authLoading, companyName, companyLogoUrl } = useAuth();
  const sidebar = useSidebar();
  
  const companyLogoUrlFromSettings = companyLogoUrl || "https://firebasestorage.googleapis.com/v0/b/lc-vision.firebasestorage.app/o/logoa%20(1)%20(1).png?alt=media&token=b5be1b22-2d2b-4951-b433-df2e3ea7eb6e";
  const displayCompanyNameFromSettings = companyName || "Smart Solution";

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === href;
    return pathname.startsWith(href) && (pathname === href || pathname.charAt(href.length) === '/');
  };

  const [openAccordions, setOpenAccordions] = React.useState<string[]>([]);
  
  const filteredNavGroups = React.useMemo(() => {
    if (!userRole) return [];
    return allNavGroups.filter(group => 
      group.allowedRoles.some(allowedRole => userRole.includes(allowedRole))
    );
  }, [userRole]);

  React.useEffect(() => {
    const isGroupActive = (subLinks: NavItem[]) => subLinks.some(sub => isActive(sub.href));
    
    const activeGroup = filteredNavGroups.find(group => isGroupActive(group.subLinks));
    if (activeGroup) {
      setOpenAccordions([activeGroup.groupLabel]);
    } else if (filteredNavGroups.length > 0) {
      // Default to opening the first group if no route is active
      setOpenAccordions([filteredNavGroups[0].groupLabel]);
    } else {
      setOpenAccordions([]);
    }
  }, [pathname, filteredNavGroups]);

  const canViewDashboard = userRole && !userRole.includes('DemoManager') && !userRole.includes('Accounts') && !userRole.includes('Service');

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
                "font-bold text-base group-data-[collapsible=icon]:hidden",
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
          {canViewDashboard && (
            <SidebarMenu key="main-navigation" className="gap-0 px-2 py-2">
                  {mainNavItems.map(subLink => (
                      <SidebarMenuItem key={subLink.href}>
                          <Link href={subLink.href} passHref>
                          <SidebarMenuButton asChild isActive={isActive(subLink.href)} className={cn(isActive(subLink.href) && "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90 hover:text-sidebar-primary-foreground")} tooltip={{children: subLink.label!, side: "right", className: "ml-2"}}>
                              <span className="flex items-center gap-2">
                              {subLink.icon && (
                                  <div className={cn("flex h-6 w-6 items-center justify-center rounded-md text-sidebar-primary-foreground", subLink.iconColorClass)}>
                                      <subLink.icon className="h-4 w-4" />
                                  </div>
                              )}
                              <span className="group-data-[collapsible=icon]:hidden">{subLink.label}</span>
                              </span>
                          </SidebarMenuButton>
                          </Link>
                      </SidebarMenuItem>
                  ))}
            </SidebarMenu>
          )}
          <Accordion type="multiple" value={openAccordions} onValueChange={setOpenAccordions} className="w-full">
            {filteredNavGroups.map((group) => {
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
                               openAccordions.includes(group.groupLabel) && 'bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90 hover:text-sidebar-primary-foreground font-medium'
                            )}
                          >
                            <span className="flex items-center gap-2">
                               <div className={cn("flex h-6 w-6 items-center justify-center rounded-md", group.iconColorClass || "bg-gray-200 text-gray-700")}>
                                <IconComponent className="h-4 w-4" />
                               </div>
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
                                   {subLink.icon && (
                                    <div className={cn("flex h-6 w-6 items-center justify-center rounded-md text-sidebar-primary-foreground", subLink.iconColorClass)}>
                                        <subLink.icon className="h-4 w-4" />
                                    </div>
                                   )}
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


"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React, { useState, useEffect } from 'react';
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  LayoutDashboard,
  ListChecks,
  Ship,
  CalendarClock,
  PanelLeft,
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
  Banknote,
  Calculator,
  Mailbox,
  Calendar,
  PanelRight,
  PanelLeftClose,
  CalendarPlus,
  Plane,
  MapPin,
  UserCheck,
  Mail,
  MessageSquare,
  MessageSquareText,
  Smartphone,
  Send,
  Database,
  QrCode,
  FileSpreadsheet,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import Image from 'next/image';
import type { UserRole } from '@/types';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from '@/components/ui/skeleton';
import { ThemeToggleButton } from '@/components/ui/ThemeToggleButton';


interface NavItem {
  href: string;
  label: string;
  icon?: React.ElementType;
  iconColorClass?: string;
  disabled?: boolean;
  allowedRoles?: UserRole[]; // Optional role restriction per item
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
  { href: '/dashboard/inventory/refunds-returns', label: 'Refunds & Returns', icon: Undo2, iconColorClass: 'bg-icon-return' },
  { href: '/dashboard/petty-cash/reports', label: 'Account Reports', icon: BarChart3, iconColorClass: 'bg-icon-reports' },
  { href: '/dashboard/inventory/stock-reports', label: 'Stock Reports', icon: BarChart3, iconColorClass: 'bg-icon-reports' },
  { href: '/dashboard/inventory/sales-invoices-reports', label: 'Sales Invoices Reports', icon: BarChart3, iconColorClass: 'bg-icon-reports' },
  { href: '/dashboard/petty-cash/settings', label: 'Settings', icon: Settings, iconColorClass: 'bg-icon-settings' },

];

const financialNavItems: NavItem[] = [
  { href: '/dashboard/quotations/list', label: 'Quotation List', icon: ListChecks, iconColorClass: 'bg-icon-list' },
  { href: '/dashboard/pi/list', label: 'Proforma Invoice List', icon: ListChecks, iconColorClass: 'bg-icon-list' },
  { href: '/dashboard/quotations/items', label: 'Products Lists', icon: ListChecks, iconColorClass: 'bg-icon-list' },
  { href: '/dashboard/purchase-orders/list', label: 'Purchase Orders', icon: ShoppingCart, iconColorClass: 'bg-icon-list' },
  { href: '/dashboard/quotations/reports', label: 'Quotations Reports', icon: BarChart3, iconColorClass: 'bg-icon-reports' },
  { href: '/dashboard/pi/reports', label: 'PI Reports', icon: BarChart3, iconColorClass: 'bg-icon-reports' },

  { href: '/dashboard/quotations/products-reports', label: 'Products list Reports', icon: BarChart3, iconColorClass: 'bg-icon-reports' },
  { href: '/dashboard/purchase-orders/reports', label: 'Purchase Orders Reports', icon: BarChart3, iconColorClass: 'bg-icon-reports' },
  { href: '/dashboard/pi/pi-settings', label: 'PI Settings', icon: Settings, iconColorClass: 'bg-icon-settings' },
];

const commissionManagementNavItems: NavItem[] = [
  { href: '/dashboard/commission-management', label: 'Commission Dashboard', icon: LayoutDashboard, iconColorClass: 'bg-icon-dashboard' },
  { href: '/dashboard/commission-management/add-pi', label: 'Add New PI', icon: PlusCircle, iconColorClass: 'bg-icon-add' },
  { href: '/dashboard/commission-management/issued-pi-list', label: 'Issued PI List', icon: ListChecks, iconColorClass: 'bg-icon-list' },
  { href: '/dashboard/commission-management/reports', label: 'Commission Report', icon: BarChart3, iconColorClass: 'bg-icon-reports' },
];

const lcManagementNavItems: NavItem[] = [
  { href: '/dashboard/total-lc', label: 'Total T/T OR L/C List', icon: ListChecks, iconColorClass: 'bg-icon-lc' },
  { href: '/dashboard/reports', label: 'Reports', icon: BarChart3, iconColorClass: 'bg-icon-reports' },
  { href: '/dashboard/shipments/upcoming-lc-shipment-dates', label: 'Upcoming Shipments', icon: CalendarClock, iconColorClass: 'bg-icon-upcoming' },
  { href: '/dashboard/shipments/shipment-on-the-way', label: 'Shipment Done', icon: PackageCheck, iconColorClass: 'bg-icon-shipment-done' },
  { href: '/dashboard/shipments/lc-payment-pending', label: 'Payment Pending', icon: DollarSign, iconColorClass: 'bg-icon-payment-pending' },
  { href: '/dashboard/shipments/lc-payment-done', label: 'L/C Payment Done', icon: DollarSign, iconColorClass: 'bg-icon-payment-done' },
  { href: '/dashboard/shipments/lc-expire-tracker', label: 'L/C Expire Tracker', icon: CalendarClock, iconColorClass: 'bg-icon-payment-pending' },
  { href: '/dashboard/deferred-payment-tracker', label: 'Deferred Payment Tracker', icon: CalendarClock, iconColorClass: 'bg-icon-payment-pending' },
];

const partiesNavItems: NavItem[] = [
  { href: '/dashboard/suppliers', label: 'View Beneficiaries', icon: Truck, iconColorClass: 'bg-icon-beneficiary' },
  { href: '/dashboard/customers', label: 'View Applicants', icon: Factory, iconColorClass: 'bg-icon-applicant' },
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
  { href: '/dashboard/warranty-management/claim-report-list', label: 'Claim Report List', icon: ListChecks, iconColorClass: 'bg-icon-reports' },
  { href: '/dashboard/warranty-management/new-installation-report', label: 'New Installation Report', icon: PlusCircle, iconColorClass: 'bg-icon-add' },
  { href: '/dashboard/warranty-management/installation-reports-view', label: 'View Installation Reports', icon: ClipboardList, iconColorClass: 'bg-icon-reports' },
  { href: '/dashboard/warranty-management/missing-and-found', label: 'Missing and Found', icon: Archive, iconColorClass: 'bg-icon-archive' },
  { href: '/dashboard/warranty-management/machine-under-warranty', label: 'Machines Under Warranty', icon: ShieldCheck, iconColorClass: 'bg-icon-warranty' },
  { href: '/dashboard/warranty-management/machine-out-of-warranty', label: 'Machines Out of Warranty', icon: ShieldOff, iconColorClass: 'bg-icon-no-warranty' },
  { href: '/dashboard/warranty-management/machinery-catalogues', label: 'Machinery Catalogues', icon: FileText, iconColorClass: 'bg-icon-financial' },
  { href: '/dashboard/warranty-management/error-codes', label: 'Error Codes', icon: FileCode, iconColorClass: 'bg-icon-lc' },
];

const projectManagementNavItems: NavItem[] = [
  { href: '/dashboard/project-management', label: 'Project Dashboard', icon: LayoutDashboard, iconColorClass: 'bg-icon-dashboard', allowedRoles: ["Super Admin", "Admin", "Service", "Viewer", "Commercial", "Supervisor"] },
  { href: '/dashboard/project-management/projects', label: 'Manage Project', icon: FolderOpen, iconColorClass: 'bg-icon-project', allowedRoles: ["Super Admin", "Admin", "Service", "Viewer", "Commercial", "Supervisor"] },
  { href: '/dashboard/project-management/tasks', label: 'Manage Tasks', icon: ListChecks, iconColorClass: 'bg-icon-list' }, // Available to all including Employee
  { href: '/dashboard/project-management/invoices', label: 'Manage Invoices', icon: Receipt, iconColorClass: 'bg-icon-sale', allowedRoles: ["Super Admin", "Admin", "Service", "Viewer", "Commercial", "Supervisor"] },
  { href: '/dashboard/project-management/settings', label: 'Project Settings', icon: Settings, iconColorClass: 'bg-icon-settings', allowedRoles: ["Super Admin", "Admin", "Service", "Viewer", "Commercial", "Supervisor"] },
];

const hrNavItems: NavItem[] = [
  { href: '/dashboard/hr/dashboard', label: 'HRM Dashboard', icon: LayoutDashboard, iconColorClass: 'bg-icon-dashboard' },
  { href: '/dashboard/hr/employees', label: 'Employee List', icon: UsersIcon, iconColorClass: 'bg-icon-users' },
  { href: '/dashboard/hr/payroll/salary-generation', label: 'Salary Generation', icon: Calculator, iconColorClass: 'bg-icon-payment' },
  { href: '/dashboard/hr/payroll/payslip-list', label: 'Payslip List', icon: ListChecks, iconColorClass: 'bg-icon-list' },
  { href: "/dashboard/hr/payroll/advance-salary", label: "Advance Salary", icon: DollarSign, iconColorClass: 'bg-icon-payment' },
  { href: "/dashboard/hr/attendance", label: "Attendance", icon: Calendar, iconColorClass: 'bg-icon-reports' },
  { href: "/dashboard/hr/leaves", label: "Leave Management", icon: Mailbox, iconColorClass: 'bg-icon-list' },
  { href: "/dashboard/hr/visit-applications", label: "Visit Application", icon: Plane, iconColorClass: 'bg-icon-list' },
  { href: "/dashboard/hr/multiple-check-in-out", label: "Multiple Check In/Out", icon: MapPin, iconColorClass: 'bg-icon-list' },
  { href: "/dashboard/hr/attendance-reconciliation", label: "Attendance Reconciliation", icon: UserCheck, iconColorClass: 'bg-icon-list' },
  { href: "/dashboard/hr/payroll/break-time-reconciliation", label: "Break Time Recon.", icon: CalendarClock, iconColorClass: 'bg-icon-list' },
  { href: "/dashboard/hr/holidays", label: "Holidays", icon: CalendarPlus, iconColorClass: 'bg-icon-upcoming' },
  { href: "/dashboard/hr/attendance/reports", label: "Attendance Reports", icon: BarChart3, iconColorClass: 'bg-icon-reports' },
  { href: "/dashboard/hr/notice", label: "Manage Notice Board", icon: Bell, iconColorClass: 'bg-icon-notifications' },
  { href: "/dashboard/hr/send-whatsapp", label: "Send WhatsApp", icon: Smartphone, iconColorClass: 'bg-icon-list' },
  { href: "/dashboard/hr/send-email", label: "Send Email", icon: Mail, iconColorClass: 'bg-icon-list' },
  { href: "/dashboard/hr/notifications", label: "Push Notifications", icon: Send, iconColorClass: 'bg-icon-notifications' },
  { href: "/dashboard/hr/device-change-requests", label: "Device Change Requests", icon: Smartphone, iconColorClass: 'bg-icon-list' },
  { href: "/dashboard/hr/claim", label: "Claim Management", icon: FileSpreadsheet, iconColorClass: 'bg-icon-list' },
  { href: "/dashboard/hr/assets", label: "Assets Management", icon: Package, iconColorClass: 'bg-icon-list' },
  { href: "/dashboard/hr/feedback-complaint", label: "Feedback & Complain", icon: MessageSquareText, iconColorClass: 'bg-icon-list' },
  { href: '/dashboard/hr/settings', label: 'HRM Settings', icon: Settings, iconColorClass: 'bg-icon-settings' },
];

const settingsNavItems: NavItem[] = [
  { href: '/dashboard/settings/company-setup', label: 'Company Setup', icon: Building, iconColorClass: 'bg-icon-company' },
  { href: '/dashboard/settings/users', label: 'User Management', icon: UsersIcon, iconColorClass: 'bg-icon-users' },

  { href: '/dashboard/settings/user-activities', label: 'User Activities', icon: History, iconColorClass: 'bg-icon-logs' },
  { href: '/dashboard/settings/smtp-settings', label: 'SMTP Setting', icon: Settings, iconColorClass: 'bg-icon-settings' },
  { href: "/dashboard/settings/whatsapp-templates", label: "WhatsApp Templates", icon: MessageSquareText, iconColorClass: 'bg-icon-list' },
  { href: "/dashboard/settings/telegram-templates", label: "Telegram Templates", icon: FileCode, iconColorClass: 'bg-icon-list' },
  { href: '/dashboard/settings/email-templates', label: 'Email Template', icon: FileText, iconColorClass: 'bg-icon-reports' },
  { href: '/dashboard/settings/whatsapp', label: 'WhatsApp Settings', icon: MessageSquare, iconColorClass: 'bg-icon-settings' },
  { href: '/dashboard/settings/telegram', label: 'Telegram Bot Settings', icon: Send, iconColorClass: 'bg-icon-settings' },
  { href: '/dashboard/settings/storage-settings', label: 'Storage Settings', icon: Database, iconColorClass: 'bg-icon-settings' },
  { href: '/dashboard/settings/backup-restore', label: 'Backup & Restore', icon: Database, iconColorClass: 'bg-icon-settings' },
  { href: '/mobile/dashboard', label: 'Mobile Mode', icon: Smartphone, iconColorClass: 'bg-icon-dashboard' },
];

// Define Group Structure
const allNavGroups: (NavItemGroup & { subLinks: NavItem[] })[] = [
  { groupLabel: "T/T OR L/C Management", icon: FileText, iconColorClass: 'bg-icon-lc', subLinks: lcManagementNavItems, allowedRoles: ["Super Admin", "Admin", "Viewer", "Commercial"] },
  { groupLabel: "Quotations and Invoices", icon: DollarSign, iconColorClass: 'bg-icon-financial', subLinks: financialNavItems, allowedRoles: ["Super Admin", "Admin", "Viewer", "Commercial", "Accounts"] },
  { groupLabel: "Accounts and Inventory", icon: Package, iconColorClass: 'bg-icon-list', subLinks: inventoryNavItems, allowedRoles: ["Super Admin", "Admin", "Accounts", "Viewer"] },
  { groupLabel: "Commiss. Management", icon: Briefcase, iconColorClass: 'bg-icon-list', subLinks: commissionManagementNavItems, allowedRoles: ["Super Admin", "Admin", "Viewer", "Commercial"] },
  { groupLabel: "HRM & Payroll", icon: UsersIcon, iconColorClass: 'bg-icon-users', subLinks: hrNavItems, allowedRoles: ["Super Admin", "Admin", "HR", "Viewer"] },
  { groupLabel: "Suppliers / Applicants", icon: UsersIcon, iconColorClass: 'bg-icon-users', subLinks: partiesNavItems, allowedRoles: ["Super Admin", "Admin", "Viewer", "Commercial", "Accounts", "Service", "DemoManager", "Supervisor"] },
  { groupLabel: 'Demo M/C Management', icon: Laptop, iconColorClass: 'bg-icon-dashboard', subLinks: demoNavItems, allowedRoles: ["Super Admin", "Admin", "DemoManager", "Viewer", "Commercial"] },
  { groupLabel: 'Warranty Management', icon: ShieldCheck, iconColorClass: 'bg-icon-warranty', subLinks: serviceNavItems, allowedRoles: ["Super Admin", "Admin", "Service", "Viewer", "Commercial", "Supervisor"] },
  { groupLabel: 'Project Management', icon: Briefcase, iconColorClass: 'bg-icon-project', subLinks: projectManagementNavItems, allowedRoles: ["Super Admin", "Admin", "Service", "Viewer", "Commercial", "Employee", "Supervisor"] },
  { groupLabel: 'General Settings', icon: Settings, iconColorClass: 'bg-icon-settings', subLinks: settingsNavItems, allowedRoles: ["Super Admin", "Admin", "Viewer"] },
];

export function AppSidebarNavContent() {
  const pathname = usePathname();
  const { user, userRole, logout, loading: authLoading, companyName, companyLogoUrl, hideCompanyLogo, hideCompanyName } = useAuth();
  const sidebar = useSidebar();

  const companyLogoUrlFromSettings = companyLogoUrl || "/icons/icon-192x192.png";
  const displayCompanyNameFromSettings = companyName || "LCMS";

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === href;
    return pathname.startsWith(href) && (pathname === href || pathname.charAt(href.length) === '/');
  };

  const [openAccordions, setOpenAccordions] = React.useState<string[]>([]);

  const filteredNavGroups = React.useMemo(() => {
    if (!userRole) return [];
    return allNavGroups
      .filter(group =>
        group.allowedRoles.some(allowedRole => userRole.includes(allowedRole))
      )
      .map(group => ({
        ...group,
        subLinks: group.subLinks.filter(sub =>
          !sub.allowedRoles || sub.allowedRoles.some(role => userRole.includes(role))
        )
      }));
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

  const canViewDashboard = userRole && !userRole.includes('DemoManager') && !userRole.includes('Accounts') && !userRole.includes('Service') && !userRole.includes('Supervisor');

  return (
    <>
      <SidebarHeader className="border-b sticky top-0 bg-sidebar z-50 h-16 p-0">
        <div className="flex items-center justify-between h-full px-4 gap-2">
          {user && ( // Only show the link and logo if a user is logged in
            <Link href="/dashboard" className="flex items-center gap-2 min-w-0 flex-1">
              {!hideCompanyLogo && (
                <Image
                  src={companyLogoUrlFromSettings}
                  alt="Company Logo"
                  width={32}
                  height={32}
                  className="rounded-sm object-contain flex-shrink-0"
                  priority
                  data-ai-hint="company logo"
                />
              )}
              <span
                className={cn(
                  "font-black text-base group-data-[collapsible=icon]:hidden tracking-tight text-gradient-premium whitespace-nowrap truncate",
                  "hover:tracking-normal transition-all duration-300 ease-in-out"
                )}
              >
                {displayCompanyNameFromSettings}
              </span>
            </Link>
          )}
          {!sidebar.isMobile && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex-shrink-0"
              onClick={sidebar.toggleSidebar}
              aria-label={sidebar.state === 'expanded' ? "Collapse Sidebar" : "Expand Sidebar"}
            >
              {sidebar.state === 'expanded' ? <PanelLeft className="h-5 w-5" /> : <PanelRight className="h-5 w-5" />}
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
                  <SidebarMenuButton asChild isActive={isActive(subLink.href)} className={cn(isActive(subLink.href) && "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90 hover:text-sidebar-primary-foreground")} tooltip={{ children: subLink.label!, side: "right", className: "ml-2" }}>
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
                          openAccordions.includes(group.groupLabel) && 'bg-blue-600/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 font-bold'
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
                              isActive(subLink.href) && "bg-blue-600 text-white shadow-lg shadow-blue-600/20 font-bold",
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
      <SidebarFooter className="mt-auto border-t p-0 h-14 flex items-center justify-between">
        <div className="flex items-center justify-between w-full h-full px-4">
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
        </div>
      </SidebarFooter>
    </>
  );
}

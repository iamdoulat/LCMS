
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
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  LayoutDashboard,
  ListChecks,
  Ship,
  CalendarClock,
  PanelLeftClose,
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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import Image from 'next/image';
import type { UserRole } from '@/types';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";


interface NavItem {
  href: string;
  label: string;
  icon?: React.ElementType;
  iconColorClass?: string;
  disabled?: boolean;
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
    { href: '/dashboard/shipments/upcoming-lc-shipment-dates', label: 'Upcoming Shipments', icon: CalendarClock, iconColorClass: 'bg-icon-upcoming' },
    { href: '/dashboard/shipments/shipment-on-the-way', label: 'Shipment Done', icon: PackageCheck, iconColorClass: 'bg-icon-shipment-done' },
    { href: '/dashboard/shipments/lc-payment-pending', label: 'Payment Pending', icon: DollarSign, iconColorClass: 'bg-icon-payment-pending' },
    { href: '/dashboard/shipments/lc-payment-done', label: 'L/C Payment Done', icon: DollarSign, iconColorClass: 'bg-icon-payment-done' },
    { href: '/dashboard/google-sheets', label: 'Google Sheets', icon: Sheet, iconColorClass: 'bg-icon-sheets' },
    { href: '/dashboard/google-drive', label: 'Google Drive', icon: FolderOpen, iconColorClass: 'bg-icon-drive' },
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
];

const hrNavItems: NavItem[] = [
  { href: '/dashboard/hr/employees', label: 'Employee List', icon: UsersIcon, iconColorClass: 'bg-icon-users' },
  { href: '/dashboard/hr/payroll/salary-generation', label: 'Salary Generation', icon: Calculator, iconColorClass: 'bg-icon-payment' },
  { href: '/dashboard/hr/payroll/payslip-list', label: 'Payslip List', icon: ListChecks, iconColorClass: 'bg-icon-list' },
  { href: "/dashboard/hr/attendance", label: "Attendance", icon: Calendar, disabled: false, iconColorClass: 'bg-icon-reports' },
  { href: "/dashboard/hr/leaves", label: "Leave Management", icon: Mailbox, disabled: false, iconColorClass: 'bg-icon-list' },
  { href: '/dashboard/hr/settings', label: 'HRM And Payroll Settings', icon: Settings, iconColorClass: 'bg-icon-settings' },
];

const settingsNavItems: NavItem[] = [
    { href: '/dashboard/settings/manage-notices', label: 'Manage Notices', icon: Bell, iconColorClass: 'bg-icon-notifications' },
    { href: '/dashboard/settings/company-setup', label: 'Company Setup', icon: Building, iconColorClass: 'bg-icon-company' },
    { href: '/dashboard/settings/users', label: 'User Management', icon: UsersIcon, iconColorClass: 'bg-icon-users' },
    { href: '/dashboard/settings/user-activities', label: 'User Activities', icon: History, iconColorClass: 'bg-icon-logs' },
    { href: '/dashboard/financial-management/invoicing-sales/setting', label: 'Invoice Header Settings', icon: LayoutGrid, iconColorClass: 'bg-icon-settings' },
];

// Define Group Structure
const allNavGroups: (NavItemGroup & { subLinks: NavItem[] })[] = [
  { groupLabel: "T/T OR L/C Management", icon: FileText, iconColorClass: 'bg-icon-lc', subLinks: lcManagementNavItems, allowedRoles: ["Super Admin", "Admin", "Viewer", "Commercial"] },
  { groupLabel: "Quotations and Invoices", icon: DollarSign, iconColorClass: 'bg-icon-financial', subLinks: financialNavItems, allowedRoles: ["Super Admin", "Admin", "Viewer", "Commercial", "Accounts"] },
  { groupLabel: "Accounts and Inventory", icon: Package, iconColorClass: 'bg-icon-list', subLinks: inventoryNavItems, allowedRoles: ["Super Admin", "Admin", "Accounts", "Viewer"] },
  { groupLabel: "Commiss. Management", icon: Briefcase, iconColorClass: 'bg-icon-list', subLinks: commissionManagementNavItems, allowedRoles: ["Super Admin", "Admin", "Viewer", "Commercial"] },
  { groupLabel: "HRM And Payroll", icon: UsersIcon, iconColorClass: 'bg-icon-users', subLinks: hrNavItems, allowedRoles: ["Super Admin", "Admin"] },
  { groupLabel: "Suppliers / Applicants", icon: UsersIcon, iconColorClass: 'bg-icon-users', subLinks: partiesNavItems, allowedRoles: ["Super Admin", "Admin", "Viewer", "Commercial", "Accounts", "Service", "DemoManager"] },
  { groupLabel: 'Demo M/C Management', icon: Laptop, iconColorClass: 'bg-icon-dashboard', subLinks: demoNavItems, allowedRoles: ["Super Admin", "Admin", "DemoManager", "Viewer", "Commercial"] },
  { groupLabel: 'Warranty Management', icon: ShieldCheck, iconColorClass: 'bg-icon-warranty', subLinks: serviceNavItems, allowedRoles: ["Super Admin", "Admin", "Service", "Viewer", "Commercial"] },
  { groupLabel: 'General Settings', icon: Settings, iconColorClass: 'bg-icon-settings', subLinks: settingsNavItems, allowedRoles: ["Super Admin", "Admin", "Viewer"] },
];

export function AppSidebarNav() {
  const pathname = usePathname();
  const { logout, userRole, loading: authLoading, companyName, companyLogoUrl } = useAuth();
  
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
    }
  }, [pathname, filteredNavGroups]);

  return (
    <>
      <SidebarHeader className="flex h-16 items-center justify-between gap-2 border-b p-2">
        <div className="flex items-center gap-2">
            <Link href="/dashboard" className="flex items-center gap-2">
            <Avatar className="h-8 w-8">
                <AvatarImage src={companyLogoUrlFromSettings} alt={displayCompanyNameFromSettings} data-ai-hint="logo company"/>
                <AvatarFallback>SS</AvatarFallback>
            </Avatar>
             <SidebarTrigger
                className="h-7 w-7 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground group-data-[collapsible=expanded]:hidden"
                aria-label="Collapse Sidebar"
              />
            </Link>
        </div>
      </SidebarHeader>

      <SidebarContent className="p-0">
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
          <Accordion type="multiple" value={openAccordions} onValueChange={setOpenAccordions} className="w-full">
            {filteredNavGroups.map((group) => {
              const IconComponent = group.icon;
              return (
                <AccordionItem value={group.groupLabel} key={group.groupLabel} className="border-none">
                  <Popover>
                    <PopoverTrigger asChild>
                      <AccordionTrigger
                        className={cn(
                          "flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-none ring-sidebar-ring transition-all hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 group-has-[[data-sidebar=menu-action]]/menu-item:pr-8 aria-disabled:pointer-events-none aria-disabled:opacity-50",
                          "hover:no-underline justify-start group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:p-2",
                          "[&>svg.lucide-chevron-down]:group-data-[collapsible=icon]:hidden",
                           openAccordions.includes(group.groupLabel) && 'bg-sidebar-accent text-sidebar-accent-foreground'
                        )}
                      >
                        <span className="flex items-center gap-2">
                           <div className={cn("flex h-6 w-6 items-center justify-center rounded-md", group.iconColorClass || "bg-gray-200 text-gray-700")}>
                            <IconComponent className="h-4 w-4" />
                           </div>
                          <span className="group-data-[collapsible=icon]:hidden">{group.groupLabel}</span>
                        </span>
                      </AccordionTrigger>
                    </PopoverTrigger>
                    <PopoverContent side="right" align="start" className="ml-1 p-1 w-auto group-data-[collapsible=expanded]:hidden">
                      <SidebarMenu className="gap-0">
                          <p className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">{group.groupLabel}</p>
                          {group.subLinks.map((subLink) => (
                            <SidebarMenuItem key={subLink.href}>
                              <Link href={subLink.href} passHref>
                                <SidebarMenuButton asChild isActive={isActive(subLink.href)} className="h-8 text-xs" disabled={subLink.disabled}>
                                    <span className="flex items-center gap-2">
                                      {subLink.icon && (
                                        <div className={cn("flex h-5 w-5 items-center justify-center rounded-md text-sidebar-primary-foreground", subLink.iconColorClass)}>
                                            <subLink.icon className="h-3 w-3" />
                                        </div>
                                      )}
                                      <span className="">{subLink.label}</span>
                                    </span>
                                </SidebarMenuButton>
                              </Link>
                            </SidebarMenuItem>
                          ))}
                        </SidebarMenu>
                    </PopoverContent>
                  </Popover>

                  <AccordionContent className="pt-0 pb-0 pl-6 pr-2 group-data-[collapsible=icon]:hidden overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
                    <SidebarMenu className="gap-0 py-1">
                      {group.subLinks.map((subLink) => (
                          <SidebarMenuItem key={subLink.href}>
                            <Link href={subLink.href} passHref>
                              <SidebarMenuButton
                                asChild
                                isActive={isActive(subLink.href)}
                                disabled={subLink.disabled}
                                className={cn(
                                  isActive(subLink.href) && "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90 hover:text-sidebar-primary-foreground",
                                  "h-8 text-xs"
                                )}
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

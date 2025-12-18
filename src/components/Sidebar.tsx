"use client";

import React, { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Separator } from "@/components/ui/separator"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from '@/context/AuthContext';
import {
  BarChart3,
  Bell,
  Building2,
  Calendar,
  Layers,
  CheckCircle2,
  ChevronsRight,
  ClipboardList,
  Component,
  Contact2,
  ContactRound,
  CopyCheck,
  CreditCard,
  DollarSign,
  Factory,
  File,
  FilePlus,
  Files,
  GaugeCircle,
  Gamepad2,
  GitCompareArrows,
  Headphones,
  HelpCircle,
  Home,
  Image,
  Inbox,
  LayoutPanelLeft,
  ListChecks,
  LucideIcon,
  Mailbox,
  MessageCircleQuestion,
  Network,
  Package,
  PercentCircle,
  Pilcrow,
  PlusCircle,
  Presentation,
  Receipt,
  Scale,
  Settings,
  ShoppingBag,
  ShoppingCart,
  Store,
  Ticket,
  Truck,
  User2,
  UserCheck,
  UserCog2,
  Users,
  Users2,
  Wallet,
  Workflow,
} from "lucide-react"
import Link from 'next/link';
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ThemeToggleButton } from "@/components/ui/ThemeToggleButton";
import { cn } from '@/lib/utils';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase/config';
import { useRouter } from 'next/navigation';
import Swal from 'sweetalert2';

interface NavItem {
  title: string
  href?: string
  icon?: LucideIcon
  description?: string
  disabled?: boolean
  external?: boolean
  label?: string
}

interface NavSection {
  title?: string
  items: NavItem[]
}

export const dashboardConfig = {
  mainNav: [
    {
      title: "Home",
      href: "/dashboard",
    },
  ],
  sidebarNav: [
    {
      title: "General",
      items: [
        {
          title: "Dashboard",
          href: "/dashboard",
          icon: Home,
          description: "Your central control panel.",
        },
        {
          title: "Company Profile",
          href: "/dashboard/company-profile",
          icon: Building2,
          description: "Manage your company details.",
        },
        {
          title: "Notice Board",
          href: "/dashboard/notice-board",
          icon: ClipboardList,
          description: "Post important announcements.",
        },
      ],
    },
    {
      title: "CRM",
      items: [
        {
          title: "Customers",
          href: "/dashboard/customers",
          icon: Users,
          description: "Manage customer records.",
        },
        {
          title: "Suppliers",
          href: "/dashboard/suppliers",
          icon: Factory,
          description: "Manage supplier information.",
        },
        {
          title: "Claim Report",
          href: "/dashboard/claim-reports",
          icon: GitCompareArrows,
          description: "Track and manage claim reports.",
        },
      ],
    },
    {
      title: "Sales",
      items: [
        {
          title: "Quotes",
          href: "/dashboard/quotes",
          icon: PercentCircle,
          description: "Manage and track quotes.",
        },
        {
          title: "Invoices",
          href: "/dashboard/invoices",
          icon: Receipt,
          description: "Create and track invoices.",
        },
        {
          title: "Sales Invoice",
          href: "/dashboard/sales-invoices",
          icon: CreditCard,
          description: "Manage sales transactions.",
        },
        {
          title: "Orders",
          href: "/dashboard/orders",
          icon: ShoppingCart,
          description: "Track customer orders.",
        },
        {
          title: "Items",
          href: "/dashboard/items",
          icon: Package,
          description: "Manage inventory items.",
        },
      ],
    },
    {
      title: "Petty Cash",
      items: [
        {
          title: "Petty Cash Accounts",
          href: "/dashboard/petty-cash/accounts",
          icon: Wallet,
          description: "Manage your cash accounts.",
        },
        {
          title: "Petty Cash Categories",
          href: "/dashboard/petty-cash/categories",
          icon: Layers,
          description: "Categorize your cash transactions.",
        },
        {
          title: "Petty Cash Transactions",
          href: "/dashboard/petty-cash/transactions",
          icon: DollarSign,
          description: "Record and track all cash transactions.",
        },
      ],
    },
    {
      title: "Production",
      items: [
        {
          title: "Proforma Invoices",
          href: "/dashboard/proforma-invoices",
          icon: FilePlus,
          description: "Manage proforma invoices.",
        },
        {
          title: "L/C Entries",
          href: "/dashboard/lc-entries",
          icon: Files,
          description: "Track L/C entries.",
        },
        {
          title: "Installation Reports",
          href: "/dashboard/installation-reports",
          icon: CheckCircle2,
          description: "Manage installation reports.",
        },
      ],
    },
    {
      title: "Demo Machines",
      items: [
        {
          title: "Demo Machine Factories",
          href: "/dashboard/demo-machine-factories",
          icon: Factory,
          description: "Manage demo machine factories.",
        },
        {
          title: "Demo Machines",
          href: "/dashboard/demo-machines",
          icon: Gamepad2,
          description: "List and manage demo machines.",
        },
        {
          title: "Demo Machine Applications",
          href: "/dashboard/demo-machine-applications",
          icon: Component,
          description: "Track demo machine applications.",
        },
      ],
    },
    {
      title: "HR & Payroll Management",
      items: [
        {
          title: "Employees",
          href: "/dashboard/hr/employees",
          icon: Users2,
          description: "Manage employee information.",
        },
        {
          title: "Attendance Reconciliation",
          href: "/dashboard/hr/attendance-reconciliation",
          icon: UserCheck,
          description: "Review attendance corrections.",
        },
        {
          title: "Payroll",
          href: "#",
          icon: DollarSign,
          description: "Manage payroll transactions.",
          disabled: true,
        },
        {
          title: "Attendance",
          href: "#",
          icon: Calendar,
          description: "Track employee attendance.",
          disabled: true,
        },
        {
          title: "Leaves",
          href: "#",
          icon: Mailbox,
          description: "Manage employee leave requests.",
          disabled: true,
        },
      ],
    },
    {
      title: "Delivery",
      items: [
        {
          title: "Delivery Challans",
          href: "/dashboard/delivery-challans",
          icon: Package,
          description: "Manage delivery challans.",
        },
        {
          title: "Demo Machine Challans",
          href: "/dashboard/demo-machine-challans",
          icon: Truck,
          description: "Manage demo machine challans.",
        },
      ],
    },
    {
      title: "Admin",
      items: [
        {
          title: "User Management",
          href: "/dashboard/users",
          icon: UserCog2,
          description: "Manage user accounts.",
        },
      ],
    },
    {
      title: "Miscellaneous",
      items: [
        {
          title: "Notifications",
          href: "/dashboard/notifications",
          icon: Bell,
          description: "View and manage notifications.",
        },
      ],
    },
  ],
} satisfies {
  mainNav: NavItem[]
  sidebarNav: NavSection[]
}


interface SidebarProps extends React.HTMLAttributes<HTMLElement> { }

const Sidebar = React.forwardRef<HTMLDivElement, SidebarProps>(({ className, ...props }, ref) => {
  const { user, userRole } = useAuth();
  const router = useRouter();
  const isAdmin = userRole?.includes('Admin') || userRole?.includes('Super Admin');

  const signOutHandler = async () => {
    try {
      await signOut(auth);
      router.push('/login');
      Swal.fire({
        title: "Signed out successfully.",
        icon: "success",
        timer: 1500,
        showConfirmButton: false,
      });
    } catch (error: any) {
      Swal.fire({
        title: "Error signing out.",
        text: error.message,
        icon: "error",
      });
    }
  };

  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className='hidden lg:block'>
      <div className={cn("flex flex-col space-y-6 w-[280px] border-r bg-secondary/50 dark:bg-secondary/50 py-4 min-h-screen fixed", className)} ref={ref} {...props}>
        <Link href="/dashboard" className="flex items-center space-x-2 px-4">
          <LayoutPanelLeft className="h-6 w-6 text-primary" />
          <span className="font-bold text-2xl">Smart Solutions</span>
        </Link>

        <div className="flex-1 space-y-1 px-4">
          <Separator />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex h-8 w-full items-center justify-between rounded-md">
                <div className="flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user?.photoURL || undefined} alt={user?.displayName || 'User'} />
                    <AvatarFallback>{user?.displayName?.slice(0, 2).toUpperCase() || 'U'}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium leading-none">{user?.displayName || 'Guest'}</span>
                </div>
                <ChevronsRight className="h-4 w-4 opacity-50 group-hover:opacity-100 transition-opacity" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" forceMount>
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled>
                <span className="mr-2">Role:</span>
                {!userRole ? (
                  <Skeleton className="h-4 w-20" />
                ) : (
                  userRole.join(', ') || 'Guest'
                )}
                <DropdownMenuShortcut>⇧⌘P</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={signOutHandler}>
                Sign Out
                <DropdownMenuShortcut>⇧⌘Q</DropdownMenuShortcut>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Separator />
          {dashboardConfig.sidebarNav.map((section, index) => (
            <div key={index} className="pb-4">
              {section.title && <p className="text-sm font-semibold mt-2 px-2">{section.title}</p>}
              {section.items.map((item) => (
                <TooltipProvider key={item.href}>
                  <Tooltip delayDuration={50}>
                    <TooltipTrigger asChild>
                      <Link
                        href={item.href || '#'}
                        className="group flex w-full items-center space-x-2 rounded-md px-2 py-2 text-sm font-medium hover:underline"
                      >
                        {item.icon && <item.icon className="h-4 w-4 opacity-70 group-hover:opacity-100 transition-opacity" />}
                        <span>{item.title}</span>
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="right" align="center">
                      <p className="w-[220px]">{item.description}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ))}
            </div>
          ))}
          <Separator />
          <div className="mt-auto px-4">
            <ThemeToggleButton />
          </div>
        </div>
      </div>
    </div>
  )
})
Sidebar.displayName = "Sidebar"

export default Sidebar;
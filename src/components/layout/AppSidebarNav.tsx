
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
  ChevronDown // This is likely unused now with ShadCN AccordionTrigger providing its own
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import Image from 'next/image'; // Import next/image

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
    ],
  },
];


const settingsNavItems: NavItem[] = [ 
  { href: '/dashboard/settings/company-setup', label: 'Company Setup', icon: Building },
  { href: '/dashboard/settings/users', label: 'Users', icon: UsersIcon },
  { href: '/dashboard/settings/smtp', label: 'SMTP Settings', icon: Settings },
];

export function AppSidebarNav() {
  const pathname = usePathname();
  const { logout, loading: authLoading } = useAuth();

  // TODO: Fetch company name and logo URL from settings (e.g., Firestore)
  const companyNameFromSettings = "Smart Solution"; // Placeholder
  const companyLogoUrlFromSettings = "https://placehold.co/32x32.png"; // Placeholder logo

  const isActive = (href: string) => {
    if (href === '/dashboard' && pathname === '/dashboard') return true;
    if (href !== '/dashboard' && pathname === href) return true;
     if (
      (href === '/dashboard/suppliers' && pathname.startsWith('/dashboard/suppliers')) ||
      (href === '/dashboard/customers' && pathname.startsWith('/dashboard/customers')) ||
      (href === '/dashboard/settings/company-setup' && pathname.startsWith('/dashboard/settings/company-setup')) ||
      (href === '/dashboard/settings/users' && pathname.startsWith('/dashboard/settings/users')) ||
      (href === '/dashboard/settings/smtp' && pathname.startsWith('/dashboard/settings/smtp')) 
    ) {
      // For exact matches of group parent links, we need to be careful
      // This specific logic might need refinement based on desired active state behavior for parent links
      // For now, if it's a parent link, it's active if the current path is exactly that link
      return pathname === href;
    }
    // Broader check for sub-pages making the parent active, but only if it's not the exact group link
    if (href !== '/dashboard' && pathname.startsWith(href)) {
        // Check if this 'href' is a group path that has an active sub-link
        // This avoids marking a group parent active if a sub-link within another group but starting with same base path is active
        const isPartOfActiveGroup = managementNavItems.some(group => 
            group.subLinks?.some(sub => pathname.startsWith(sub.href) && sub.href !== href) 
        ) || lcManagementNavItems.some(group => 
            group.subLinks?.some(sub => pathname.startsWith(sub.href) && sub.href !== href)
        );

        if (isPartOfActiveGroup) return false; // Don't mark active if a sub-link in a different group is the actual active one
        return true;
    }
    return false;
  };
  
  const isGroupActive = (subLinks: Array<{ href: string }>) => {
    return subLinks.some(sub => pathname.startsWith(sub.href));
  };

  const combinedNavGroups = [...lcManagementNavItems, ...managementNavItems];

  // Determine default open accordions based on current path
  const defaultOpenAccordions = combinedNavGroups
    .filter(item => item.subLinks && isGroupActive(item.subLinks))
    .map(item => item.groupLabel || ''); // Fallback for items without groupLabel (though unlikely with current structure)


  const renderNavGroup = (item: NavItemGroup, index: number) => (
    // This function is primarily for accordion groups
    item.subLinks ? (
      <AccordionItem value={item.groupLabel || `group-${index}`} key={item.groupLabel || `group-${index}`} className="border-none">
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
                <AccordionTrigger
                  className={cn(
                    "flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-none ring-sidebar-ring transition-all hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 group-has-[[data-sidebar=menu-action]]/menu-item:pr-8 aria-disabled:pointer-events-none aria-disabled:opacity-50",
                    "hover:no-underline justify-between group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:p-2",
                    "group-data-[collapsible=icon]:[&>svg.lucide-chevron-down]:hidden", // Hide default chevron in icon mode
                    isGroupActive(item.subLinks) && "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <item.icon className="h-5 w-5" />
                    <span className="group-data-[collapsible=icon]:hidden">{item.groupLabel}</span>
                  </div>
                  {/* Chevron is now part of AccordionTrigger by default in Shadcn */}
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
                      "h-8 text-xs" // Smaller height for sub-menu items
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
    ) : null // Should not happen if item is meant to be a group
  );


  return (
    <>
      <SidebarHeader className="border-b">
        {/* TODO: Fetch company logo and name from settings (e.g., Firestore) and display here */}
        <Link href="/dashboard" className="flex items-center gap-2 text-lg font-semibold text-primary whitespace-nowrap p-2">
          <Image 
            src={companyLogoUrlFromSettings} 
            alt="Company Logo Placeholder" 
            width={32} 
            height={32} 
            className="rounded-sm"
            data-ai-hint="logo company" 
          />
          <span className="group-data-[collapsible=icon]:hidden">{companyNameFromSettings}</span>
        </Link>
      </SidebarHeader>
      <SidebarContent className="p-0">
        {/* Dashboard Link */}
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
        
        {/* L/C Management Section */}
        <SidebarGroup className="p-0">
          <SidebarGroupLabel className="px-4 text-xs font-semibold uppercase text-muted-foreground group-data-[collapsible=icon]:hidden">
            L/C Tools
          </SidebarGroupLabel>
          <Accordion type="multiple" defaultValue={defaultOpenAccordions} className="w-full">
            {lcManagementNavItems.map(renderNavGroup)}
          </Accordion>
        </SidebarGroup>

        <SidebarSeparator />

        {/* Management Section */}
        <SidebarGroup className="p-0">
          <SidebarGroupLabel className="px-4 text-xs font-semibold uppercase text-muted-foreground group-data-[collapsible=icon]:hidden">
            Management
          </SidebarGroupLabel>
          <Accordion type="multiple" defaultValue={defaultOpenAccordions} className="w-full">
            {managementNavItems.map(renderNavGroup)}
          </Accordion>
        </SidebarGroup>

        <SidebarSeparator />

        {/* Settings Section */}
        <SidebarGroup className="p-0">
          <SidebarGroupLabel className="px-4 text-xs font-semibold uppercase text-muted-foreground group-data-[collapsible=icon]:hidden">
            Settings
          </SidebarGroupLabel>
          <SidebarMenu className="gap-0 px-2 py-1"> {/* Wrap settings items in a SidebarMenu */}
            {settingsNavItems.map((item) => (
              item.href && // Ensure item has a href
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

// Helper type for nav items
type NavItem = {
  href?: string;
  label?: string;
  icon: React.ElementType;
};

// Helper type for nav groups
type NavItemGroup = {
  groupLabel?: string;
  icon: React.ElementType; // Icon for the group itself
  subLinks?: Array<{
    href: string;
    label: string;
    icon?: React.ElementType; // Icon for individual sub-links
  }>;
};

    

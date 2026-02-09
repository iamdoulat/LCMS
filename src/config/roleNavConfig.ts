import {
    FileText,
    ListChecks,
    Receipt,
    Laptop,
    ShieldCheck,
    LayoutDashboard,
    Clock,
    User,
    FileCheck,
    Settings,
    Users,
    Package,
    Truck,
    Search,
    Wrench,
    FileWarning,
    List,
    Calendar,
    AlertTriangle,
    Plane,
    LogIn,
    Bell,
    ShoppingCart
} from 'lucide-react';
import { UserRole } from '@/types';

export interface NavItem {
    href: string;
    label: string;
    icon: any;
    pathPrefix: string;
}

export const roleNavConfig: Record<UserRole | 'Default', NavItem[]> = {
    "Super Admin": [
        { href: '/dashboard/total-lc', label: 'LC', icon: FileText, pathPrefix: '/dashboard/total-lc' },
        { href: '/dashboard/quotations/list', label: 'Quote', icon: ListChecks, pathPrefix: '/dashboard/quotations' },
        { href: '/dashboard/pi/list', label: 'Invoices', icon: Receipt, pathPrefix: '/dashboard/pi' },
        { href: '/dashboard/demo/demo-machine-search', label: 'Demo', icon: Laptop, pathPrefix: '/dashboard/demo' },
        { href: '/dashboard/purchase-orders/list', label: 'Purchase', icon: ShoppingCart, pathPrefix: '/dashboard/purchase-orders' },
    ],
    "Admin": [
        { href: '/dashboard/total-lc', label: 'LC', icon: FileText, pathPrefix: '/dashboard/total-lc' },
        { href: '/dashboard/quotations/list', label: 'Quote', icon: ListChecks, pathPrefix: '/dashboard/quotations' },
        { href: '/dashboard/pi/list', label: 'Invoices', icon: Receipt, pathPrefix: '/dashboard/pi' },
        { href: '/dashboard/demo/demo-machine-search', label: 'Demo', icon: Laptop, pathPrefix: '/dashboard/demo' },
        { href: '/dashboard/purchase-orders/list', label: 'Purchase', icon: ShoppingCart, pathPrefix: '/dashboard/purchase-orders' },
    ],
    "HR": [
        { href: '/dashboard/hr/dashboard', label: 'Dashboard', icon: LayoutDashboard, pathPrefix: '/dashboard/hr/dashboard' },
        { href: '/dashboard/hr/attendance', label: 'Atten.', icon: Clock, pathPrefix: '/dashboard/hr/attendance' },
        { href: '/dashboard/account-details', label: 'Profile', icon: User, pathPrefix: '/dashboard/account-details' },
        { href: '/dashboard/hr/attendance-reconciliation', label: 'Recon.', icon: FileCheck, pathPrefix: '/dashboard/hr/attendance-reconciliation' },
        { href: '/dashboard/hr/settings', label: 'HR Settings', icon: Settings, pathPrefix: '/dashboard/hr/settings' },
    ],
    "Commercial": [
        { href: '/dashboard/total-lc', label: 'LC', icon: FileText, pathPrefix: '/dashboard/total-lc' },
        { href: '/dashboard/quotations/list', label: 'Quote', icon: ListChecks, pathPrefix: '/dashboard/quotations' },
        { href: '/dashboard/account-details', label: 'Profile', icon: User, pathPrefix: '/dashboard/account-details' },
        { href: '/dashboard/pi/list', label: 'Invoices', icon: Receipt, pathPrefix: '/dashboard/pi' },
        { href: '/dashboard/customers', label: 'Applicants', icon: Users, pathPrefix: '/dashboard/customers' },
    ],
    "Accounts": [
        { href: '/dashboard/petty-cash/dashboard', label: 'Dashboard', icon: LayoutDashboard, pathPrefix: '/dashboard/petty-cash/dashboard' },
        { href: '/dashboard/inventory/items/list', label: 'Stock', icon: Package, pathPrefix: '/dashboard/inventory/items' },
        { href: '/dashboard/account-details', label: 'Profile', icon: User, pathPrefix: '/dashboard/account-details' },
        { href: '/dashboard/inventory/sales-invoices', label: 'Sales', icon: Receipt, pathPrefix: '/dashboard/inventory/sales-invoices' },
        { href: '/dashboard/inventory/delivery-challan', label: 'Challans', icon: Truck, pathPrefix: '/dashboard/inventory/delivery-challan' },
    ],
    "Service": [
        { href: '/dashboard/warranty-management/search', label: 'Search', icon: Search, pathPrefix: '/dashboard/warranty-management/search' },
        { href: '/dashboard/warranty-management/installation-reports-view', label: 'Installation', icon: Wrench, pathPrefix: '/dashboard/warranty-management/installation-reports-view' },
        { href: '/dashboard/account-details', label: 'Profile', icon: User, pathPrefix: '/dashboard/account-details' },
        { href: '/dashboard/warranty-management/machine-under-warranty', label: 'Warranty', icon: ShieldCheck, pathPrefix: '/dashboard/warranty-management/machine-under-warranty' },
        { href: '/dashboard/warranty-management/claim-report-list', label: 'Claim', icon: FileWarning, pathPrefix: '/dashboard/warranty-management/claim-report-list' },
    ],
    "DemoManager": [
        { href: '/dashboard/demo/demo-machine-search', label: 'Search', icon: Search, pathPrefix: '/dashboard/demo/demo-machine-search' },
        { href: '/dashboard/demo/demo-machine-list', label: 'List', icon: List, pathPrefix: '/dashboard/demo/demo-machine-list' },
        { href: '/dashboard/account-details', label: 'Profile', icon: User, pathPrefix: '/dashboard/account-details' },
        { href: '/dashboard/demo/demo-machine-program', label: 'Program', icon: Calendar, pathPrefix: '/dashboard/demo/demo-machine-program' },
        { href: '/dashboard/demo/demo-mc-date-overdue', label: 'Overdue', icon: AlertTriangle, pathPrefix: '/dashboard/demo/demo-mc-date-overdue' },
    ],
    "User": [
        { href: '/dashboard/hr/attendance-reconciliation?myRecords=true', label: 'Attendance', icon: Clock, pathPrefix: '/dashboard/hr/attendance-reconciliation' },
        { href: '/dashboard/hr/leaves?myRecords=true', label: 'Leave', icon: Plane, pathPrefix: '/dashboard/hr/leaves' },
        { href: '/dashboard/account-details', label: 'Profile', icon: User, pathPrefix: '/dashboard/account-details' },
        { href: '/dashboard/hr/multiple-check-in-out?myRecords=true', label: 'Check In/Out', icon: LogIn, pathPrefix: '/dashboard/hr/multiple-check-in-out' },
        { href: '/dashboard/account-details', label: 'Notice', icon: Bell, pathPrefix: '' }, // Notice points to account details as per request, ensuring no prefix clash
    ],
    "Employee": [
        { href: '/dashboard/hr/attendance-reconciliation?myRecords=true', label: 'Attendance', icon: Clock, pathPrefix: '/dashboard/hr/attendance-reconciliation' },
        { href: '/dashboard/hr/leaves?myRecords=true', label: 'Leave', icon: Plane, pathPrefix: '/dashboard/hr/leaves' },
        { href: '/dashboard/account-details', label: 'Profile', icon: User, pathPrefix: '/dashboard/account-details' },
        { href: '/dashboard/hr/multiple-check-in-out?myRecords=true', label: 'Check In/Out', icon: LogIn, pathPrefix: '/dashboard/hr/multiple-check-in-out' },
        { href: '/dashboard/account-details', label: 'Notice', icon: Bell, pathPrefix: '' },
    ],
    "Supervisor": [
        { href: '/dashboard/hr/attendance-reconciliation?myRecords=true', label: 'Attendance', icon: Clock, pathPrefix: '/dashboard/hr/attendance-reconciliation' },
        { href: '/dashboard/hr/leaves?myRecords=true', label: 'Leave', icon: Plane, pathPrefix: '/dashboard/hr/leaves' },
        { href: '/dashboard/account-details', label: 'Profile', icon: User, pathPrefix: '/dashboard/account-details' },
        { href: '/dashboard/hr/multiple-check-in-out?myRecords=true', label: 'Check In/Out', icon: LogIn, pathPrefix: '/dashboard/hr/multiple-check-in-out' },
        { href: '/dashboard/account-details', label: 'Notice', icon: Bell, pathPrefix: '' },
    ],
    "Viewer": [
        { href: '/dashboard/total-lc', label: 'LC', icon: FileText, pathPrefix: '/dashboard/total-lc' },
        { href: '/dashboard/quotations/list', label: 'Quote', icon: ListChecks, pathPrefix: '/dashboard/quotations' },
        { href: '/dashboard/pi/list', label: 'Invoices', icon: Receipt, pathPrefix: '/dashboard/pi' },
        { href: '/dashboard/demo/demo-machine-search', label: 'Demo', icon: Laptop, pathPrefix: '/dashboard/demo' },
        { href: '/dashboard/warranty-management/machine-under-warranty', label: 'Warranty', icon: ShieldCheck, pathPrefix: '/dashboard/warranty-management/machine-under-warranty' },
    ],
    "Default": [
        // Fallback if role is not found or matches none of the above
        { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, pathPrefix: '/dashboard' },
    ]
};

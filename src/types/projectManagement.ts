import { Timestamp } from 'firebase/firestore';

export type ProjectStatus =
    | 'Default'
    | 'Deferred'
    | 'Pending'
    | 'In Progress'
    | 'On Hold'
    | 'Completed'
    | 'Delayed'
    | 'Pending Approval'
    | 'Archived';

export type ProjectPriority = 'Low' | 'Medium' | 'High' | 'Urgency';

export interface ProjectAttendee {
    id: string;
    name: string;
    photoURL?: string;
    employeeCode?: string;
}

export interface Project {
    id: string;
    projectTitle: string;
    projectId: string; // Custom ID like PRJ-001
    clientName: string;
    clientId?: string;
    status: ProjectStatus;
    priority: ProjectPriority;
    assignedUsers: ProjectAttendee[];
    startDate: string; // ISO String
    endDate?: string; // ISO String
    description?: string;
    tags?: string[];
    budget?: number;
    taskAccessibility?: 'Assigned Users' | 'Project Users';
    clientCanDiscuss?: boolean;
    tasksTimeEntries?: boolean;
    department?: 'HR' | 'Accounts' | 'Service';
    invoiceNumber?: string;
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

export interface Task {
    id: string; // Firestore ID
    taskId: string; // Custom ID (e.g., T-1001)
    projectId: string;
    projectTitle: string;
    taskTitle: string;
    description?: string;
    status: 'Pending' | 'In Progress' | 'On Hold' | 'Completed' | 'Rejected';
    priority: ProjectPriority;
    assignedUsers: ProjectAttendee[];
    assignedUserIds?: string[]; // IDs of assigned users for easier querying/rules
    acceptanceStatuses?: Record<string, 'Pending' | 'Accepted' | 'Rejected'>; // Track per-user acceptance
    attachments?: { name: string; url: string; type: string }[];
    dueDate?: string; // ISO String (box "Ends At")
    startDate?: string; // ISO String
    clientCanDiscuss?: boolean;
    billingType?: 'None' | 'Billable' | 'Non-Billable';
    completionPercentage?: number; // 0-100
    enableReminder?: boolean;
    enableRecurring?: boolean;
    createdAt: Timestamp;
    updatedAt: Timestamp;
    createdByUid?: string;
    createdByName?: string;
}

export interface Quotation {
    id: string;
    quotationNo: string;
    projectId: string;
    projectTitle: string;
    clientId: string;
    clientName: string;
    amount: number;
    status: 'Draft' | 'Sent' | 'Accepted' | 'Rejected';
    date: string; // ISO String
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

export interface Invoice {
    id: string;
    invoiceNo: string;
    projectId: string;
    projectTitle: string;
    clientId: string;
    clientName: string;
    amount: number;
    paymentStatus: 'Unpaid' | 'Partial' | 'Paid' | 'Overdue';
    dueDate: string; // ISO String
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

export interface ProjectSettings {
    id: string; // Typically 'global'
    statuses: {
        name: ProjectStatus;
        color: string;
        isActive: boolean;
    }[];
    priorities: {
        name: ProjectPriority;
        color: string;
    }[];
    companyDetails: {
        companyName: string;
        address: string;
        email: string;
        mobileNo: string;
        logoUrl?: string;
        logoWidth?: number;
        logoHeight?: number;
        invoiceName: string;
        quotationName: string;
    };
    tags?: string[];
    updatedAt: Timestamp;
}

export interface RecentActivity {
    id: string;
    type: 'project' | 'task' | 'quotation' | 'invoice';
    action: string;
    message: string;
    userId: string;
    userName: string;
    timestamp: Timestamp;
}

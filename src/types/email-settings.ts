
export interface SmtpConfiguration {
    id?: string;
    name: string;
    serviceProvider: 'smtp' | 'resend_api';
    host?: string;
    port?: number;
    user?: string;
    pass?: string;
    fromEmail: string;
    resendApiKey?: string;
    isActive: boolean;
    createdAt?: any; // Firestore Timestamp
    updatedAt?: any; // Firestore Timestamp
}

export interface EmailTemplate {
    id?: string;
    slug: string;
    name: string;
    subject: string;
    body: string; // HTML content
    variables: string[];
    isActive?: boolean; // Enable/disable template
    createdAt?: any;
    updatedAt?: any;
}

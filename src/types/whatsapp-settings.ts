export interface WhatsAppGatewayConfig {
    id?: string;
    name: string;
    apiSecret: string;
    accountUniqueId: string;
    isActive: boolean;
    createdAt?: any;
    updatedAt?: any;
}

export interface WhatsAppTemplate {
    id?: string;
    slug: string;
    name: string;
    subject: string;
    body: string; // Plain text content
    variables: string[];
    createdAt?: any;
    updatedAt?: any;
}

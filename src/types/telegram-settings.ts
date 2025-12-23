import { Timestamp } from 'firebase/firestore';

export interface TelegramTemplate {
    id?: string;
    name: string;
    slug: string;
    body: string;
    isActive: boolean;
    createdAt?: Timestamp | any;
    updatedAt?: Timestamp | any;
}

export interface TelegramConfiguration {
    id?: string;
    name: string;
    botToken: string;
    chatId: string;
    isActive: boolean;
    createdAt?: Timestamp | any;
    updatedAt?: Timestamp | any;
}


import { Timestamp } from 'firebase/firestore';

export interface MachineryCatalogue {
    id: string;
    title: string;
    subtitle: string;
    machineModels: string[];
    brand: string;
    category?: string;
    subCategory?: string;
    fileUrl: string; // This will be the Catalogue PDF
    thumbnailUrl?: string;
    insManualsUrl?: string; // New field
    videoUrl?: string; // New field
    createdAt: Timestamp | string;
    updatedAt: Timestamp | string;
}

export interface ErrorCodeRecord {
    id: string;
    errorCode: string;
    machineModel: string;
    brand: string;
    category?: string;
    problem: string;
    solution: string;
    fileUrl?: string; // Optional manual or image
    createdAt: Timestamp | string;
    updatedAt: Timestamp | string;
}

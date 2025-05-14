export interface LCEntry {
  id?: string; // Optional: for existing entries from Firebase
  customerName: string;
  supplierName: string;
  value: number | ''; // Allow empty string for initial form state, parse to number on submit
  termsOfPay: string;
  ttNumber?: string;
  lcNumber: string;
  totalMachineQty: number | ''; // Allow empty string, parse to number
  lcIssueDate?: Date;
  expireDate?: Date;
  latestShipmentDate?: Date;
  finalPIFile?: File | null; // For file object before upload
  shippingDocumentsFile?: File | null; // For file object before upload
  // Store URLs or paths after upload if needed, not directly in this form type
  // finalPIUrl?: string; 
  // shippingDocumentsUrl?: string;
  dhlNumber?: string;
  etd?: string; // Estimated Time of Departure
  eta?: string; // Estimated Time of Arrival
  itemDescriptions?: string; // Extracted by AI
  shippingDocumentForAI?: File | null; // Document to be analyzed by AI
}

// If you need a type for data stored in Firebase (e.g., with file URLs)
export interface LCEntryDocument extends Omit<LCEntry, 'finalPIFile' | 'shippingDocumentsFile' | 'shippingDocumentForAI'> {
  finalPIUrl?: string;
  shippingDocumentsUrl?: string;
  createdAt: Date; // Or Firebase Timestamp
  updatedAt: Date; // Or Firebase Timestamp
}

export interface LCEntry {
  id?: string; // Optional: for existing entries from Firebase
  beneficiaryName: string; // Renamed from customerName
  supplierName: string;
  value: number | ''; // Allow empty string for initial form state, parse to number on submit
  termsOfPay: "TT in Advance" | "LC at sight" | "UPAS" | "Deffered 120days" | "Deffered 180days" | "Deffered 360days" | ""; // Updated to specific options
  ttNumber?: string;
  lcNumber: string;
  totalMachineQty: number | ''; // Allow empty string, parse to number
  lcIssueDate?: Date;
  expireDate?: Date;
  latestShipmentDate?: Date;
  finalPIFile?: File | null; // For file object before upload
  shippingDocumentsFile?: File | null; // For file object before upload
  dhlNumber?: string;
  etd?: string; // Estimated Time of Departure
  eta?: string; // Estimated Time of Arrival
  itemDescriptions?: string; // Extracted by AI
  shippingDocumentForAI?: File | null; // Document to be analyzed by AI
  consigneeBankNameAddress?: string; // New field
  bankBin?: string; // New field - Bank Identification Number
  bankTin?: string; // New field - Taxpayer Identification Number (assumed from TION)
}

// If you need a type for data stored in Firebase (e.g., with file URLs)
export interface LCEntryDocument extends Omit<LCEntry, 'finalPIFile' | 'shippingDocumentsFile' | 'shippingDocumentForAI'> {
  finalPIUrl?: string;
  shippingDocumentsUrl?: string;
  createdAt: Date; // Or Firebase Timestamp
  updatedAt: Date; // Or Firebase Timestamp
}

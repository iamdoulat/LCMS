
export const termsOfPayOptions = [
  "TT in Advance",
  "LC at sight",
  "UPAS",
  "Deffered 120days",
  "Deffered 180days",
  "Deffered 360days",
] as const;
export type TermsOfPay = typeof termsOfPayOptions[number] | "";

export const shipmentModeOptions = ["Sea", "Air"] as const;
export type ShipmentMode = typeof shipmentModeOptions[number] | "";

export const currencyOptions = ["USD", "EURO"] as const;
export type Currency = typeof currencyOptions[number] | "";

export interface LCEntry {
  id?: string; // Optional: for existing entries from Firebase
  beneficiaryName: string; // Data will come from Supplier list
  applicantName: string; // Data will come from Customer list
  currency: Currency;
  amount: number | ''; // Allow empty string for initial form state, parse to number on submit
  termsOfPay: TermsOfPay;
  documentaryCreditNumber: string;
  proformaInvoiceNumber?: string;
  invoiceDate?: Date;
  totalMachineQty: number | ''; // Allow empty string, parse to number
  lcIssueDate?: Date;
  expireDate?: Date;
  latestShipmentDate?: Date;
  finalPIFile?: File | null; // For file object before upload
  shippingDocumentsFile?: File | null; // For file object before upload
  dhlNumber?: string;
  etd?: Date; // Estimated Time of Departure - Changed to Date
  eta?: Date; // Estimated Time of Arrival - Changed to Date
  itemDescriptions?: string; // Extracted by AI
  shippingDocumentForAI?: File | null; // Document to be analyzed by AI
  consigneeBankNameAddress?: string;
  bankBin?: string;
  bankTin?: string;
  shipmentMode?: ShipmentMode;
  vesselOrFlightName?: string;
  partialShipments?: string; // 43P
  portOfLoading?: string; // 44E
  portOfDischarge?: string; // 44F
  documentsRequired?: string; // 46A - main text
  shippingMarks?: string;
  certificateOfOrigin?: string;
  notifyPartyNameAndAddress?: string;
  notifyPartyContactDetails?: string;
  numberOfAmendments?: number | '';
}

// If you need a type for data stored in Firebase (e.g., with file URLs)
export interface LCEntryDocument extends Omit<LCEntry, 'finalPIFile' | 'shippingDocumentsFile' | 'shippingDocumentForAI' | 'etd' | 'eta'> {
  finalPIUrl?: string;
  shippingDocumentsUrl?: string;
  etd?: string | Date; // Store as ISO string or Firestore Timestamp, but allow Date for consistency
  eta?: string | Date; // Store as ISO string or Firestore Timestamp, but allow Date for consistency
  createdAt: Date; // Or Firebase Timestamp
  updatedAt: Date; // Or Firebase Timestamp
  numberOfAmendments?: number;
}

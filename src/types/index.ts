
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
  beneficiaryName: string;
  supplierName: string;
  currency: Currency;
  amount: number | ''; // Allow empty string for initial form state, parse to number on submit
  termsOfPay: TermsOfPay;
  ttNumber?: string;
  documentaryCreditNumber: string; // Renamed from lcNumber
  proformaInvoiceNumber?: string;
  invoiceDate?: Date;
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
  consigneeBankNameAddress?: string;
  bankBin?: string;
  bankTin?: string;
  shipmentMode?: ShipmentMode;
  vesselOrFlightName?: string;
}

// If you need a type for data stored in Firebase (e.g., with file URLs)
export interface LCEntryDocument extends Omit<LCEntry, 'finalPIFile' | 'shippingDocumentsFile' | 'shippingDocumentForAI'> {
  finalPIUrl?: string;
  shippingDocumentsUrl?: string;
  createdAt: Date; // Or Firebase Timestamp
  updatedAt: Date; // Or Firebase Timestamp
}

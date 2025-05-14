
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

export const trackingCourierOptions = ["DHL", "FedEx"] as const;
export type TrackingCourier = typeof trackingCourierOptions[number] | "";


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
  trackingCourier?: TrackingCourier | "";
  trackingNumber?: string;
  etd?: Date; // Estimated Time of Departure
  eta?: Date; // Estimated Time of Arrival
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
export interface LCEntryDocument extends Omit<LCEntry, 'finalPIFile' | 'shippingDocumentsFile' | 'shippingDocumentForAI' | 'etd' | 'eta' | 'trackingCourier'> {
  finalPIUrl?: string;
  shippingDocumentsUrl?: string;
  etd?: string | Date; // Store as ISO string or Firestore Timestamp, but allow Date for consistency
  eta?: string | Date; // Store as ISO string or Firestore Timestamp, but allow Date for consistency
  trackingCourier?: TrackingCourier;
  createdAt: Date; // Or Firebase Timestamp
  updatedAt: Date; // Or Firebase Timestamp
  numberOfAmendments?: number;
}


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

export const lcStatusOptions = ["Draft", "Transmitted", "Shipping going on", "Done"] as const;
export type LCStatus = typeof lcStatusOptions[number];


export interface LCEntry {
  id?: string;
  beneficiaryName: string; 
  applicantName: string; 
  currency: Currency;
  amount: number | ''; 
  termsOfPay: TermsOfPay;
  documentaryCreditNumber: string;
  proformaInvoiceNumber?: string;
  invoiceDate?: Date;
  totalMachineQty: number | ''; 
  lcIssueDate?: Date;
  expireDate?: Date;
  latestShipmentDate?: Date;
  finalPIFile?: File | null; 
  shippingDocumentsFile?: File | null; 
  trackingCourier?: TrackingCourier | "";
  trackingNumber?: string;
  etd?: Date; 
  eta?: Date; 
  itemDescriptions?: string; 
  shippingDocumentForAI?: File | null; 
  consigneeBankNameAddress?: string;
  bankBin?: string;
  bankTin?: string;
  shipmentMode?: ShipmentMode;
  vesselOrFlightName?: string;
  vesselImoNumber?: string; 
  partialShipments?: string; 
  portOfLoading?: string; 
  portOfDischarge?: string; 
  documentsRequired?: string; 
  shippingMarks?: string; 
  certificateOfOrigin?: string;
  notifyPartyNameAndAddress?: string;
  notifyPartyContactDetails?: string;
  numberOfAmendments?: number | '';
  status?: LCStatus; 
}

export interface LCEntryDocument extends Omit<LCEntry, 
  'finalPIFile' | 
  'shippingDocumentsFile' | 
  'shippingDocumentForAI' | 
  'etd' | 
  'eta' | 
  'lcIssueDate' | 
  'expireDate' | 
  'latestShipmentDate' | 
  'invoiceDate' |
  'amount' | 
  'totalMachineQty' | 
  'numberOfAmendments' 
> {
  year: number; 
  amount: number;
  totalMachineQty: number;
  numberOfAmendments?: number;
  finalPIUrl?: string;
  shippingDocumentsUrl?: string;
  etd?: string; 
  eta?: string; 
  lcIssueDate?: string;
  expireDate?: string;
  latestShipmentDate?: string;
  invoiceDate?: string;
  createdAt: string; 
  updatedAt: string; 
  status?: LCStatus;
  id?: string; // Firestore document ID
}

// For Applicant/Customer
export interface Customer {
  id?: string; // Firestore document ID
  applicantName: string; 
  email: string;
  phone?: string;
  address: string;
  contactPerson?: string;
  binNo?: string;
  tinNo?: string;
  newIrcNo?: string;
  oldIrcNo?: string;
  createdAt?: string; // ISO string
  updatedAt?: string; // ISO string
}
export type CustomerDocument = Customer & { id: string }; // Ensure id is present when fetched

// For Beneficiary/Supplier
export interface Supplier {
  id?: string; // Firestore document ID
  beneficiaryName: string;
  headOfficeAddress: string;
  contactPersonName: string;
  cellNumber: string;
  emailId: string;
  website?: string;
  brandName: string;
  brandLogoFile?: File | null; // For file object before upload
  brandLogoUrl?: string; // For URL after upload
  createdAt?: string; // ISO string
  updatedAt?: string; // ISO string
}
export type SupplierDocument = Supplier & { id: string }; // Ensure id is present when fetched

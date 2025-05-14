

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

// Updated LC Status Options
export const lcStatusOptions = ["Draft", "Transmitted", "Shipping pending", "Shipping going on", "Done"] as const;
export type LCStatus = typeof lcStatusOptions[number];


export interface LCEntry {
  id?: string;
  beneficiaryName: string; // Will store ID of supplier
  applicantName: string; // Will store ID of customer
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

// This interface represents the data structure as it would be stored in Firestore
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
  'numberOfAmendments' |
  'beneficiaryName' | // Store actual name
  'applicantName' // Store actual name
> {
  year: number;
  applicantName: string; // Actual name of the applicant for display
  beneficiaryName: string; // Actual name of the beneficiary for display
  applicantId?: string; // ID from customers collection
  beneficiaryId?: string; // ID from suppliers collection
  amount: number; // Stored as number
  totalMachineQty: number; // Stored as number
  numberOfAmendments?: number; // Stored as number
  finalPIUrl?: string; // URL after upload to Firebase Storage
  shippingDocumentsUrl?: string; // URL after upload
  etd?: string; // Stored as ISO string
  eta?: string; // Stored as ISO string
  lcIssueDate?: string; // Stored as ISO string
  expireDate?: string; // Stored as ISO string
  latestShipmentDate?: string; // Stored as ISO string
  invoiceDate?: string; // Stored as ISO string
  createdAt: any; // Firestore serverTimestamp for creation
  updatedAt: any; // Firestore serverTimestamp for updates
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
  createdAt?: any; // Firestore serverTimestamp
  updatedAt?: any; // Firestore serverTimestamp
}
export type CustomerDocument = Customer & { id: string, createdAt: string, updatedAt: string }; // Ensure id and string timestamps when fetched

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
  createdAt?: any; // Firestore serverTimestamp
  updatedAt?: any; // Firestore serverTimestamp
}
export type SupplierDocument = Supplier & { id: string, createdAt: string, updatedAt: string }; // Ensure id and string timestamps when fetched


    

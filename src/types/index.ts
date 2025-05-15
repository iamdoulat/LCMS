
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
  beneficiaryName: string; // In form, this is the ID of the beneficiary from 'suppliers'
  applicantName: string;   // In form, this is the ID of the applicant from 'customers'
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
  finalPIUrl?: string; // Changed from File
  shippingDocumentsUrl?: string; // Changed from File
  trackingCourier?: TrackingCourier | "";
  trackingNumber?: string;
  etd?: Date;
  eta?: Date;
  itemDescriptions?: string;
  shippingDocumentForAI?: File | null; // For AI analysis, remains File
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

// This type represents the data structure in Firestore
export interface LCEntryDocument {
  id: string; // Firestore document ID
  year: number;
  applicantName: string; // Display name of applicant
  beneficiaryName: string; // Display name of beneficiary
  applicantId: string; // ID from 'customers' collection
  beneficiaryId: string; // ID from 'suppliers' collection
  currency: Currency;
  amount: number;
  termsOfPay: TermsOfPay;
  documentaryCreditNumber: string;
  proformaInvoiceNumber?: string;
  invoiceDate?: string; // ISO Date String
  totalMachineQty: number;
  lcIssueDate?: string; // ISO Date String
  expireDate?: string; // ISO Date String
  latestShipmentDate?: string; // ISO Date String
  finalPIUrl?: string;
  shippingDocumentsUrl?: string;
  trackingCourier?: TrackingCourier | "";
  trackingNumber?: string;
  etd?: string; // ISO Date String
  eta?: string; // ISO Date String
  itemDescriptions?: string;
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
  numberOfAmendments?: number;
  status: LCStatus; // Status should be required in Firestore
  createdAt: any; // Firestore Timestamp or ServerTimestamp
  updatedAt: any; // Firestore Timestamp or ServerTimestamp
}

export interface Customer {
  id?: string;
  applicantName: string;
  email: string;
  phone?: string;
  address: string;
  contactPerson?: string;
  binNo?: string;
  tinNo?: string;
  newIrcNo?: string;
  oldIrcNo?: string;
  createdAt?: any;
  updatedAt?: any;
}
export type CustomerDocument = Customer & { id: string, createdAt: string, updatedAt: string };

export interface Supplier {
  id?: string;
  beneficiaryName: string;
  headOfficeAddress: string;
  contactPersonName: string;
  cellNumber: string;
  emailId: string;
  website?: string;
  brandName: string;
  brandLogoFile?: File | null;
  brandLogoUrl?: string;
  createdAt?: any;
  updatedAt?: any;
}
export type SupplierDocument = Supplier & { id: string, createdAt: string, updatedAt: string };


export interface AppNotification {
  id: string;
  title: string;
  message: string;
  timestamp: string; // ISO string
  isRead: boolean;
  link?: string; // Optional link for navigation
}
    

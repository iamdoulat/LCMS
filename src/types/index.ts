


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
  'numberOfAmendments' |
  'beneficiaryName' | 
  'applicantName' 
> {
  year: number;
  applicantName: string; 
  beneficiaryName: string; 
  applicantId?: string; 
  beneficiaryId?: string; 
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
  createdAt: any; 
  updatedAt: any; 
  status?: LCStatus;
  id?: string; 
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
    

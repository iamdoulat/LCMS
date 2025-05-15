
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

export const lcStatusOptions = ["Draft", "Transmitted", "Shipping pending", "Shipping going on", "Done"] as const;
export type LCStatus = typeof lcStatusOptions[number];


export interface LCEntry {
  id?: string;
  beneficiaryName: string; // Represents beneficiaryId in the form for selection
  applicantName: string;   // Represents applicantId in the form for selection
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
  finalPIUrl?: string;
  shippingDocumentsUrl?: string;
  finalLcUrl?: string; // New field
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

// This type represents the data structure in Firestore
export interface LCEntryDocument {
  id: string;
  year: number;
  applicantName: string; // Display name of the applicant
  beneficiaryName: string; // Display name of the beneficiary
  applicantId: string; // Firestore ID of the applicant from 'customers' collection
  beneficiaryId: string; // Firestore ID of the beneficiary from 'suppliers' collection
  currency: Currency;
  amount: number;
  termsOfPay: TermsOfPay;
  documentaryCreditNumber: string;
  proformaInvoiceNumber?: string;
  invoiceDate?: string;
  totalMachineQty: number;
  lcIssueDate?: string;
  expireDate?: string;
  latestShipmentDate?: string;
  finalPIUrl?: string;
  shippingDocumentsUrl?: string;
  finalLcUrl?: string; // New field
  trackingCourier?: TrackingCourier | "";
  trackingNumber?: string;
  etd?: string;
  eta?: string;
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
  status: LCStatus;
  createdAt: any;
  updatedAt: any;
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
export type CustomerDocument = Customer & { id: string, createdAt: any, updatedAt: any };

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
export type SupplierDocument = Supplier & { id: string, createdAt: any, updatedAt: any };


export interface AppNotification {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  isRead: boolean;
  link?: string;
}

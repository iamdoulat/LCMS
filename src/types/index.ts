
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

export const partialShipmentAllowedOptions = ["Yes", "No"] as const;
export type PartialShipmentAllowed = typeof partialShipmentAllowedOptions[number];

export const certificateOfOriginCountries = [
  "JAPAN", "CHINA", "TAIWAN", "SINGAPORE", "VIETNAM", "MALAYSIA", "ITALY", "USA", "THAILAND", "HONG KONG",
] as const;
export type CertificateOfOriginCountry = typeof certificateOfOriginCountries[number];


export interface LCEntry {
  id?: string;
  applicantName: string;   // Stores Applicant ID from customers collection, form stores ID
  beneficiaryName: string; // Stores Beneficiary ID from suppliers collection, form stores ID
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
  finalLcUrl?: string;
  trackingCourier?: TrackingCourier | "";
  trackingNumber?: string;
  etd?: Date;
  eta?: Date;
  itemDescriptions?: string;
  consigneeBankNameAddress?: string;
  bankBin?: string;
  bankTin?: string;
  shipmentMode?: ShipmentMode;
  vesselOrFlightName?: string;
  vesselImoNumber?: string;
  totalPackageQty?: number | '';
  totalNetWeight?: number | '';
  totalGrossWeight?: number | '';
  totalCbm?: number | '';
  partialShipments?: string;
  portOfLoading?: string;
  portOfDischarge?: string;
  shippingMarks?: string;
  certificateOfOrigin?: CertificateOfOriginCountry[];
  notifyPartyNameAndAddress?: string; // Stores address
  notifyPartyName?: string;           // Stores contact person name
  notifyPartyCell?: string;           // Stores cell
  notifyPartyEmail?: string;          // Stores email
  numberOfAmendments?: number | '';
  status?: LCStatus;
  partialShipmentAllowed?: PartialShipmentAllowed;
  firstPartialQty?: number | '';
  secondPartialQty?: number | '';
  thirdPartialQty?: number | '';
  firstPartialAmount?: number | '';
  secondPartialAmount?: number | '';
  thirdPartialAmount?: number | '';
  originalBlQty?: number | '';
  copyBlQty?: number | '';
  originalCooQty?: number | '';
  copyCooQty?: number | '';
  invoiceQty?: number | '';
  packingListQty?: number | '';
  beneficiaryCertificateQty?: number | '';
  brandNewCertificateQty?: number | '';
  beneficiaryWarrantyCertificateQty?: number | '';
  beneficiaryComplianceCertificateQty?: number | '';
  shipmentAdviceQty?: number | '';
}

export interface LCEntryDocument {
  id: string;
  year: number;
  applicantName: string; // Stores the actual name for display
  applicantId: string;   // Stores the ID from the customers collection
  beneficiaryName: string; // Stores the actual name for display
  beneficiaryId: string;   // Stores the ID from the suppliers collection
  currency: Currency;
  amount: number;
  termsOfPay: TermsOfPay;
  documentaryCreditNumber: string;
  proformaInvoiceNumber?: string;
  invoiceDate?: string; // Stored as ISO string
  totalMachineQty: number;
  lcIssueDate?: string; // Stored as ISO string
  expireDate?: string; // Stored as ISO string
  latestShipmentDate?: string; // Stored as ISO string
  finalPIUrl?: string;
  shippingDocumentsUrl?: string;
  finalLcUrl?: string;
  trackingCourier?: TrackingCourier | "";
  trackingNumber?: string;
  etd?: string; // Stored as ISO string
  eta?: string; // Stored as ISO string
  itemDescriptions?: string;
  consigneeBankNameAddress?: string;
  bankBin?: string;
  bankTin?: string;
  shipmentMode?: ShipmentMode;
  vesselOrFlightName?: string;
  vesselImoNumber?: string;
  totalPackageQty?: number;
  totalNetWeight?: number;
  totalGrossWeight?: number;
  totalCbm?: number;
  partialShipments?: string;
  portOfLoading?: string;
  portOfDischarge?: string;
  shippingMarks?: string;
  certificateOfOrigin?: CertificateOfOriginCountry[];
  notifyPartyNameAndAddress?: string; // Stores address
  notifyPartyName?: string;           // Stores contact person name
  notifyPartyCell?: string;           // Stores cell
  notifyPartyEmail?: string;          // Stores email
  numberOfAmendments?: number;
  status: LCStatus;
  createdAt: any; // Firestore ServerTimestamp
  updatedAt: any; // Firestore ServerTimestamp
  partialShipmentAllowed?: PartialShipmentAllowed;
  firstPartialQty?: number;
  secondPartialQty?: number;
  thirdPartialQty?: number;
  firstPartialAmount?: number;
  secondPartialAmount?: number;
  thirdPartialAmount?: number;
  originalBlQty?: number;
  copyBlQty?: number;
  originalCooQty?: number;
  copyCooQty?: number;
  invoiceQty?: number;
  packingListQty?: number;
  beneficiaryCertificateQty?: number;
  brandNewCertificateQty?: number;
  beneficiaryWarrantyCertificateQty?: number;
  beneficiaryComplianceCertificateQty?: number;
  shipmentAdviceQty?: number;
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
  timestamp: string; // ISO string
  isRead: boolean;
  link?: string;
}

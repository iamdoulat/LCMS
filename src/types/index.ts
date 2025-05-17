
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

// Updated lcStatusOptions
export const lcStatusOptions = ["Draft", "Transmitted", "Shipment Pending", "Shipping going on", "Done"] as const;
export type LCStatus = typeof lcStatusOptions[number];

export const partialShipmentAllowedOptions = ["Yes", "No"] as const;
export type PartialShipmentAllowed = typeof partialShipmentAllowedOptions[number];

export const certificateOfOriginCountries = [
  "JAPAN", "CHINA", "TAIWAN", "SINGAPORE", "VIETNAM", "MALAYSIA", "ITALY", "USA", "Thailand", "Hong Kong",
] as const;
export type CertificateOfOriginCountry = typeof certificateOfOriginCountries[number];


export interface LCEntry {
  id?: string;
  applicantId: string; // Firestore ID of the customer
  applicantName: string; // Name of the customer/applicant
  beneficiaryId: string; // Firestore ID of the supplier
  beneficiaryName: string; // Name of the supplier/beneficiary
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
  notifyPartyNameAndAddress?: string;
  notifyPartyName?: string;
  notifyPartyCell?: string;
  notifyPartyEmail?: string;
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
  applicantId: string;
  applicantName: string;
  beneficiaryId: string;
  beneficiaryName: string;
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
  notifyPartyNameAndAddress?: string;
  notifyPartyName?: string;
  notifyPartyCell?: string;
  notifyPartyEmail?: string;
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
  brandLogoUrl?: string;
  bankInformation?: string;
  createdAt?: any;
  updatedAt?: any;
}
export type SupplierDocument = Supplier & { id: string, createdAt: any, updatedAt: any, brandLogoUrl?: string, bankInformation?: string };


export interface AppNotification {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  isRead: boolean;
  link?: string;
}

export type UserRole = "Super Admin" | "Admin" | "User";

export interface CompanyProfile {
  companyName?: string;
  address?: string;
  contactPerson?: string;
  cellNumber?: string;
  emailId?: string;
  binNumber?: string;
  tinNumber?: string;
  companyLogoUrl?: string;
  updatedAt?: any; // Firestore ServerTimestamp
}

export interface UserDocumentForAdmin {
  id: string; // Firestore document ID
  uid?: string; // Optional: Firebase Auth UID, if you link them
  displayName: string;
  email: string;
  contactNumber?: string;
  role: UserRole;
  createdAt: any; // Firestore ServerTimestamp
  updatedAt: any; // Firestore ServerTimestamp
  photoURL?: string; // Optional photo URL
}

// --- Proforma Invoice Types ---
export interface ProformaInvoiceLineItem {
  slNo?: string;
  modelNo: string;
  qty: number | '';
  purchasePrice: number | '';
  salesPrice: number | '';
}

export const freightChargeOptions = ["Freight Included", "Freight Excluded"] as const;
export type FreightChargeOption = typeof freightChargeOptions[number];

export interface ProformaInvoice {
  id?: string;
  beneficiaryId: string;
  beneficiaryName: string;
  applicantId: string;
  applicantName: string;
  piNo: string;
  piDate: Date;
  salesPersonName: string;
  connectedLcId?: string; // ID of the LCEntryDocument
  connectedLcNumber?: string;
  connectedLcIssueDate?: string; // ISO string
  lineItems: ProformaInvoiceLineItem[];
  freightChargeOption: FreightChargeOption;
  freightChargeAmount?: number | '';
  totalQty: number;
  totalPurchasePrice: number;
  totalSalesPrice: number;
  grandTotalSalesPrice: number;
  totalCommissionPercentage: number;
  createdAt?: any;
  updatedAt?: any;
}

export type ProformaInvoiceDocument = Omit<ProformaInvoice, 'piDate' | 'lineItems' | 'freightChargeAmount'> & {
  id: string; // Ensure ID is part of the document type
  piDate: string; // Stored as ISO String
  lineItems: Array<Omit<ProformaInvoiceLineItem, 'qty' | 'purchasePrice' | 'salesPrice'> & {
    qty: number;
    purchasePrice: number;
    salesPrice: number;
  }>;
  freightChargeAmount?: number;
  createdAt: any;
  updatedAt: any;
};

// Option type for L/C dropdown in PI form
export interface LcOption {
  value: string; // L/C document ID
  label: string; // L/C Number (documentaryCreditNumber)
  issueDate?: string; // L/C Issue Date (ISO string)
}

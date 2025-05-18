
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
  applicantId: string;
  applicantName: string;
  beneficiaryId: string;
  beneficiaryName: string;
  currency: Currency;
  amount: number | '';
  termsOfPay: TermsOfPay;
  documentaryCreditNumber: string;
  proformaInvoiceNumber?: string;
  invoiceDate?: Date | null;
  totalMachineQty: number | '';
  lcIssueDate?: Date;
  expireDate?: Date;
  latestShipmentDate?: Date;
  purchaseOrderUrl?: string;
  finalPIUrl?: string;
  shippingDocumentsUrl?: string;
  finalLcUrl?: string;
  trackingCourier?: TrackingCourier | "";
  trackingNumber?: string;
  etd?: Date | null;
  eta?: Date | null;
  itemDescriptions?: string;
  consigneeBankNameAddress?: string;
  bankBin?: string;
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
  invoiceDate?: string;
  totalMachineQty: number;
  lcIssueDate?: string;
  expireDate?: string;
  latestShipmentDate?: string;
  purchaseOrderUrl?: string;
  finalPIUrl?: string;
  shippingDocumentsUrl?: string;
  finalLcUrl?: string;
  trackingCourier?: TrackingCourier | "";
  trackingNumber?: string;
  etd?: string;
  eta?: string;
  itemDescriptions?: string;
  consigneeBankNameAddress?: string;
  bankBin?: string;
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
  createdAt: any;
  updatedAt: any;
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
  applicantBondNo?: string;
  groupName?: string; // Added new field
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
  updatedAt?: any;
}

export interface UserDocumentForAdmin {
  id: string; // Firestore document ID
  uid?: string; // Firebase Auth UID (if linked)
  displayName: string;
  email: string;
  contactNumber?: string;
  role: UserRole;
  photoURL?: string;
  createdAt?: any; // Firestore ServerTimestamp
  updatedAt?: any; // Firestore ServerTimestamp
}

// --- Proforma Invoice Types ---
export interface ProformaInvoiceLineItem {
  slNo?: string;
  modelNo: string;
  qty: number | ''; // Kept as number | '' for form input flexibility
  purchasePrice: number | ''; // Kept as number | ''
  salesPrice: number | ''; // Kept as number | ''
  netCommissionPercentage?: number | ''; // Kept as number | ''
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
  connectedLcId?: string;
  connectedLcNumber?: string;
  connectedLcIssueDate?: string; // Store as string (ISO)
  purchaseOrderUrl?: string;
  lineItems: ProformaInvoiceLineItem[];
  freightChargeOption: FreightChargeOption;
  freightChargeAmount?: number | '';
  miscellaneousExpenses?: number | '';
  totalQty: number;
  totalPurchasePrice: number;
  totalSalesPrice: number; // Sum of (Qty * Sales Price) from line items
  totalExtraNetCommission?: number;
  grandTotalSalesPrice: number; // totalSalesPrice + freightCharge (if excluded) - miscellaneousExpenses
  grandTotalCommissionUSD?: number;
  totalCommissionPercentage: number;
  createdAt?: any;
  updatedAt?: any;
}

export type ProformaInvoiceDocument = Omit<ProformaInvoice, 'piDate' | 'lineItems' | 'freightChargeAmount' | 'miscellaneousExpenses' | 'netCommissionPercentage'> & {
  id: string;
  piDate: string; // ISO string
  connectedLcIssueDate?: string; // ISO string
  lineItems: Array<Omit<ProformaInvoiceLineItem, 'qty' | 'purchasePrice' | 'salesPrice' | 'netCommissionPercentage'> & {
    qty: number;
    purchasePrice: number;
    salesPrice: number;
    netCommissionPercentage?: number;
  }>;
  freightChargeAmount?: number;
  miscellaneousExpenses?: number;
  totalExtraNetCommission?: number;
  grandTotalCommissionUSD?: number;
  createdAt: any; // Firestore ServerTimestamp
  updatedAt: any; // Firestore ServerTimestamp
};

// Option type for L/C dropdown in PI form
export interface LcOption {
  value: string; // LC document ID
  label: string; // LC number for display
  issueDate?: string; // ISO string
  purchaseOrderUrl?: string;
}

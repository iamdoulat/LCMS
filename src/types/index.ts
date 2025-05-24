
export const termsOfPayOptions = [
  "T/T In Advance",
  "L/C AT SIGHT",
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
export type TrackingCourier = typeof trackingCourierOptions[number];

export const lcStatusOptions = ["Draft", "Transmitted", "Shipment Pending", "Shipping going on", "Payment Done", "Shipment Done"] as const;
export type LCStatus = typeof lcStatusOptions[number];

export const partialShipmentAllowedOptions = ["Yes", "No"] as const;
export type PartialShipmentAllowed = typeof partialShipmentAllowedOptions[number];

export const certificateOfOriginCountries = [
  "JAPAN", "CHINA", "TAIWAN", "SINGAPORE", "VIETNAM", "MALAYSIA", "ITALY", "USA", "THAILAND", "HONG KONG", "TURKEY", "GERMANY",
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
  termsOfPay?: TermsOfPay;
  documentaryCreditNumber: string;
  proformaInvoiceNumber?: string;
  invoiceDate?: Date | null | undefined;
  commercialInvoiceNumber?: string;
  commercialInvoiceDate?: Date | null | undefined;
  totalMachineQty: number | '';
  lcIssueDate?: Date | null | undefined;
  expireDate?: Date | null | undefined;
  latestShipmentDate?: Date | null | undefined;
  purchaseOrderUrl?: string;
  finalPIUrl?: string;
  shippingDocumentsUrl?: string;
  finalLcUrl?: string;
  packingListUrl?: string; 
  trackingCourier?: TrackingCourier | "";
  trackingNumber?: string;
  etd?: Date | null | undefined;
  eta?: Date | null | undefined;
  itemDescriptions?: string;
  consigneeBankNameAddress?: string;
  shipmentMode?: ShipmentMode;
  vesselOrFlightName?: string;
  vesselImoNumber?: string;
  flightNumber?: string;
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
  firstPartialPkgs?: number | '';
  firstPartialNetWeight?: number | '';
  firstPartialGrossWeight?: number | '';
  firstPartialCbm?: number | '';
  secondPartialPkgs?: number | '';
  secondPartialNetWeight?: number | '';
  secondPartialGrossWeight?: number | '';
  secondPartialCbm?: number | '';
  thirdPartialPkgs?: number | '';
  thirdPartialNetWeight?: number | '';
  thirdPartialGrossWeight?: number | '';
  thirdPartialCbm?: number | '';
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
  billOfExchangeQty?: number | '';
  isFirstShipment?: boolean;
  isSecondShipment?: boolean;
  isThirdShipment?: boolean;
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
  termsOfPay?: TermsOfPay;
  documentaryCreditNumber: string;
  proformaInvoiceNumber?: string;
  invoiceDate?: string; // ISO string
  commercialInvoiceNumber?: string;
  commercialInvoiceDate?: string; // ISO string
  totalMachineQty: number;
  lcIssueDate?: string; // ISO string
  expireDate?: string; // ISO string
  latestShipmentDate?: string; // ISO string
  purchaseOrderUrl?: string;
  finalPIUrl?: string;
  shippingDocumentsUrl?: string;
  finalLcUrl?: string;
  packingListUrl?: string; 
  trackingCourier?: TrackingCourier | "";
  trackingNumber?: string;
  etd?: string; // ISO string
  eta?: string; // ISO string
  itemDescriptions?: string;
  consigneeBankNameAddress?: string;
  shipmentMode?: ShipmentMode;
  vesselOrFlightName?: string;
  vesselImoNumber?: string;
  flightNumber?: string;
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
  status?: LCStatus;
  createdAt: any; // Firestore ServerTimestamp
  updatedAt: any; // Firestore ServerTimestamp
  partialShipmentAllowed?: PartialShipmentAllowed;
  firstPartialQty?: number;
  secondPartialQty?: number;
  thirdPartialQty?: number;
  firstPartialAmount?: number;
  secondPartialAmount?: number;
  thirdPartialAmount?: number;
  firstPartialPkgs?: number;
  firstPartialNetWeight?: number;
  firstPartialGrossWeight?: number;
  firstPartialCbm?: number;
  secondPartialPkgs?: number;
  secondPartialNetWeight?: number;
  secondPartialGrossWeight?: number;
  secondPartialCbm?: number;
  thirdPartialPkgs?: number;
  thirdPartialNetWeight?: number;
  thirdPartialGrossWeight?: number;
  thirdPartialCbm?: number;
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
  billOfExchangeQty?: number;
  isFirstShipment?: boolean;
  isSecondShipment?: boolean;
  isThirdShipment?: boolean;
}

export interface Customer {
  id?: string;
  applicantName: string;
  email: string;
  phone?: string;
  address: string;
  contactPerson?: string;
  contactPersonDesignation?: string;
  binNo?: string;
  tinNo?: string;
  newIrcNo?: string;
  oldIrcNo?: string;
  applicantBondNo?: string;
  groupName?: string;
  bidaRegNo?: string;
  createdAt?: any;
  updatedAt?: any;
}
export type CustomerDocument = Customer & { id: string, createdAt: any, updatedAt: any };
export interface ApplicantOption {
  value: string;
  label: string;
  address?: string;
  contactPersonName?: string;
  email?: string;
  phone?: string;
}


export interface Supplier {
  id?: string;
  beneficiaryName: string;
  headOfficeAddress: string;
  bankInformation?: string;
  contactPersonName: string;
  cellNumber: string;
  emailId: string;
  website?: string;
  brandName: string;
  brandLogoUrl?: string;
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
  uid?: string; // Firebase Auth UID
  displayName: string;
  email: string;
  contactNumber?: string;
  role: UserRole;
  photoURL?: string;
  createdAt?: any;
  updatedAt?: any;
}

// --- Proforma Invoice Types ---
export interface ProformaInvoiceLineItem {
  slNo?: string;
  modelNo: string;
  qty: number | '';
  purchasePrice: number | '';
  salesPrice: number | '';
  netCommissionPercentage?: number | '';
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
  connectedLcIssueDate?: string;
  purchaseOrderUrl?: string;
  lineItems: ProformaInvoiceLineItem[];
  freightChargeOption: FreightChargeOption;
  freightChargeAmount?: number | '';
  miscellaneousExpenses?: number | '';
  totalQty: number;
  totalPurchasePrice: number;
  totalSalesPrice: number;
  totalExtraNetCommission?: number;
  grandTotalSalesPrice: number;
  grandTotalCommissionUSD?: number;
  totalCommissionPercentage: number;
  createdAt?: any;
  updatedAt?: any;
}

export type ProformaInvoiceDocument = Omit<ProformaInvoice, 'piDate' | 'lineItems' | 'freightChargeAmount' | 'miscellaneousExpenses' | 'grandTotalCommissionUSD' | 'totalExtraNetCommission'> & {
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

export interface LcOption {
  value: string; // L/C document ID
  label: string; // L/C Number (documentaryCreditNumber)
  issueDate?: string; // ISO string
  purchaseOrderUrl?: string;
  commercialInvoiceNumber?: string; // Added this
  commercialInvoiceDate?: string; // Added this
  totalMachineQty?: number;
  proformaInvoiceNumber?: string;
  invoiceDate?: string;
  etd?: string;
  eta?: string;
  applicantId?: string;
  beneficiaryId?: string;
  documentaryCreditNumber?: string;
  isFirstShipment?: boolean;
  isSecondShipment?: boolean;
  isThirdShipment?: boolean;
  partialShipmentAllowed?: PartialShipmentAllowed;
  firstPartialQty?: number;
  firstPartialAmount?: number;
  firstPartialPkgs?: number;
  firstPartialNetWeight?: number;
  firstPartialGrossWeight?: number;
  firstPartialCbm?: number;
  secondPartialQty?: number;
  secondPartialAmount?: number;
  secondPartialPkgs?: number;
  secondPartialNetWeight?: number;
  secondPartialGrossWeight?: number;
  secondPartialCbm?: number;
  thirdPartialQty?: number;
  thirdPartialAmount?: number;
  thirdPartialPkgs?: number;
  thirdPartialNetWeight?: number;
  thirdPartialGrossWeight?: number;
  thirdPartialCbm?: number;
}


export interface InstallationReportFormValues {
    applicantId: string;
    beneficiaryId: string;
    selectedCommercialInvoiceLcId?: string;
    documentaryCreditNumber?: string;
    totalMachineQty?: number;
    proformaInvoiceNumber?: string;
    invoiceDate?: Date | null;
    etdDate?: Date | null;
    etaDate?: Date | null;
    packingListUrl?: string;
    technicianName: string;
    reportingEngineerName: string;
    installationNotes?: string;
    installationDetails: InstallationDetailItem[];
    missingItemInfo?: string;
    extraFoundInfo?: string;
}

export interface InstallationDetailItem {
    slNo?: string; // Optional because it's auto-generated for display
    machineModel: string;
    serialNo: string;
    ctlBoxModel?: string; // Added
    ctlBoxSerial?: string; // Added
    installDate?: Date;
}

// Make sure LcForInvoiceDropdownOption uses the updated LcOption
export interface LcForInvoiceDropdownOption extends ComboboxOption {
  lcData: LcOption & LCEntryDocument; // Ensure lcData can hold all fields from LCEntryDocument for safety
}

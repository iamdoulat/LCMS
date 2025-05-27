import { z } from 'zod';

export const termsOfPayOptions = [
  "T/T In Advance",
  "L/C AT SIGHT",
  "UPAS",
  "Deffered 120days",
  "Deffered 180days",
  "Deffered 360days",
] as const;
export type TermsOfPay = typeof termsOfPayOptions[number] | undefined;

export const shipmentModeOptions = ["Sea", "Air"] as const;
export type ShipmentMode = typeof shipmentModeOptions[number];

export const currencyOptions = ["USD", "EURO"] as const;
export type Currency = typeof currencyOptions[number];

export const trackingCourierOptions = ["DHL", "FedEx"] as const;
export type TrackingCourier = typeof trackingCourierOptions[number] | "";


export const lcStatusOptions = ["Draft", "Transmitted", "Shipment Pending", "Shipping going on", "Payment Done", "Shipment Done"] as const;
export type LCStatus = typeof lcStatusOptions[number] | undefined;

export const partialShipmentAllowedOptions = ["Yes", "No"] as const;
export type PartialShipmentAllowed = typeof partialShipmentAllowedOptions[number];

export const certificateOfOriginCountries = [
  "JAPAN", "CHINA", "TAIWAN", "SINGAPORE", "VIETNAM", "MALAYSIA", "ITALY", "USA", "THAILAND", "HONG KONG", "TURKEY", "GERMANY",
] as const;
export type CertificateOfOriginCountry = typeof certificateOfOriginCountries[number];

const toNumberOrUndefined = (val: unknown): number | undefined => {
  if (val === "" || val === undefined || val === null || (typeof val === 'string' && val.trim() === '')) {
    return undefined;
  }
  const num = Number(String(val).trim());
  return isNaN(num) ? undefined : num;
};


export interface LCEntry {
  id?: string;
  applicantId: string;
  beneficiaryId: string;
  currency?: Currency; // Made optional, will default in form
  amount?: number;
  termsOfPay?: TermsOfPay; // Made optional
  documentaryCreditNumber: string;
  proformaInvoiceNumber?: string;
  invoiceDate?: Date | null | undefined;
  totalMachineQty?: number;
  numberOfAmendments?: number;
  status?: LCStatus; // Made optional
  itemDescriptions?: string;
  partialShipments?: string;
  portOfLoading?: string;
  portOfDischarge?: string;
  consigneeBankNameAddress?: string;
  notifyPartyNameAndAddress?: string;
  notifyPartyName?: string;
  notifyPartyCell?: string;
  notifyPartyEmail?: string;
  lcIssueDate?: Date | null | undefined;
  expireDate?: Date | null | undefined;
  latestShipmentDate?: Date | null | undefined;
  purchaseOrderUrl?: string;
  finalPIUrl?: string;
  finalLcUrl?: string;
  shippingDocumentsUrl?: string;
  packingListUrl?: string;
  trackingCourier?: TrackingCourier | "";
  trackingNumber?: string;
  etd?: Date | null | undefined;
  eta?: Date | null | undefined;
  shipmentMode?: ShipmentMode; // Made optional
  vesselOrFlightName?: string;
  vesselImoNumber?: string;
  flightNumber?: string;
  totalPackageQty?: number;
  totalNetWeight?: number;
  totalGrossWeight?: number;
  totalCbm?: number;
  partialShipmentAllowed?: PartialShipmentAllowed; // Made optional
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
  certificateOfOrigin?: CertificateOfOriginCountry[];
  shippingMarks?: string;
  commercialInvoiceNumber?: string;
  commercialInvoiceDate?: Date | null | undefined;
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
  totalMachineQty: number;
  numberOfAmendments?: number;
  status?: LCStatus;
  itemDescriptions?: string;
  partialShipments?: string;
  portOfLoading?: string;
  portOfDischarge?: string;
  consigneeBankNameAddress?: string;
  notifyPartyNameAndAddress?: string;
  notifyPartyName?: string;
  notifyPartyCell?: string;
  notifyPartyEmail?: string;
  lcIssueDate?: string; // ISO string
  expireDate?: string; // ISO string
  latestShipmentDate?: string; // ISO string
  purchaseOrderUrl?: string;
  finalPIUrl?: string;
  finalLcUrl?: string;
  shippingDocumentsUrl?: string;
  packingListUrl?: string;
  trackingCourier?: TrackingCourier | "";
  trackingNumber?: string;
  etd?: string; // ISO string
  eta?: string; // ISO string
  shipmentMode?: ShipmentMode;
  vesselOrFlightName?: string;
  vesselImoNumber?: string;
  flightNumber?: string;
  totalPackageQty?: number;
  totalNetWeight?: number;
  totalGrossWeight?: number;
  totalCbm?: number;
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
  certificateOfOrigin?: CertificateOfOriginCountry[];
  shippingMarks?: string;
  commercialInvoiceNumber?: string;
  commercialInvoiceDate?: string; // ISO string
  isFirstShipment?: boolean;
  isSecondShipment?: boolean;
  isThirdShipment?: boolean;
  createdAt: any; // Firestore ServerTimestamp
  updatedAt: any; // Firestore ServerTimestamp
}

export interface Customer {
  id?: string;
  applicantName: string;
  email: string;
  phone?: string;
  address: string;
  contactPerson?: string;
  contactPersonDesignation?: string; // Added
  binNo?: string;
  tinNo?: string;
  newIrcNo?: string;
  oldIrcNo?: string;
  applicantBondNo?: string; // Added
  groupName?: string; // Added
  bidaRegNo?: string; // Added
  createdAt?: any;
  updatedAt?: any;
}
export type CustomerDocument = Customer & { id: string, createdAt: any, updatedAt: any };
export interface ApplicantOption {
  value: string; // customerId
  label: string; // applicantName
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

export type UserRole = "Super Admin" | "Admin" | "User" | "Service" | "DemoManager";

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
  uid?: string;
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
  qty: number | ''; // Allow string for form input
  purchasePrice: number | ''; // Allow string for form input
  salesPrice: number | ''; // Allow string for form input
  netCommissionPercentage?: number | ''; // Allow string for form input
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
  connectedLcIssueDate?: string; // ISO string for consistency
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
  grandTotalCommissionUSD: number;
  totalCommissionPercentage: number;
  createdAt?: any;
  updatedAt?: any;
}

export type ProformaInvoiceDocument = Omit<ProformaInvoice, 'piDate' | 'lineItems' | 'freightChargeAmount' | 'miscellaneousExpenses' | 'connectedLcIssueDate'> & {
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
  createdAt: any;
  updatedAt: any;
};

export interface LcOption {
  value: string;
  label: string;
  issueDate?: string; // ISO string
  purchaseOrderUrl?: string;
}

// --- Installation Report Types ---
export const InstallationDetailItemSchema = z.object({
  slNo: z.string().optional(),
  machineModel: z.string().min(1, "Machine Model is required."),
  serialNo: z.string().min(1, "Machine Serial No. is required."),
  ctlBoxModel: z.string().optional(),
  ctlBoxSerial: z.string().optional(),
  installDate: z.date({ required_error: "Installation Date is required." }),
});
export type InstallationDetailItem = z.infer<typeof InstallationDetailItemSchema>;


export const InstallationReportSchema = z.object({
  applicantId: z.string().min(1, "Applicant Name is required."),
  beneficiaryId: z.string().min(1, "Beneficiary Name is required."),
  selectedCommercialInvoiceLcId: z.string().optional(),
  documentaryCreditNumber: z.string().optional(),
  totalMachineQtyFromLC: z.preprocess(toNumberOrUndefined, z.number().int().positive("L/C Machine Qty must be a positive integer.").optional()),
  proformaInvoiceNumber: z.string().optional(),
  invoiceDate: z.date().nullable().optional(),
  commercialInvoiceDate: z.date().nullable().optional(),
  etdDate: z.date().nullable().optional(),
  etaDate: z.date().nullable().optional(),
  packingListUrl: z.preprocess(
    (val) => (String(val).trim() === "" ? undefined : String(val).trim()),
    z.string().url({ message: "Invalid URL format for Packing List URL" }).optional()
  ),
  technicianName: z.string().min(1, "Technician Name is required."),
  reportingEngineerName: z.string().min(1, "Reporting Engineer Name is required."),
  installationDetails: z.array(InstallationDetailItemSchema)
    .min(1, "At least one installation detail item is required.")
    .refine(
      (items) => {
        const serials = items
          .map((item) => item.serialNo?.trim())
          .filter((sn): sn is string => !!sn && sn.length > 0); // Filter out empty or whitespace-only serials
        return new Set(serials).size === serials.length;
      },
      {
        message: "Each non-empty Machine Serial No. must be unique within this report.",
        path: ["installationDetails"], // path of the error
      }
    ),
  missingItemInfo: z.string().optional(),
  extraFoundInfo: z.string().optional(),
  missingItemsIssueResolved: z.boolean().optional().default(false),
  extraItemsIssueResolved: z.boolean().optional().default(false),
  installationNotes: z.string().optional(),
});

export type InstallationReportFormValues = z.infer<typeof InstallationReportSchema>;

export interface InstallationReportDocument {
  id: string;
  applicantId: string;
  applicantName: string;
  beneficiaryId: string;
  beneficiaryName: string;
  selectedCommercialInvoiceLcId?: string;
  commercialInvoiceNumber?: string;
  commercialInvoiceDate?: string; // ISO String
  documentaryCreditNumber?: string;
  totalMachineQtyFromLC?: number;
  proformaInvoiceNumber?: string;
  invoiceDate?: string; // ISO string
  etdDate?: string; // ISO string
  etaDate?: string; // ISO string
  packingListUrl?: string;
  technicianName: string;
  reportingEngineerName: string;
  installationDetails: Array<Omit<InstallationDetailItem, 'installDate'> & { installDate: string; }>; // installDate as ISO string
  totalInstalledQty: number;
  pendingQty?: number | string; // Allow string for "N/A" display
  missingItemInfo?: string;
  extraFoundInfo?: string;
  missingItemsIssueResolved: boolean;
  extraItemsIssueResolved: boolean;
  installationNotes?: string;
  createdAt: any;
  updatedAt: any;
}


export interface LcForInvoiceDropdownOption {
  value: string; // L/C document ID
  label: string; // Commercial Invoice Number
  lcData: LCEntryDocument & {
    id: string,
    commercialInvoiceDate?: string, // ISO String for consistency
    partialShipmentAllowed?: PartialShipmentAllowed,
    firstPartialQty?: number, firstPartialAmount?: number, firstPartialPkgs?: number, firstPartialNetWeight?: number, firstPartialGrossWeight?: number, firstPartialCbm?: number,
    secondPartialQty?: number, secondPartialAmount?: number, secondPartialPkgs?: number, secondPartialNetWeight?: number, secondPartialGrossWeight?: number, secondPartialCbm?: number,
    thirdPartialQty?: number, thirdPartialAmount?: number, thirdPartialPkgs?: number, thirdPartialNetWeight?: number, thirdPartialGrossWeight?: number, thirdPartialCbm?: number,
    packingListUrl?: string;
    isFirstShipment?: boolean;
    isSecondShipment?: boolean;
    isThirdShipment?: boolean;
  };
}

// --- Demo Machine Factory Types ---
export interface DemoMachineFactory {
  id?: string;
  factoryName: string;
  factoryLocation: string;
  contactPerson?: string;
  cellNumber?: string;
  note?: string;
}

export interface DemoMachineFactoryDocument extends DemoMachineFactory {
  id: string;
  createdAt: any;
  updatedAt: any;
}
// --- END Demo Machine Factory Types ---

// --- Demo Machine Types ---
export const demoMachineOwnerOptions = ["Own Machine", "Rent Machine", "Supplier Machine"] as const;
export type DemoMachineOwnerOption = typeof demoMachineOwnerOptions[number];

export const demoMachineStatusOptions = ["Available", "Allocated", "Maintenance Mode"] as const;
export type DemoMachineStatusOption = typeof demoMachineStatusOptions[number];

export interface DemoMachine {
  id?: string;
  machineModel: string;
  machineSerial: string;
  machineBrand: string;
  machineOwner: DemoMachineOwnerOption;
  currentStatus?: DemoMachineStatusOption;
  motorOrControlBoxModel?: string;
  controlBoxSerialNo?: string;
  machineFeatures?: string;
  challanNo?: string; // Added Challan No
  note?: string;
  machineReturned?: boolean; // Added to track if the specific machine instance is returned
  createdAt?: any;
  updatedAt?: any;
}

export type DemoMachineDocument = DemoMachine & { id: string, createdAt: any, updatedAt: any, machineReturned?: boolean };

export interface DemoMachineApplication {
  id?: string;
  factoryId: string;
  factoryName?: string;
  factoryLocation?: string;
  demoMachineId: string;
  machineModel?: string;
  machineSerial?: string;
  machineBrand?: string;
  challanNo?: string;
  deliveryDate: Date;
  estReturnDate: Date;
  demoPeriodDays?: number;
  factoryInchargeName?: string;
  inchargeCell?: string;
  notes?: string;
  machineReturned?: boolean; // Tracks if the machine under this application has been returned
  createdAt?: any;
  updatedAt?: any;
}

export interface DemoMachineApplicationDocument {
  id: string;
  factoryId: string;
  factoryName: string;
  factoryLocation: string;
  demoMachineId: string;
  machineModel: string;
  machineSerial: string;
  machineBrand: string;
  challanNo?: string;
  deliveryDate: string; // ISO string
  estReturnDate: string; // ISO string
  demoPeriodDays: number;
  factoryInchargeName?: string;
  inchargeCell?: string;
  notes?: string;
  machineReturned?: boolean;
  createdAt: any;
  updatedAt: any;
}
// --- END Demo Machine Types ---

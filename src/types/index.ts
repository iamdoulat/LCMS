

import { z } from 'zod';

export const termsOfPayOptions = [
  "T/T In Advance",
  "L/C AT SIGHT",
  "UPAS",
  "Deffered 120days",
  "Deffered 180days",
  "Deffered 360days",
] as const;
export type TermsOfPay = typeof termsOfPayOptions[number];

export const shipmentModeOptions = ["Sea", "Air"] as const;
export type ShipmentMode = typeof shipmentModeOptions[number];

export const currencyOptions = ["USD", "EURO"] as const;
export type Currency = typeof currencyOptions[number];

export const trackingCourierOptions = ["DHL", "FedEx"] as const;
export type TrackingCourier = typeof trackingCourierOptions[number] | "";


export const lcStatusOptions = ["Draft", "Transmitted", "Shipment Pending", "Payment Pending", "Payment Done", "Shipment Done"] as const;
export type LCStatus = typeof lcStatusOptions[number];

export const partialShipmentAllowedOptions = ["Yes", "No"] as const;
export type PartialShipmentAllowed = typeof partialShipmentAllowedOptions[number];

export const certificateOfOriginCountries = [
  "JAPAN", "CHINA", "TAIWAN", "SINGAPORE", "VIETNAM", "MALAYSIA", "ITALY", "USA", "THAILAND", "HONG KONG", "TURKEY", "GERMANY",
] as const;
export type CertificateOfOriginCountry = typeof certificateOfOriginCountries[number];

export const toNumberOrUndefined = (val: unknown): number | undefined => {
  if (val === "" || val === undefined || val === null || (typeof val === 'string' && val.trim() === '')) {
    return undefined;
  }
  const num = Number(String(val).trim());
  return isNaN(num) ? undefined : num;
};

export const getValidOption = <T extends string>(
  value: T | T[] | undefined | null,
  optionsArray: readonly T[],
  fallbackDefault: T | T[]
): T | T[] => {
  if (value === null || value === undefined) {
    return fallbackDefault;
  }
  
  if (Array.isArray(value)) {
    const validValues = value.filter(v => optionsArray.includes(v));
    return validValues.length > 0 ? validValues : fallbackDefault;
  }

  if (optionsArray.includes(value)) {
    return value as T;
  }

  return fallbackDefault;
};


export interface LCEntry {
  id?: string;
  applicantId: string;
  beneficiaryId: string;
  currency: Currency;
  amount: number | undefined;
  termsOfPay?: TermsOfPay;
  documentaryCreditNumber: string;
  proformaInvoiceNumber?: string;
  invoiceDate?: Date | null | undefined;
  commercialInvoiceNumber?: string;
  commercialInvoiceDate?: Date | null | undefined;
  totalMachineQty: number | undefined;
  numberOfAmendments?: number;
  status?: LCStatus[];
  itemDescriptions?: string;
  partialShipments?: string;
  portOfLoading?: string;
  portOfDischarge?: string;
  consigneeBankNameAddress?: string;
  notifyPartyNameAndAddress?: string;
  notifyPartyName?: string; // Previously notifyPartyContactDetails
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
  isFirstShipment?: boolean;
  isSecondShipment?: boolean;
  isThirdShipment?: boolean;
  firstShipmentNote?: string;
  secondShipmentNote?: string;
  thirdShipmentNote?: string;
}

export const lcEntrySchema = z.object({
  applicantId: z.string().min(1, "Applicant Name is required"),
  beneficiaryId: z.string().min(1, "Beneficiary Name is required"),
  currency: z.enum(currencyOptions, { required_error: "Currency is required" }),
  amount: z.preprocess(
    (val) => (val === "" || val === undefined || val === null ? undefined : Number(String(val).trim())),
    z.number({ invalid_type_error: "Amount must be a number" }).positive("Amount must be positive")
  ),
  termsOfPay: z.enum(termsOfPayOptions, { required_error: "Terms of Pay is required" }),
  documentaryCreditNumber: z.string().min(1, "Documentary Credit Number is required"),
  proformaInvoiceNumber: z.string().optional(),
  invoiceDate: z.date().optional().nullable(),
  commercialInvoiceNumber: z.string().optional(),
  commercialInvoiceDate: z.date().optional().nullable(),
  totalMachineQty: z.preprocess(
    (val) => (val === "" || val === undefined || val === null ? undefined : Number(String(val).trim())),
    z.number({ invalid_type_error: "Quantity must be a number" }).int().positive("Quantity must be positive")
  ),
  numberOfAmendments: z.preprocess(toNumberOrUndefined, z.number().int().nonnegative("Amendments must be non-negative integer.").optional().default(0)),
  status: z.array(z.enum(lcStatusOptions)).optional().default([lcStatusOptions[0]]),
  itemDescriptions: z.string().optional(),
  partialShipments: z.string().optional(),
  portOfLoading: z.string().optional(),
  portOfDischarge: z.string().optional(),
  consigneeBankNameAddress: z.string().optional(),
  notifyPartyNameAndAddress: z.string().optional(),
  notifyPartyName: z.string().optional(),
  notifyPartyCell: z.string().optional(),
  notifyPartyEmail: z.string().email({ message: "Invalid email address" }).optional().or(z.literal('')),
  lcIssueDate: z.date().optional().nullable(),
  expireDate: z.date().optional().nullable(),
  latestShipmentDate: z.date().optional().nullable(),
  partialShipmentAllowed: z.enum(partialShipmentAllowedOptions).optional(),
  firstPartialQty: z.preprocess(toNumberOrUndefined, z.number().int().nonnegative("Quantity cannot be negative").optional().default(0)),
  secondPartialQty: z.preprocess(toNumberOrUndefined, z.number().int().nonnegative("Quantity cannot be negative").optional().default(0)),
  thirdPartialQty: z.preprocess(toNumberOrUndefined, z.number().int().nonnegative("Quantity cannot be negative").optional().default(0)),
  firstPartialAmount: z.preprocess(toNumberOrUndefined, z.number().nonnegative("Amount cannot be negative").optional().default(0)),
  secondPartialAmount: z.preprocess(toNumberOrUndefined, z.number().nonnegative("Amount cannot be negative").optional().default(0)),
  thirdPartialAmount: z.preprocess(toNumberOrUndefined, z.number().nonnegative("Amount cannot be negative").optional().default(0)),
  firstPartialPkgs: z.preprocess(toNumberOrUndefined, z.number().int().nonnegative("Pkgs cannot be negative").optional().default(0)),
  firstPartialNetWeight: z.preprocess(toNumberOrUndefined, z.number().nonnegative("Net Weight cannot be negative").optional().default(0)),
  firstPartialGrossWeight: z.preprocess(toNumberOrUndefined, z.number().nonnegative("Gross Weight cannot be negative").optional().default(0)),
  firstPartialCbm: z.preprocess(toNumberOrUndefined, z.number().nonnegative("CBM cannot be negative").optional().default(0)),
  secondPartialPkgs: z.preprocess(toNumberOrUndefined, z.number().int().nonnegative("Pkgs cannot be negative").optional().default(0)),
  secondPartialNetWeight: z.preprocess(toNumberOrUndefined, z.number().nonnegative("Net Weight cannot be negative").optional().default(0)),
  secondPartialGrossWeight: z.preprocess(toNumberOrUndefined, z.number().nonnegative("Gross Weight cannot be negative").optional().default(0)),
  secondPartialCbm: z.preprocess(toNumberOrUndefined, z.number().nonnegative("CBM cannot be negative").optional().default(0)),
  thirdPartialPkgs: z.preprocess(toNumberOrUndefined, z.number().int().nonnegative("Pkgs cannot be negative").optional().default(0)),
  thirdPartialNetWeight: z.preprocess(toNumberOrUndefined, z.number().nonnegative("Net Weight cannot be negative").optional().default(0)),
  thirdPartialGrossWeight: z.preprocess(toNumberOrUndefined, z.number().nonnegative("Gross Weight cannot be negative").optional().default(0)),
  thirdPartialCbm: z.preprocess(toNumberOrUndefined, z.number().nonnegative("CBM cannot be negative").optional().default(0)),
  totalPackageQty: z.preprocess(toNumberOrUndefined, z.number().int().nonnegative("Package quantity cannot be negative").optional().default(0)),
  totalNetWeight: z.preprocess(toNumberOrUndefined, z.number().nonnegative("Net weight cannot be negative").optional().default(0)),
  totalGrossWeight: z.preprocess(toNumberOrUndefined, z.number().nonnegative("Gross weight cannot be negative").optional().default(0)),
  totalCbm: z.preprocess(toNumberOrUndefined, z.number().nonnegative("CBM cannot be negative").optional().default(0)),
  shipmentMode: z.enum(shipmentModeOptions).optional(),
  vesselOrFlightName: z.string().optional(),
  vesselImoNumber: z.string().optional(),
  flightNumber: z.string().optional(),
  trackingCourier: z.enum(["", ...trackingCourierOptions]).optional(),
  trackingNumber: z.string().optional(),
  etd: z.date().optional().nullable(),
  eta: z.date().optional().nullable(),
  originalBlQty: z.preprocess(toNumberOrUndefined, z.number().int().nonnegative("Quantity cannot be negative").optional().default(0)),
  copyBlQty: z.preprocess(toNumberOrUndefined, z.number().int().nonnegative("Quantity cannot be negative").optional().default(0)),
  originalCooQty: z.preprocess(toNumberOrUndefined, z.number().int().nonnegative("Quantity cannot be negative").optional().default(0)),
  copyCooQty: z.preprocess(toNumberOrUndefined, z.number().int().nonnegative("Quantity cannot be negative").optional().default(0)),
  invoiceQty: z.preprocess(toNumberOrUndefined, z.number().int().nonnegative("Quantity cannot be negative").optional().default(0)),
  packingListQty: z.preprocess(toNumberOrUndefined, z.number().int().nonnegative("Quantity cannot be negative").optional().default(0)),
  beneficiaryCertificateQty: z.preprocess(toNumberOrUndefined, z.number().int().nonnegative("Quantity cannot be negative").optional().default(0)),
  brandNewCertificateQty: z.preprocess(toNumberOrUndefined, z.number().int().nonnegative("Quantity cannot be negative").optional().default(0)),
  beneficiaryWarrantyCertificateQty: z.preprocess(toNumberOrUndefined, z.number().int().nonnegative("Quantity cannot be negative").optional().default(0)),
  beneficiaryComplianceCertificateQty: z.preprocess(toNumberOrUndefined, z.number().int().nonnegative("Quantity cannot be negative").optional().default(0)),
  shipmentAdviceQty: z.preprocess(toNumberOrUndefined, z.number().int().nonnegative("Quantity cannot be negative").optional().default(0)),
  billOfExchangeQty: z.preprocess(toNumberOrUndefined, z.number().int().nonnegative("Quantity cannot be negative").optional().default(0)),
  certificateOfOrigin: z.array(z.enum(certificateOfOriginCountries)).optional().default([]),
  shippingMarks: z.string().optional(),
  purchaseOrderUrl: z.preprocess((val) => (String(val).trim() === "" ? undefined : String(val).trim()), z.string().url({ message: "Invalid URL format" }).optional()),
  finalPIUrl: z.preprocess((val) => (String(val).trim() === "" ? undefined : String(val).trim()), z.string().url({ message: "Invalid URL format" }).optional()),
  finalLcUrl: z.preprocess((val) => (String(val).trim() === "" ? undefined : String(val).trim()), z.string().url({ message: "Invalid URL format" }).optional()),
  shippingDocumentsUrl: z.preprocess((val) => (String(val).trim() === "" ? undefined : String(val).trim()), z.string().url({ message: "Invalid URL format" }).optional()),
  packingListUrl: z.preprocess((val) => (String(val).trim() === "" ? undefined : String(val).trim()), z.string().url({ message: "Invalid URL format" }).optional()),
  isFirstShipment: z.boolean().optional().default(true),
  isSecondShipment: z.boolean().optional().default(false),
  isThirdShipment: z.boolean().optional().default(false),
  firstShipmentNote: z.string().optional(),
  secondShipmentNote: z.string().optional(),
  thirdShipmentNote: z.string().optional(),
}).superRefine((data, ctx) => {
    if (!data.status || data.status.length === 0 || data.status.includes('Draft')) {
        return;
    }

    if (!data.lcIssueDate) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['lcIssueDate'],
            message: 'T/T or L/C Issue Date is required when status is not Draft.',
        });
    }

    if (data.termsOfPay !== 'T/T In Advance') {
        if (!data.expireDate) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['expireDate'],
                message: 'Expire Date is required unless Terms of Pay is T/T In Advance.',
            });
        }
        if (!data.latestShipmentDate) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['latestShipmentDate'],
                message: 'Latest Shipment Date is required unless Terms of Pay is T/T In Advance.',
            });
        }
    }
});


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
  numberOfAmendments?: number;
  status?: LCStatus[];
  itemDescriptions?: string;
  partialShipments?: string;
  portOfLoading?: string;
  portOfDischarge?: string;
  consigneeBankNameAddress?: string;
  notifyPartyNameAndAddress?: string;
  notifyPartyName?: string; // Previously notifyPartyContactDetails
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
  isFirstShipment?: boolean;
  isSecondShipment?: boolean;
  isThirdShipment?: boolean;
  firstShipmentNote?: string;
  secondShipmentNote?: string;
  thirdShipmentNote?: string;
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
export type SupplierDocument = Supplier & { id: string, createdAt: any, updatedAt: any, brandLogoUrl?: string, bankInformation?: string, headOfficeAddress: string };


export interface AppNotification {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  isRead: boolean;
  link?: string;
}

export type UserRole = "Super Admin" | "Admin" | "User" | "Service" | "DemoManager" | "Store Manager" | "Viewer";

export interface CompanyProfile {
  companyName?: string;
  address?: string;
  contactPerson?: string;
  cellNumber?: string;
  emailId?: string;
  binNumber?: string;
  tinNumber?: string;
  companyLogoUrl?: string;
  invoiceLogoUrl?: string;
  hideCompanyName?: boolean;
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
  createdAt?: any;
  updatedAt?: any;
}

export interface LcForInvoiceDropdownOption {
  value: string; // L/C document ID
  label: string; // Commercial Invoice Number
  lcData: LCEntryDocument & {
    id: string;
    commercialInvoiceDate?: string; // ISO Date String
    partialShipmentAllowed?: PartialShipmentAllowed;
    firstPartialQty?: number; firstPartialAmount?: number; firstPartialPkgs?: number; firstPartialNetWeight?: number; firstPartialGrossWeight?: number; firstPartialCbm?: number;
    secondPartialQty?: number; secondPartialAmount?: number; secondPartialPkgs?: number; secondPartialNetWeight?: number; secondPartialGrossWeight?: number; secondPartialCbm?: number;
    thirdPartialQty?: number; thirdPartialAmount?: number; thirdPartialPkgs?: number; thirdPartialNetWeight?: number; thirdPartialGrossWeight?: number; thirdPartialCbm?: number;
    packingListUrl?: string;
    isFirstShipment?: boolean;
    isSecondShipment?: boolean;
    isThirdShipment?: boolean;
  };
}

export interface LcOption {
  value: string;
  label: string;
  issueDate?: string;
  purchaseOrderUrl?: string;
}

// --- Proforma Invoice Types ---
export const freightChargeOptions = ["Freight Included", "Freight Excluded"] as const;
export type FreightChargeOption = typeof freightChargeOptions[number];

export interface ProformaInvoiceLineItem {
  slNo?: string;
  modelNo: string;
  qty: number;
  purchasePrice: number;
  salesPrice: number;
  netCommissionPercentage?: number;
}

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
  connectedLcIssueDate?: string; // ISO string
  purchaseOrderUrl?: string;
  lineItems: ProformaInvoiceLineItem[];
  freightChargeOption: FreightChargeOption;
  freightChargeAmount?: number;
  miscellaneousExpenses?: number;
  totalQty: number;
  totalPurchasePrice: number;
  totalSalesPrice: number; // Sum of (qty * salesPrice) from line items
  totalExtraNetCommission?: number;
  grandTotalSalesPrice: number; // (totalSalesPrice + (freight if excluded)) - miscExpenses
  grandTotalCommissionUSD: number;
  totalCommissionPercentage: number;
  createdAt?: any;
  updatedAt?: any;
}

export type ProformaInvoiceDocument = Omit<ProformaInvoice, 'piDate' | 'connectedLcIssueDate'> & {
  id: string;
  piDate: string; // ISO string
  connectedLcIssueDate?: string; // ISO string
  createdAt: any;
  updatedAt: any;
};

// --- END Proforma Invoice Types ---


// --- Installation Report Types ---
export const InstallationDetailItemSchema = z.object({
  slNo: z.string().optional(),
  machineModel: z.string().min(1, "Machine Model is required."),
  serialNo: z.string().min(1, "Machine Serial No. is required."),
  ctlBoxModel: z.string().optional(),
  ctlBoxSerial: z.string().optional(),
  installDate: z.date({ required_error: "Installation Date is required." }),
  // warrantyRemaining is calculated, not part of form data
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
        path: ["installationDetails"], // Point error to the array if needed or a specific field
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
  pendingQty?: number;
  missingItemInfo?: string;
  extraFoundInfo?: string;
  missingItemsIssueResolved: boolean;
  extraItemsIssueResolved: boolean;
  installationNotes?: string;
  createdAt: any;
  updatedAt: any;
}


// --- END Installation Report Types ---

// --- Demo Machine Factory Types ---
export interface DemoMachineFactory {
  id?: string;
  factoryName: string;
  factoryLocation: string;
  groupName?: string;
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
  note?: string;
  machineReturned?: boolean; // Added for tracking if machine returned to inventory
}

export type DemoMachineDocument = Omit<DemoMachine, 'id'> & { id: string, createdAt: any, updatedAt: any, machineReturned?: boolean };


// --- Demo Machine Application Types ---
const phoneRegexForValidation = new RegExp(
  /^([+]?[\s0-9]+)?(\d{3}|[(]?[0-9]+[)])?([-]?[\s]?[0-9])+$/
);

export const AppliedMachineItemSchema = z.object({
  demoMachineId: z.string().min(1, "Machine Model is required."),
  // machineModel, machineSerial, machineBrand will be populated from selected demoMachineId
});
export type AppliedMachineItem = z.infer<typeof AppliedMachineItemSchema>;

export const demoMachineApplicationSchema = z.object({
  factoryId: z.string().min(1, "Customer Name (Factory) is required."),
  challanNo: z.string().min(1, "Challan No. is required."),
  deliveryDate: z.date({ required_error: "Delivery Date is required." }),
  estReturnDate: z.date({ required_error: "Est. Return Date is required." }),
  factoryInchargeName: z.string().optional(),
  inchargeCell: z.string().optional().refine(
    (value) => value === "" || value === undefined || phoneRegexForValidation.test(value),
    "Invalid phone number format"
  ),
  notes: z.string().optional(),
  machineReturned: z.boolean().optional().default(false), // Application-level returned status
  appliedMachines: z.array(AppliedMachineItemSchema).min(1, "At least one machine must be selected for the application."),
}).refine(data => {
  if (data.deliveryDate && data.estReturnDate) {
    return data.estReturnDate >= data.deliveryDate;
  }
  return true;
}, {
  message: "Est. Return Date must be on or after Delivery Date.",
  path: ["estReturnDate"],
});

export type DemoMachineApplicationFormValues = z.infer<typeof demoMachineApplicationSchema>;

export interface DemoMachineApplicationDocument {
  id: string;
  factoryId: string;
  factoryName: string; // Denormalized
  factoryLocation: string; // Denormalized
  challanNo: string;
  deliveryDate: string; // ISO string
  estReturnDate: string; // ISO string
  demoPeriodDays: number;
  factoryInchargeName?: string;
  inchargeCell?: string;
  notes?: string;
  machineReturned?: boolean; // Overall status of the application's machines
  appliedMachines: Array<{ // Array of machines in this application
    demoMachineId: string;
    machineModel: string; // Denormalized
    machineSerial: string; // Denormalized
    machineBrand: string; // Denormalized
  }>;
  createdAt: any; // Firestore ServerTimestamp
  updatedAt: any; // Firestore ServerTimestamp
}
// --- END Demo Machine Application Types ---
// --- END Demo Machine Types ---

// --- Item (Inventory) Types ---
export interface Item {
  id?: string;
  itemName: string;
  itemCode?: string; // SKU
  brandName?: string;
  supplierId?: string; // New field
  supplierName?: string; // New field (denormalized for display)
  description?: string;
  unit?: string; // e.g., pcs, kg, m
  salesPrice?: number;
  purchasePrice?: number;
  manageStock: boolean;
  currentQuantity?: number;
  location?: string;
  idealQuantity?: number;
  warningQuantity?: number;
  createdAt?: any; // Firestore ServerTimestamp
  updatedAt?: any; // Firestore ServerTimestamp
}
export type ItemDocument = Item & { id: string };

export const itemSchema = z.object({
  itemName: z.string().min(1, "Item Name is required."),
  itemCode: z.string().optional(),
  brandName: z.string().optional(),
  supplierId: z.string().optional(),
  description: z.string().optional(),
  unit: z.string().optional(),
  salesPrice: z.preprocess(
    (val) => (String(val).trim() === "" ? undefined : Number(String(val).trim())),
    z.number({ invalid_type_error: "Sales Price must be a number." }).nonnegative("Sales Price cannot be negative.").optional()
  ),
  purchasePrice: z.preprocess(
    (val) => (String(val).trim() === "" ? undefined : Number(String(val).trim())),
    z.number({ invalid_type_error: "Purchase Price must be a number." }).nonnegative("Purchase Price cannot be negative.").optional()
  ),
  manageStock: z.boolean().default(false),
  currentQuantity: z.preprocess(
    (val) => (String(val).trim() === "" ? undefined : Number(String(val).trim())),
    z.number({ invalid_type_error: "Current Quantity must be a number." }).int().nonnegative("Current Quantity must be a non-negative integer.").optional()
  ),
  location: z.string().optional(),
  idealQuantity: z.preprocess(
    (val) => (String(val).trim() === "" ? undefined : Number(String(val).trim())),
    z.number({ invalid_type_error: "Ideal Quantity must be a number." }).int().nonnegative("Ideal Quantity must be a non-negative integer.").optional()
  ),
  warningQuantity: z.preprocess(
    (val) => (String(val).trim() === "" ? undefined : Number(String(val).trim())),
    z.number({ invalid_type_error: "Warning Quantity must be a number." }).int().nonnegative("Warning Quantity must be a non-negative integer.").optional()
  ),
}).superRefine((data, ctx) => {
  if (data.manageStock && data.currentQuantity === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Current Quantity is required when managing stock.",
        path: ["currentQuantity"],
      });
  }

  if (data.manageStock && data.warningQuantity !== undefined && data.idealQuantity !== undefined) {
    if (data.warningQuantity > data.idealQuantity) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Warning Quantity should not be greater than Ideal Quantity.",
        path: ["warningQuantity"],
      });
    }
  }
});

export type ItemFormValues = z.infer<typeof itemSchema>;
// --- END Item (Inventory) Types ---

// --- Quote Types ---
export const quoteTaxTypes = ["Default", "Exempt", "GST @ 5%", "VAT @ 15%"] as const;
export type QuoteTaxType = typeof quoteTaxTypes[number];

export const quoteStatusOptions = ["Draft", "Sent", "Accepted", "Rejected", "Invoiced"] as const;
export type QuoteStatus = typeof quoteStatusOptions[number];

export const QuoteLineItemSchema = z.object({
  itemId: z.string().min(1, "Item selection is required."),
  itemCode: z.string().optional(),
  description: z.string().optional(),
  qty: z.string().min(1, "Qty is required.").refine(val => !isNaN(parseFloat(val)) && parseFloat(val) > 0, { message: "Qty must be > 0" }),
  unitPrice: z.string().min(1, "Unit Price is required.").refine(val => !isNaN(parseFloat(val)) && parseFloat(val) >= 0, { message: "Unit Price must be non-negative" }),
  discountPercentage: z.string().optional().refine(val => val === '' || val === undefined || (!isNaN(parseFloat(val)) && parseFloat(val) >= 0 && parseFloat(val) <= 100), { message: "Discount must be 0-100 or blank" }),
  taxPercentage: z.string().optional().refine(val => val === '' || val === undefined || (!isNaN(parseFloat(val)) && parseFloat(val) >= 0 && parseFloat(val) <= 100), { message: "Tax must be 0-100 or blank" }),
  total: z.string(), // Calculated, not for direct input
});
export type QuoteLineItemFormValues = z.infer<typeof QuoteLineItemSchema>;

export const QuoteSchema = z.object({
  customerId: z.string().min(1, "Customer is required."),
  billingAddress: z.string().min(1, "Billing Address is required."),
  shippingAddress: z.string().min(1, "Shipping Address is required."),
  quoteDate: z.date({ required_error: "Quote Date is required." }),
  salesperson: z.string().min(1, "Salesperson is required."),
  subject: z.string().optional(),
  lineItems: z.array(QuoteLineItemSchema).min(1, "At least one line item is required."),
  taxType: z.enum(quoteTaxTypes).default("Default"),
  status: z.enum(quoteStatusOptions).optional(),
  globalDiscount: z.string().optional(), // For future use
  globalTaxRate: z.string().optional(), // For future use
  comments: z.string().optional(),
  privateComments: z.string().optional(),
  // Calculated fields, not part of the form for direct input but needed for schema
  subtotal: z.number().optional(),
  totalDiscountAmount: z.number().optional(),
  totalTaxAmount: z.number().optional(),
  totalAmount: z.number().optional(),
  // Column visibility
  showItemCodeColumn: z.boolean().optional().default(true),
  showDiscountColumn: z.boolean().optional().default(true),
  showTaxColumn: z.boolean().optional().default(true),
  convertedToInvoiceId: z.string().optional(),
});
export type QuoteFormValues = z.infer<typeof QuoteSchema>;

export interface QuoteLineItemDocument {
  itemId: string;
  itemName: string; // Denormalized
  itemCode?: string; // Denormalized
  description?: string;
  qty: number;
  unitPrice: number;
  discountPercentage?: number;
  taxPercentage?: number;
  total: number;
}

export interface QuoteDocument {
  id: string; // This will store the formatted QSS{Year}-{Serial}
  customerId: string;
  customerName: string;
  billingAddress: string;
  shippingAddress: string;
  quoteDate: string; // ISO string
  salesperson: string;
  subject?: string;
  lineItems: QuoteLineItemDocument[];
  taxType: QuoteTaxType;
  comments?: string;
  privateComments?: string;
  subtotal: number;
  totalDiscountAmount: number;
  totalTaxAmount: number;
  totalAmount: number;
  status: QuoteStatus;
  createdAt: any; // Firestore ServerTimestamp
  updatedAt: any; // Firestore ServerTimestamp
  showItemCodeColumn?: boolean;
  showDiscountColumn?: boolean;
  showTaxColumn?: boolean;
  convertedToInvoiceId?: string;
}
// --- END Quote Types ---

// --- Sale Types ---
export type SaleStatus = "Draft" | "Completed" | "Cancelled" | "Refunded";

export interface InvoiceLineItemDocument { // Reusing for consistency
  itemId: string;
  itemName: string;
  itemCode?: string;
  description?: string;
  qty: number;
  unitPrice: number;
  discountPercentage?: number;
  taxPercentage?: number;
  total: number;
}


export interface SaleDocument {
  id: string;
  customerId: string;
  customerName: string;
  billingAddress: string;
  shippingAddress: string;
  saleDate: string; // ISO string
  salesperson: string;
  lineItems: InvoiceLineItemDocument[];
  taxType: QuoteTaxType; // Reusing QuoteTaxType for simplicity
  comments?: string;
  privateComments?: string;
  subtotal: number;
  totalDiscountAmount: number;
  totalTaxAmount: number;
  totalAmount: number;
  status: SaleStatus;
  returnReason?: string;
  refundDate?: string; // ISO string
  createdAt: any; // Firestore ServerTimestamp
  updatedAt: any; // Firestore ServerTimestamp
  showItemCodeColumn?: boolean;
  showDiscountColumn?: boolean;
  showTaxColumn?: boolean;
}

export const SaleLineItemSchema = z.object({
  itemId: z.string().min(1, "Item selection is required."),
  itemCode: z.string().optional(),
  description: z.string().optional(),
  qty: z.string().min(1, "Qty is required.").refine(val => !isNaN(parseFloat(val)) && parseFloat(val) > 0, { message: "Qty must be > 0" }),
  unitPrice: z.string().min(1, "Unit Price is required.").refine(val => !isNaN(parseFloat(val)) && parseFloat(val) >= 0, { message: "Unit Price must be non-negative" }),
  discountPercentage: z.string().optional().refine(val => val === '' || val === undefined || (!isNaN(parseFloat(val)) && parseFloat(val) >= 0 && parseFloat(val) <= 100), { message: "Discount must be 0-100 or blank" }),
  taxPercentage: z.string().optional().refine(val => val === '' || val === undefined || (!isNaN(parseFloat(val)) && parseFloat(val) >= 0 && parseFloat(val) <= 100), { message: "Tax must be 0-100 or blank" }),
  total: z.string(), // Calculated, not for direct input
});
export type SaleLineItemFormValues = z.infer<typeof SaleLineItemSchema>;

export const SaleSchema = z.object({
  customerId: z.string().min(1, "Customer is required."),
  billingAddress: z.string().min(1, "Billing Address is required."),
  shippingAddress: z.string().min(1, "Shipping Address is required."),
  saleDate: z.date({ required_error: "Sale Date is required." }),
  salesperson: z.string().min(1, "Salesperson is required."),
  lineItems: z.array(SaleLineItemSchema).min(1, "At least one line item is required."),
  taxType: z.enum(quoteTaxTypes).default("Default"),
  comments: z.string().optional(),
  privateComments: z.string().optional(),
  subtotal: z.number().optional(),
  totalDiscountAmount: z.number().optional(),
  totalTaxAmount: z.number().optional(),
  totalAmount: z.number().optional(),
  showItemCodeColumn: z.boolean().optional().default(true),
  showDiscountColumn: z.boolean().optional().default(true),
  showTaxColumn: z.boolean().optional().default(true),
});
export type SaleFormValues = z.infer<typeof SaleSchema>;
// --- END Sale Types ---

// --- Invoice Types ---
export const invoiceStatusOptions = ["Draft", "Sent", "Paid", "Partial", "Overdue", "Void", "Refunded"] as const;
export type InvoiceStatus = typeof invoiceStatusOptions[number];

export const InvoiceLineItemSchema = z.object({ // Same as QuoteLineItemSchema for now
  itemId: z.string().min(1, "Item selection is required."),
  itemCode: z.string().optional(),
  description: z.string().optional(),
  qty: z.string().min(1, "Qty is required.").refine(val => !isNaN(parseFloat(val)) && parseFloat(val) > 0, { message: "Qty must be > 0" }),
  unitPrice: z.string().min(1, "Unit Price is required.").refine(val => !isNaN(parseFloat(val)) && parseFloat(val) >= 0, { message: "Unit Price must be non-negative" }),
  discountPercentage: z.string().optional().refine(val => val === '' || val === undefined || (!isNaN(parseFloat(val)) && parseFloat(val) >= 0 && parseFloat(val) <= 100), { message: "Discount must be 0-100 or blank" }),
  taxPercentage: z.string().optional().refine(val => val === '' || val === undefined || (!isNaN(parseFloat(val)) && parseFloat(val) >= 0 && parseFloat(val) <= 100), { message: "Tax must be 0-100 or blank" }),
  total: z.string(),
});
export type InvoiceLineItemFormValues = z.infer<typeof InvoiceLineItemSchema>;

export const InvoiceSchema = z.object({
  customerId: z.string().min(1, "Customer is required."),
  billingAddress: z.string().min(1, "Billing Address is required."),
  shippingAddress: z.string().min(1, "Shipping Address is required."),
  invoiceDate: z.date({ required_error: "Invoice Date is required." }), // Changed from quoteDate
  dueDate: z.date().optional(), // Added for invoices
  paymentTerms: z.string().optional(), // Added for invoices
  salesperson: z.string().min(1, "Salesperson is required."),
  subject: z.string().optional(),
  lineItems: z.array(InvoiceLineItemSchema).min(1, "At least one line item is required."),
  taxType: z.enum(quoteTaxTypes).default("Default"), // Reusing quoteTaxTypes for now
  comments: z.string().optional(),
  privateComments: z.string().optional(),
  subtotal: z.number().optional(),
  totalDiscountAmount: z.number().optional(),
  totalTaxAmount: z.number().optional(),
  totalAmount: z.number().optional(),
  status: z.enum(invoiceStatusOptions).optional(),
  amountPaid: z.number().optional(),
  showItemCodeColumn: z.boolean().optional().default(true),
  showDiscountColumn: z.boolean().optional().default(true),
  showTaxColumn: z.boolean().optional().default(true),
  convertedFromQuoteId: z.string().optional(),
});
export type InvoiceFormValues = z.infer<typeof InvoiceSchema>;

export interface InvoiceDocument {
  id: string; // This will store the formatted INV{Year}-{Serial}
  customerId: string;
  customerName: string;
  billingAddress: string;
  shippingAddress: string;
  invoiceDate: string; // ISO string
  dueDate?: string; // ISO string, optional
  paymentTerms?: string;
  salesperson: string;
  subject?: string;
  lineItems: InvoiceLineItemDocument[];
  taxType: QuoteTaxType;
  comments?: string;
  privateComments?: string;
  subtotal: number;
  totalDiscountAmount: number;
  totalTaxAmount: number;
  totalAmount: number;
  status?: InvoiceStatus;
  amountPaid?: number;
  refundReason?: string;
  refundDate?: string; // ISO string
  createdAt: any;
  updatedAt: any;
  showItemCodeColumn?: boolean;
  showDiscountColumn?: boolean;
  showTaxColumn?: boolean;
  convertedFromQuoteId?: string;
}
// --- END Invoice Types ---

// --- Order Types ---
export const orderStatusOptions = ["Pending", "Processing", "Shipped", "Delivered", "Completed", "Cancelled", "On Hold"] as const;
export type OrderStatus = typeof orderStatusOptions[number];

export const OrderLineItemSchema = z.object({ // Same as Quote/Invoice LineItemSchema for now
  itemId: z.string().min(1, "Item selection is required."),
  itemCode: z.string().optional(),
  description: z.string().optional(),
  qty: z.string().min(1, "Qty is required.").refine(val => !isNaN(parseFloat(val)) && parseFloat(val) > 0, { message: "Qty must be > 0" }),
  unitPrice: z.string().min(1, "Unit Price is required.").refine(val => !isNaN(parseFloat(val)) && parseFloat(val) >= 0, { message: "Unit Price must be non-negative" }),
  discountPercentage: z.string().optional().refine(val => val === '' || val === undefined || (!isNaN(parseFloat(val)) && parseFloat(val) >= 0 && parseFloat(val) <= 100), { message: "Discount must be 0-100 or blank" }),
  taxPercentage: z.string().optional().refine(val => val === '' || val === undefined || (!isNaN(parseFloat(val)) && parseFloat(val) >= 0 && parseFloat(val) <= 100), { message: "Tax must be 0-100 or blank" }),
  total: z.string(),
});
export type OrderLineItemFormValues = z.infer<typeof OrderLineItemSchema>;

export const OrderSchema = z.object({
  beneficiaryId: z.string().min(1, "Beneficiary is required."), // Changed from customerId
  billingAddress: z.string().min(1, "Billing Address is required."),
  shippingAddress: z.string().min(1, "Shipping Address is required."),
  orderDate: z.date({ required_error: "Order Date is required." }),
  salesperson: z.string().min(1, "Salesperson is required."),
  lineItems: z.array(OrderLineItemSchema).min(1, "At least one line item is required."),
  taxType: z.enum(quoteTaxTypes).default("Default"), // Reusing quoteTaxTypes
  comments: z.string().optional(),
  privateComments: z.string().optional(),
  subtotal: z.number().optional(),
  totalDiscountAmount: z.number().optional(),
  totalTaxAmount: z.number().optional(),
  totalAmount: z.number().optional(),
  showItemCodeColumn: z.boolean().optional().default(true),
  showDiscountColumn: z.boolean().optional().default(true),
  showTaxColumn: z.boolean().optional().default(true),
});
export type OrderFormValues = z.infer<typeof OrderSchema>;

export interface OrderLineItemDocument { // Same as Quote/Invoice LineItemDocument
  itemId: string;
  itemName: string;
  itemCode?: string;
  description?: string;
  qty: number;
  unitPrice: number;
  discountPercentage?: number;
  taxPercentage?: number;
  total: number;
}

export interface OrderDocument {
  id: string; // This will store the formatted ORD{Year}-{Serial}
  beneficiaryId: string; // Changed from customerId
  beneficiaryName: string; // Changed from customerName
  billingAddress: string;
  shippingAddress: string;
  orderDate: string; // ISO string
  salesperson: string;
  lineItems: OrderLineItemDocument[];
  taxType: QuoteTaxType;
  comments?: string;
  privateComments?: string;
  subtotal: number;
  totalDiscountAmount: number;
  totalTaxAmount: number;
  totalAmount: number;
  status: OrderStatus;
  createdAt: any;
  updatedAt: any;
  showItemCodeColumn?: boolean;
  showDiscountColumn?: boolean;
  showTaxColumn?: boolean;
}
// --- END Order Types ---

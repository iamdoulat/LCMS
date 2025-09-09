

import { z } from 'zod';
import type { Timestamp } from 'firebase/firestore';

export const termsOfPayOptions = [
  "T/T In Advance",
  "L/C AT SIGHT",
  "UPAS",
  "Deferred 60days",
  "Deferred 120days",
  "Deferred 180days",
  "Deferred 360days",
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

// Updated getValidOption function to correctly handle types and undefined values
export function getValidOption<T extends string>(
  value: T | undefined,
  options: readonly T[],
  fallback: T
): T {
  if (typeof value === "string" && options.includes(value)) {
    return value;
  }
  return fallback;
}


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
  shipmentTerms?: PIShipmentMode;
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
  shipmentTerms: z.enum(["CFR CHATTOGRAM", "CPT DHAKA", "FOB", "EXW"]).optional(),
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
  shipmentTerms?: PIShipmentMode;
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

export const userRoles = ["Super Admin", "Admin", "User", "Service", "DemoManager", "Accounts", "Viewer", "Commercial"] as const;
export type UserRole = typeof userRoles[number];

export const NoticeBoardSettingsSchema = z.object({
  title: z.string().min(1, "Notice title cannot be empty."),
  content: z.string().min(1, "Notice content cannot be empty."),
  isEnabled: z.boolean().default(false),
  isPopupEnabled: z.boolean().default(true),
  targetRoles: z.array(z.enum(userRoles)).min(1, "At least one target role must be selected."),
});

export type NoticeBoardSettings = z.infer<typeof NoticeBoardSettingsSchema> & {
  updatedAt?: Timestamp;
};


export interface CompanyProfile {
  companyName?: string;
  address?: string;
  emailId?: string;
  cellNumber?: string;
  invoiceLogoUrl?: string;
  companyLogoUrl?: string;
  hideCompanyName?: boolean;
  updatedAt?: any;
}

export interface UserDocumentForAdmin {
  id: string; // Firestore document ID
  uid?: string; // Firebase Auth UID (if linked)
  displayName: string;
  email: string;
  contactNumber?: string;
  role: UserRole[]; // Changed to an array of roles
  photoURL?: string;
  disabled?: boolean;
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

// --- Extract Shipping Data Types ---
export const ExtractShippingDataInputSchema = z.object({
  documentDataUri: z
    .string()
    .describe(
      "A shipping document (PI, etc.) as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type ExtractShippingDataInput = z.infer<typeof ExtractShippingDataInputSchema>;

export const ExtractShippingDataOutputSchema = z.object({
  etd: z.string().describe('The Estimated Time of Departure.'),
  eta: z.string().describe('The Estimated Time of Arrival.'),
  itemDescriptions: z.string().describe('A description of the items being shipped.'),
});
export type ExtractShippingDataOutput = z.infer<typeof ExtractShippingDataOutputSchema>;
// --- END Extract Shipping Data Types ---


// --- Proforma Invoice Types ---
export const freightChargeOptions = ["Freight Included", "Freight Excluded"] as const;
export type FreightChargeOption = typeof freightChargeOptions[number];
export const piShipmentModeOptions = ["CFR CHATTOGRAM", "CPT DHAKA", "FOB", "EXW"] as const;
export type PIShipmentMode = typeof piShipmentModeOptions[number];

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
  shipmentMode?: PIShipmentMode;
  freightCharges?: number;
  otherCharges?: number;
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
  imageUrl?: string; // For the machine image
}

export type DemoMachineDocument = Omit<DemoMachine, 'id'> & { id: string, createdAt: any, updatedAt: any, machineReturned?: boolean, imageUrl?: string };


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
  challanNo: z.string().optional(),
  deliveryPersonName: z.string().min(1, "Delivery Person Name is required."),
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
  deliveryPersonName: string;
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
  countryOfOrigin?: string; // Added field
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

// --- Quote Item Types ---
// This schema is for items that are used in quotes/invoices and don't need stock management fields.
export const quoteItemSchema = z.object({
  modelNumber: z.string().min(1, "Model Number is required."),
  itemCode: z.string().optional(),
  brandName: z.string().optional(),
  countryOfOrigin: z.string().optional(),
  supplierId: z.string().optional(),
  description: z.string().optional(),
  unit: z.string().optional(),
  salesPrice: z.preprocess(
    (val) => (String(val).trim() === "" ? undefined : Number(String(val).trim())),
    z.number({ invalid_type_error: "Sales Price must be a number." }).nonnegative("Sales Price cannot be negative.").optional()
  ),
});

export type QuoteItemFormValues = z.infer<typeof quoteItemSchema>;
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
  subtotal: z.number().optional(),
  totalDiscountAmount: z.number().optional(),
  totalTaxAmount: z.number().optional(),
  totalAmount: z.number().optional(),
  // Column visibility
  showItemCodeColumn: z.boolean().optional().default(true),
  showDiscountColumn: z.boolean().optional().default(true),
  showTaxColumn: z.boolean().optional().default(true),
  convertedToInvoiceId: z.string().optional(),
  shipmentMode: z.enum(piShipmentModeOptions).optional(),
  freightCharges: z.preprocess(toNumberOrUndefined, z.number().nonnegative().optional()),
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
  shipmentMode?: PIShipmentMode;
  freightCharges?: number;
}
// --- END Quote Types ---

// --- Invoice Types ---
export const invoiceStatusOptions = ["Draft", "Sent", "Paid", "Partial", "Overdue", "Void", "Cancelled", "Refunded"] as const;
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
  invoiceDate: z.date({ required_error: "Invoice Date is required." }),
  dueDate: z.date().optional(),
  paymentTerms: z.string().optional(),
  salesperson: z.string().min(1, "Salesperson is required."),
  subject: z.string().optional(),
  lineItems: z.array(InvoiceLineItemSchema).min(1, "At least one line item is required."),
  taxType: z.enum(quoteTaxTypes).default("Default"),
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
  shipmentMode: z.enum(piShipmentModeOptions).optional(),
  packingCharge: z.preprocess(toNumberOrUndefined, z.number().nonnegative().optional()),
  handlingCharge: z.preprocess(toNumberOrUndefined, z.number().nonnegative().optional()),
  freightCharges: z.preprocess(toNumberOrUndefined, z.number().nonnegative().optional()),
  otherCharges: z.preprocess(toNumberOrUndefined, z.number().nonnegative().optional()),
});
export type InvoiceFormValues = z.infer<typeof InvoiceSchema>;

export interface InvoiceLineItemDocument {
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

export interface InvoiceDocument {
  id: string;
  customerId: string;
  customerName: string;
  billingAddress: string;
  shippingAddress: string;
  invoiceDate: string; // ISO string
  dueDate?: string; // ISO string
  paymentTerms?: string;
  salesperson: string;
  subject?: string;
  lineItems: InvoiceLineItemDocument[];
  taxType: QuoteTaxType;
  comments?: string;
  privateComments?: string;
  packingCharge?: number;
  handlingCharge?: number;
  freightCharges?: number;
  otherCharges?: number;
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
  shipmentMode?: PIShipmentMode;
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
  terms: z.string().optional(),
  shipVia: z.string().optional(),
  portOfLoading: z.string().optional(),
  portOfDischarge: z.string().optional(),
  shipmentMode: z.enum(piShipmentModeOptions).optional(),
  freightCharges: z.preprocess(toNumberOrUndefined, z.number().nonnegative().optional()),
  otherCharges: z.preprocess(toNumberOrUndefined, z.number().nonnegative().optional()),
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
  terms?: string;
  shipVia?: string;
  portOfLoading?: string;
  portOfDischarge?: string;
  shipmentMode?: PIShipmentMode;
  freightCharges?: number;
  otherCharges?: number;
}
// --- END Order Types ---

// --- Sale Types (for sales_invoice collection) ---
export const saleStatusOptions = ["Draft", "Cancelled", "Refunded", "Sent", "Partial", "Paid", "Overdue", "Void"] as const;
export type SaleStatus = (typeof saleStatusOptions)[number];

export const SaleLineItemSchema = z.object({
  itemId: z.string().min(1, "Item selection is required."),
  itemCode: z.string().optional(),
  description: z.string().optional(),
  qty: z.preprocess(
    (val) => (String(val).trim() === "" ? 0 : Number(String(val).trim())),
    z.number().positive("Qty must be > 0")
  ),
  unitPrice: z.preprocess(
    (val) => (String(val).trim() === "" ? 0 : Number(String(val).trim())),
    z.number().nonnegative("Unit Price must be non-negative")
  ),
  discountPercentage: z.preprocess(
    (val) => (String(val).trim() === "" ? 0 : Number(String(val).trim())),
    z.number().min(0).max(100, "Discount must be between 0-100").optional()
  ),
  taxPercentage: z.preprocess(
    (val) => (String(val).trim() === "" ? 0 : Number(String(val).trim())),
    z.number().min(0).max(100, "Tax must be between 0-100").optional()
  ),
  total: z.string(), // This is for display and will be recalculated.
});
export type SaleLineItemFormValues = z.infer<typeof SaleLineItemSchema>;

export const SaleSchema = InvoiceSchema.extend({
    status: z.enum(saleStatusOptions).optional(),
});
export type SaleFormValues = z.infer<typeof SaleSchema>;

export type SaleDocument = Omit<InvoiceDocument, 'status'> & {
    status?: SaleStatus;
};
// --- END Sale Types ---


// --- Petty Cash Types ---
export interface PettyCashAccount {
  id?: string;
  name: string;
  balance: number;
  createdAt?: any;
  updatedAt?: any;
}
export type PettyCashAccountDocument = PettyCashAccount & { id: string };

export interface PettyCashCategory {
  id?: string;
  name: string;
  createdAt?: any;
}
export type PettyCashCategoryDocument = PettyCashCategory & { id: string };

export const transactionTypes = ["Debit", "Credit"] as const;
export type TransactionType = typeof transactionTypes[number];

export const chequeTypeOptions = ["Cash", "Account Pay"] as const;
export type ChequeType = typeof chequeTypeOptions[number];

export interface PettyCashTransaction {
  id?: string;
  transactionDate: string; // ISO string
  accountId: string; 
  accountName: string; // Denormalized name
  type: TransactionType;
  payeeName?: string;
  categoryIds?: string[];
  categoryNames?: string[];
  purpose?: string;
  description?: string;
  amount: number;
  chequeType?: ChequeType;
  chequeNumber?: string;
  connectedSaleId?: string;
  createdBy: string;
  createdAt?: any;
}
export type PettyCashTransactionDocument = PettyCashTransaction & { id: string };

export const PettyCashAccountSchema = z.object({
  name: z.string().min(2, "Account name must be at least 2 characters long."),
  balance: z.preprocess(
    (val) => (String(val).trim() === "" ? undefined : Number(String(val).trim())),
    z.number({ invalid_type_error: "Initial balance must be a number." }).min(0, "Balance cannot be negative.")
  ),
});
export type PettyCashAccountFormValues = z.infer<typeof PettyCashAccountSchema>;

export const PettyCashCategorySchema = z.object({
  name: z.string().min(2, "Category name must be at least 2 characters long."),
});
export type PettyCashCategoryFormValues = z.infer<typeof PettyCashCategorySchema>;

export const PettyCashTransactionSchema = z.object({
  transactionDate: z.date({ required_error: "Transaction date is required." }),
  accountId: z.string().min(1, "A source account is required."),
  type: z.enum(transactionTypes, { required_error: "Transaction Type is required." }),
  payeeName: z.string().min(1, "Payee name is required."),
  categoryIds: z.array(z.string()).min(1, "At least one category is required."),
  purpose: z.string().optional(),
  description: z.string().optional(),
  amount: z.preprocess(
    (val) => (String(val).trim() === "" ? undefined : Number(String(val).trim())),
    z.number({ invalid_type_error: "Amount must be a number." }).positive("Amount must be a positive number.")
  ),
  chequeType: z.enum(chequeTypeOptions).optional(),
  chequeNumber: z.string().optional(),
  connectedSaleId: z.string().optional(),
});
export type PettyCashTransactionFormValues = z.infer<typeof PettyCashTransactionSchema>;
// --- END Petty Cash Types ---


// --- Delivery Challan Types ---
export const DeliveryChallanLineItemSchema = z.object({
  itemId: z.string().optional(), // This can be optional if not linking to specific inventory items
  description: z.string().min(1, "Description is required."),
  qty: z.string().min(1, "Qty is required.").refine(val => !isNaN(parseFloat(val)) && parseFloat(val) > 0, { message: "Qty must be > 0" }),
});
export type DeliveryChallanLineItemFormValues = z.infer<typeof DeliveryChallanLineItemSchema>;

export const DeliveryChallanSchema = z.object({
  customerId: z.string().min(1, "Customer is required."),
  billingAddress: z.string().min(1, "Billing Address is required."),
  shippingAddress: z.string().min(1, "Shipping Address is required."),
  challanDate: z.date({ required_error: "Challan Date is required." }),
  linkedInvoiceId: z.string().optional(),
  deliveryPerson: z.string().min(1, "Delivery Person is required."),
  vehicleNo: z.string().optional(),
  lineItems: z.array(DeliveryChallanLineItemSchema).min(1, "At least one item is required."),
});
export type DeliveryChallanFormValues = z.infer<typeof DeliveryChallanSchema>;

export interface DeliveryChallanLineItemDocument {
  itemId?: string;
  description: string;
  qty: number;
}

export interface DeliveryChallanDocument {
  id: string; // Auto-generated ID like DCN{Year}-{Serial}
  customerId: string;
  customerName: string; // Denormalized
  billingAddress: string;
  shippingAddress: string;
  challanDate: string; // ISO string
  linkedInvoiceId?: string;
  deliveryPerson: string;
  vehicleNo?: string;
  lineItems: DeliveryChallanLineItemDocument[];
  createdAt: any; // Firestore ServerTimestamp
  updatedAt: any; // Firestore ServerTimestamp
}
// --- END Delivery Challan Types ---

// --- Demo Machine Challan Types ---
export const DemoChallanLineItemSchema = z.object({
  demoMachineId: z.string().min(1, "Machine Model is required."),
  description: z.string().min(1, "Description is required."),
  qty: z.string().refine(val => !isNaN(parseFloat(val)) && parseFloat(val) > 0, { message: "Qty must be > 0" }),
});
export type DemoChallanLineItemFormValues = z.infer<typeof DemoChallanLineItemSchema>;

export const DemoChallanSchema = z.object({
  factoryId: z.string().min(1, "Factory is required."),
  deliveryAddress: z.string().min(1, "Delivery Address is required."),
  challanDate: z.date({ required_error: "Challan Date is required." }),
  linkedApplicationId: z.string().optional(),
  deliveryPerson: z.string().min(1, "Delivery Person is required."),
  vehicleNo: z.string().optional(),
  lineItems: z.array(DemoChallanLineItemSchema).min(1, "At least one item is required."),
});
export type DemoChallanFormValues = z.infer<typeof DemoChallanSchema>;

export interface DemoChallanLineItemDocument {
  demoMachineId: string;
  description: string;
  qty: number;
}

export interface DemoChallanDocument {
  id: string; // Auto-generated ID like DMCN{Year}-{Serial}
  factoryId: string;
  factoryName: string; // Denormalized
  deliveryAddress: string;
  challanDate: string; // ISO string
  linkedApplicationId?: string;
  deliveryPerson: string;
  vehicleNo?: string;
  lineItems: DemoChallanLineItemDocument[];
  createdAt: any; // Firestore ServerTimestamp
  updatedAt: any; // Firestore ServerTimestamp
}
// --- END Demo Machine Challan Types ---

// --- Claim Report Types ---
export const claimStatusOptions = ["Pending", "Rejected", "Complete"] as const;
export type ClaimStatus = typeof claimStatusOptions[number];

export const ClaimReportSchema = z.object({
    customerId: z.string().min(1, "Customer name is required."),
    supplierId: z.string().min(1, "Supplier name is required."),
    claimNumber: z.string().min(1, "Claim number is required."),
    claimDate: z.date({ required_error: "Claim date is required." }),
    invoiceId: z.string().min(1, "Invoice selection is required."),
    claimQty: z.preprocess(
        (val) => (String(val).trim() === "" ? undefined : Number(String(val).trim())),
        z.number({ invalid_type_error: "Claim Qty must be a number" }).positive("Claim Qty must be positive.")
    ),
    partialReceivedQty: z.preprocess(
        (val) => (String(val).trim() === "" ? undefined : Number(String(val).trim())),
        z.number({ invalid_type_error: "Received Qty must be a number." }).nonnegative("Received Qty cannot be negative.").optional()
    ),
    emailsViewUrl: z.string().url("Invalid URL format.").optional().or(z.literal('')),
    claimReportUrl: z.string().url("Invalid URL format.").optional().or(z.literal('')),
    preparedBy: z.string().min(1, "Prepared by is required."),
    emailResentCount: z.preprocess(
        (val) => (String(val).trim() === "" ? undefined : Number(String(val).trim())),
        z.number({ invalid_type_error: "Count must be a number." }).int().nonnegative("Count must be a non-negative integer.").optional()
    ),
    status: z.enum(claimStatusOptions, { required_error: "Status is required." }),
    claimDescription: z.string().optional(),
    supplierComments: z.string().optional(),
});
export type ClaimReportFormValues = z.infer<typeof ClaimReportSchema>;

export interface ClaimReportDocument {
  id: string;
  customerId: string;
  customerName: string;
  supplierId: string;
  supplierName: string;
  claimNumber: string;
  claimDate: string; // ISO String
  invoiceId: string;
  claimQty: number;
  partialReceivedQty: number;
  pendingQty: number;
  emailsViewUrl?: string;
  claimReportUrl?: string;
  preparedBy: string;
  emailResentCount: number;
  status: ClaimStatus;
  claimDescription?: string;
  supplierComments?: string;
  createdAt: any;
  updatedAt: any;
}
// --- END Claim Report Types ---

// --- Employee Types ---
export const educationLevelOptions = ["SSC", "HSC", "Diploma", "Bachelors", "Masters", "PhD"] as const;
export const gradeDivisionOptions = ["1st Division", "2nd Division", "3rd Division", "A+", "A", "A-", "B", "C", "D"] as const;
export const bankNameOptions = [
  "AB Bank", "Agrani Bank", "Al-Arafah Islami Bank", "Bangladesh Commerce Bank", "Bangladesh Development Bank", 
  "Bank Al-Falah", "Bank Asia", "BRAC Bank", "Citibank NA", "City Bank", "Commercial Bank of Ceylon", 
  "Community Bank Bangladesh", "Dhaka Bank", "Dutch-Bangla Bank", "Eastern Bank", "EXIM Bank", 
  "First Security Islami Bank", "Habib Bank", "ICB Islamic Bank", "IFIC Bank", "Islami Bank Bangladesh", 
  "Jamuna Bank", "Janata Bank", "Meghna Bank", "Mercantile Bank", "Midland Bank", "Modhumoti Bank", 
  "Mutual Trust Bank", "National Bank", "National Credit and Commerce Bank", "NRB Bank", "NRB Commercial Bank", 
  "One Bank", "Padma Bank", "Premier Bank", "Prime Bank", "Pubali Bank", "Rupali Bank", "Shahjalal Islami Bank", 
  "Social Islami Bank", "Sonali Bank", "Southeast Bank", "Standard Bank", "Standard Chartered Bank", 
  "State Bank of India", "Trust Bank", "United Commercial Bank", "Uttara Bank", "Woori Bank"
] as const;
export const paymentFrequencyOptions = ["Monthly", "Weekly", "Bi-Weekly", "Annually"] as const;
export const salaryBreakupOptions = ["Basic", "House Rent", "Entertainment", "Medical Allowance", "Conveyance Allowance", "Utility", "Transportation", "Food Allowance", "Cash"];


export const BankSchema = z.object({
  id: z.string().optional(),
  bankName: z.enum(bankNameOptions, { required_error: "Bank Name is required." }),
  accountNo: z.string().min(1, "Account Number is required."),
  accountRoutingNo: z.string().optional(),
  accountName: z.string().min(1, "Account Holder's Name is required."),
  remarks: z.string().optional(),
});
export type BankDetails = z.infer<typeof BankSchema>;


export const EducationSchema = z.object({
  id: z.string().optional(), // For key in React
  education: z.enum(educationLevelOptions, { required_error: "Education level is required." }),
  gradeDivision: z.enum(gradeDivisionOptions, { required_error: "Grade/Division is required." }),
  passedYear: z.string().min(4, "Passed Year is required.").max(4, "Invalid year."),
  scale: z.preprocess(toNumberOrUndefined, z.number().positive().optional()),
  cgpa: z.preprocess(toNumberOrUndefined, z.number().nonnegative().optional()),
  instituteName: z.string().min(1, "Institute Name is required."),
  foreignDegree: z.boolean().default(false).optional(),
  professional: z.boolean().default(false).optional(),
  lastEducation: z.boolean().default(false).optional(),
});
export type Education = z.infer<typeof EducationSchema>;


export const SalaryBreakupSchema = z.object({
  id: z.string().optional(),
  breakupName: z.string().min(1, "Breakup name is required."),
  amount: z.preprocess(toNumberOrUndefined, z.number().nonnegative("Amount must be non-negative").optional()),
  increaseAmount: z.preprocess(toNumberOrUndefined, z.number().nonnegative("Increase amount must be non-negative").optional()),
});
export type SalaryBreakup = z.infer<typeof SalaryBreakupSchema>;

export const employeeStatusOptions = ["Active", "On Leave", "Terminated"] as const;
export type EmployeeStatus = (typeof employeeStatusOptions)[number];

export const genderOptions = ["Male", "Female", "Other"] as const;
export const maritalStatusOptions = ["Single", "Married", "Divorced", "Widowed"] as const;
export const bloodGroupOptions = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;

export const jobStatusOptions = ["Active", "Inactive", "On Probation", "Resigned"] as const;
export const jobBaseOptions = ["Permanent", "Contractual", "Intern"] as const;

const AddressSchema = z.object({
  address: z.string().optional(),
  country: z.string().optional(),
  state: z.string().optional(),
  city: z.string().optional(),
  zipCode: z.string().optional(),
});

export const EmployeeSchema = z.object({
  employeeCode: z.string().min(1, "Employee Code is required."),
  firstName: z.string().min(1, "First Name is required."),
  middleName: z.string().optional(),
  lastName: z.string().min(1, "Last Name is required."),
  email: z.string().email("Invalid email address."),
  phone: z.string().min(1, "Phone number is required."),
  gender: z.enum(genderOptions, { required_error: "Gender is required." }),
  dateOfBirth: z.date({ required_error: "Date of Birth is required." }),
  joinedDate: z.date({ required_error: "Joined Date is required." }),
  designation: z.string().min(1, "Designation is required"),
  maritalStatus: z.enum(maritalStatusOptions).optional(),
  nationality: z.string().optional(),
  religion: z.string().optional(),
  nationalId: z.string().optional(),
  bloodGroup: z.enum(bloodGroupOptions).optional(),
  photoURL: z.string().url().optional().or(z.literal('')),
  status: z.enum(employeeStatusOptions).default('Active'),
  // New Fields
  division: z.string().optional(),
  branch: z.string().optional(),
  department: z.string().optional(),
  unit: z.string().optional(),
  effectiveDate: z.date().optional(),
  remarksDivision: z.string().optional(),
  jobStatus: z.enum(jobStatusOptions).optional(),
  jobStatusEffectiveDate: z.date().optional(),
  remarksJobBase: z.string().optional(),
  jobBase: z.enum(jobBaseOptions).optional(),
  jobBaseEffectiveDate: z.date().optional(),
  educationDetails: z.array(EducationSchema).optional(),
  presentAddress: AddressSchema.optional(),
  permanentAddress: AddressSchema.optional(),
  sameAsPresentAddress: z.boolean().optional(),
  bankDetails: z.array(BankSchema).optional(),
  salaryStructure: z.object({
    isConsolidate: z.boolean().default(false),
    paymentType: z.enum(["Bank", "Cash"]).optional(),
    structureDate: z.date().optional(),
    paymentFrequency: z.string().optional(),
    salaryBreakup: z.array(SalaryBreakupSchema).optional(),
  }).optional(),
});

export type EmployeeFormValues = z.infer<typeof EmployeeSchema>;

export interface Employee {
  id: string;
  employeeCode: string;
  fullName: string;
  email: string;
  phone: string;
  dateOfBirth: string; // ISO string
  joinedDate: string; // ISO string
  designation: string;
  gender: (typeof genderOptions)[number];
  maritalStatus?: (typeof maritalStatusOptions)[number];
  nationality?: string;
  religion?: string;
  nationalId?: string;
  bloodGroup?: (typeof bloodGroupOptions)[number];
  photoURL?: string;
  status?: EmployeeStatus;
  createdAt?: any;
  updatedAt?: any;
  // New Fields
  division?: string;
  branch?: string;
  department?: string;
  unit?: string;
  remarksDivision?: string;
  jobStatus?: (typeof jobStatusOptions)[number];
  jobStatusEffectiveDate?: string; // ISO string
  remarksJobBase?: string;
  jobBase?: (typeof jobBaseOptions)[number];
  jobBaseEffectiveDate?: string; // ISO string
  educationDetails?: Education[];
  presentAddress?: z.infer<typeof AddressSchema>;
  permanentAddress?: z.infer<typeof AddressSchema>;
  bankDetails?: BankDetails[];
  salaryStructure?: {
    isConsolidate: boolean;
    paymentType?: "Bank" | "Cash";
    structureDate?: string; // ISO string
    paymentFrequency?: string;
    salaryBreakup?: SalaryBreakup[];
  };
}

export type EmployeeDocument = Employee;

export const BranchSchema = z.object({
  name: z.string().min(2, "Branch name must be at least 2 characters long."),
});
export type BranchFormValues = z.infer<typeof BranchSchema>;
export interface BranchDocument {
  id: string;
  name: string;
  createdAt: any;
}

export const DepartmentSchema = z.object({
  name: z.string().min(2, "Department name must be at least 2 characters long."),
});
export type DepartmentFormValues = z.infer<typeof DepartmentSchema>;
export interface DepartmentDocument {
  id: string;
  name: string;
  createdAt: any;
}

export const UnitSchema = z.object({
  name: z.string().min(2, "Unit name must be at least 2 characters long."),
});
export type UnitFormValues = z.infer<typeof UnitSchema>;
export interface UnitDocument {
  id: string;
  name: string;
  createdAt: any;
}

export const DesignationSchema = z.object({
  name: z.string().min(2, "Designation name must be at least 2 characters long."),
});
export type DesignationFormValues = z.infer<typeof DesignationSchema>;

export interface DesignationDocument {
  id: string;
  name: string;
  createdAt: any;
}

export const DivisionSchema = z.object({
  name: z.string().min(2, "Division name must be at least 2 characters long."),
});
export type DivisionFormValues = z.infer<typeof DivisionSchema>;

export interface DivisionDocument {
  id: string;
  name: string;
  createdAt: any;
}
// --- END Employee Types ---

// --- Payroll Types ---
export interface Payroll {
    id: string; // e.g., PAYROLL-2024-08
    month: string;
    year: number;
    generationDate: any; // Timestamp
    generatedBy: string;
    totalEmployees: number;
    totalGrossSalary: number;
    totalDeductions: number;
    totalNetSalary: number;
    status: 'Generated' | 'Approved' | 'Paid';
}

export interface Payslip {
    id: string; // e.g., PAYSLIP-2024-08-EMP123
    payrollId: string;
    employeeId: string;
    employeeName: string; // Denormalized
    employeeCode: string; // Denormalized
    designation: string; // Denormalized
    payPeriod: string; // "August, 2024"
    grossSalary: number;
    // Breakdowns
    basicSalary?: number;
    houseRent?: number;
    medicalAllowance?: number;
    // ... other earnings
    // Deductions
    taxDeduction?: number;
    providentFund?: number;
    leaveDeduction?: number;
    // ... other deductions
    totalDeductions: number;
    netSalary: number;
    createdAt?: any; // Timestamp
    updatedAt?: any; // Timestamp
    paymentDate?: any; // Timestamp
    paymentMethod?: string;
}
// --- END Payroll Types ---




import { z } from 'zod';

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
  finalLcUrl?: string;
  shippingDocumentsUrl?: string;
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
  notifyPartyName?: string; // Contact Person Name
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
  finalLcUrl?: string;
  shippingDocumentsUrl?: string;
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
  notifyPartyName?: string; // Contact Person Name
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
  billOfExchangeQty?: number | '';
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
  connectedLcIssueDate?: string; // ISO string
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
}


// --- Installation Report Types ---
export const InstallationDetailItemSchema = z.object({
  slNo: z.string().optional(),
  machineModel: z.string().min(1, "Machine Model is required."),
  serialNo: z.string().min(1, "Machine Serial No. is required."),
  ctlBoxModel: z.string().min(1, "Ctl. Box Model is required."),
  ctlBoxSerial: z.string().min(1, "Ctl. Box Serial is required."),
  installDate: z.date({ required_error: "Installation Date is required." }),
});
export type InstallationDetailItemType = z.infer<typeof InstallationDetailItemSchema>;


export const InstallationReportSchema = z.object({
  applicantId: z.string().min(1, "Applicant Name is required."),
  beneficiaryId: z.string().min(1, "Beneficiary Name is required."),
  selectedCommercialInvoiceLcId: z.string().optional(),
  documentaryCreditNumber: z.string().optional(),
  totalMachineQtyFromLC: z.preprocess(toNumberOrUndefined, z.number().int().positive("Qty must be positive").optional()),
  proformaInvoiceNumber: z.string().optional(),
  invoiceDate: z.date().nullable().optional(),
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
    .refine(items => {
      const seenSerials = new Set<string>();
      for (const item of items) {
        const combinedSerial = `${(item.serialNo || '').trim()}-${(item.ctlBoxSerial || '').trim()}`;
        if ((item.serialNo && item.serialNo.trim() !== "") || (item.ctlBoxSerial && item.ctlBoxSerial.trim() !== "")) { // Only check if at least one is not empty
          if (seenSerials.has(combinedSerial)) {
            return false; // Found a duplicate combination
          }
          seenSerials.add(combinedSerial);
        }
      }
      return true;
    }, {
      message: "Each combination of Machine Serial No. and Ctl. Box Serial must be unique within this report. Please check for duplicates if both are entered.",
      // Path for error reporting. We can't easily point to specific duplicate items here,
      // so the error will be associated with the 'installationDetails' array itself.
      path: ["installationDetails"], 
    }),
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
  documentaryCreditNumber?: string;
  totalMachineQtyFromLC?: number;
  proformaInvoiceNumber?: string;
  invoiceDate?: string; // ISO string
  etdDate?: string; // ISO string
  etaDate?: string; // ISO string
  packingListUrl?: string;
  technicianName: string;
  reportingEngineerName: string;
  installationDetails: Array<Omit<InstallationDetailItemType, 'installDate'> & { installDate: string }>;
  totalInstalledQty: number;
  pendingQty: number | string;
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
  lcData: LCEntryDocument & { id: string }; // Full L/C document data
}

// --- END Installation Report Types ---

    
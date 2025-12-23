
"use client";

import * as React from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Swal from 'sweetalert2';
import { format, parseISO, isValid } from 'date-fns';
import { firestore } from '@/lib/firebase/config';
import { collection, addDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import type { ProformaInvoiceDocument, ProformaInvoiceLineItem, FreightChargeOption, CustomerDocument, SupplierDocument, LcOption, LCEntryDocument } from '@/types';
import { freightChargeOptions } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { DatePickerField } from './DatePickerField';
import { Loader2, PlusCircle, Trash2, Users, Building, FileText, CalendarDays, User, DollarSign, Hash, Percent, Ship, Link2, MinusCircle, ExternalLink, Link as LinkIcon } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';


const lineItemFormSchema = z.object({
  slNo: z.string().optional(),
  modelNo: z.string().min(1, "Model No. is required"),
  qty: z.string().min(1, "Qty is required").refine(val => !isNaN(parseFloat(val)) && parseFloat(val) > 0, { message: "Qty must be > 0" }),
  purchasePrice: z.string().min(1, "Purchase Price is required").refine(val => !isNaN(parseFloat(val)) && parseFloat(val) >= 0, { message: "Purchase Price must be >= 0" }),
  salesPrice: z.string().min(1, "Sales Price is required").refine(val => !isNaN(parseFloat(val)) && parseFloat(val) >= 0, { message: "Sales Price must be >= 0" }),
  netCommissionPercentage: z.string().optional().refine(
    (val) => val === '' || val === undefined ||
             (!isNaN(parseFloat(val)) && parseFloat(val) >= 0 && parseFloat(val) <= 100),
    { message: "Net Com.% must be 0-100 or blank" }
  ),
});

const proformaInvoiceSchema = z.object({
  beneficiaryId: z.string().min(1, "Beneficiary is required"),
  applicantId: z.string().min(1, "Applicant is required"),
  piNo: z.string().min(1, "PI No. is required"),
  piDate: z.date({ required_error: "PI Date is required" }),
  salesPersonName: z.string().min(1, "Sales Person Name is required"),
  connectedLcId: z.string().optional(),
  purchaseOrderUrl: z.preprocess(
    (val) => (String(val).trim() === "" ? undefined : String(val).trim()),
    z.string().url({ message: "Invalid URL format" }).optional()
  ),
  lineItems: z.array(lineItemFormSchema).min(1, "At least one line item is required."),
  freightChargeOption: z.enum(freightChargeOptions, { required_error: "Freight Charge option is required" }),
  freightChargeAmount: z.string().optional().refine(val => val === '' || val === undefined || (!isNaN(parseFloat(val)) && parseFloat(val) >= 0), { message: "Freight Amount must be a non-negative number if provided." }),
  miscellaneousExpenses: z.string().optional().refine(val => val === '' || val === undefined || (!isNaN(parseFloat(val)) && parseFloat(val) >= 0), { message: "Misc. Expenses must be non-negative if provided."}),
}).refine(data => {
    if (data.freightChargeOption === "Freight Excluded") {
        const amount = parseFloat(data.freightChargeAmount || '0');
        return !isNaN(amount) && amount >= 0;
    }
    return true;
}, {
    message: "Freight Amount is required and must be non-negative if 'Excluded'",
    path: ["freightChargeAmount"],
});

type ProformaInvoiceFormValues = z.infer<typeof proformaInvoiceSchema>;

const sectionHeadingClass = "font-bold text-xl lg:text-2xl bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out border-b pb-2 mb-4 flex items-center";

const PLACEHOLDER_BENEFICIARY_VALUE = "__PI_ADD_BENEFICIARY_PLACEHOLDER__";
const PLACEHOLDER_APPLICANT_VALUE = "__PI_ADD_APPLICANT_PLACEHOLDER__";
const NONE_LC_VALUE = "__NONE_LC_PI_ADD__";


export function AddProformaInvoiceForm() {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [applicantOptions, setApplicantOptions] = React.useState<ComboboxOption[]>([]);
  const [beneficiaryOptions, setBeneficiaryOptions] = React.useState<ComboboxOption[]>([]);
  const [lcOptions, setLcOptions] = React.useState<LcOption[]>([]);
  const [isLoadingDropdowns, setIsLoadingDropdowns] = React.useState(true);
  const [selectedLcIssueDate, setSelectedLcIssueDate] = React.useState<string | null>(null);

  const [totalQty, setTotalQty] = React.useState(0);
  const [totalPurchasePriceAmount, setTotalPurchasePriceAmount] = React.useState(0);
  const [totalSalesPriceFromLineItems, setTotalSalesPriceFromLineItems] = React.useState(0);
  const [totalExtraNetCommission, setTotalExtraNetCommission] = React.useState(0);
  const [grandTotalSalesPrice, setGrandTotalSalesPrice] = React.useState(0);
  const [grandTotalCommissionUSD, setGrandTotalCommissionUSD] = React.useState(0);
  const [totalCommissionPercentage, setTotalCommissionPercentage] = React.useState(0);

  const form = useForm<ProformaInvoiceFormValues>({
    resolver: zodResolver(proformaInvoiceSchema),
    defaultValues: {
      beneficiaryId: '',
      applicantId: '',
      piNo: '',
      piDate: new Date(),
      salesPersonName: '',
      connectedLcId: '',
      purchaseOrderUrl: '',
      lineItems: [{ slNo: '1', modelNo: '', qty: '', purchasePrice: '', salesPrice: '', netCommissionPercentage: '' }],
      freightChargeOption: "Freight Included",
      freightChargeAmount: '',
      miscellaneousExpenses: '',
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "lineItems",
  });

  React.useEffect(() => {
    const fetchOptions = async () => {
      setIsLoadingDropdowns(true);
      try {
        const [customersSnap, suppliersSnap, lcsSnap] = await Promise.all([
          getDocs(collection(firestore, "customers")),
          getDocs(collection(firestore, "suppliers")),
          getDocs(collection(firestore, "lc_entries"))
        ]);

        setApplicantOptions(
          customersSnap.docs.map(doc => ({ value: doc.id, label: (doc.data() as CustomerDocument).applicantName || 'Unnamed Applicant' }))
        );
        setBeneficiaryOptions(
          suppliersSnap.docs.map(doc => ({ value: doc.id, label: (doc.data() as SupplierDocument).beneficiaryName || 'Unnamed Beneficiary' }))
        );
        
        const fetchedLcOptions: LcOption[] = [{ value: NONE_LC_VALUE, label: "None", issueDate: undefined, purchaseOrderUrl: undefined }];
        lcsSnap.forEach(doc => {
          const data = doc.data() as LCEntryDocument;
          fetchedLcOptions.push({ 
            value: doc.id, 
            label: data.documentaryCreditNumber || 'Unnamed L/C', 
            issueDate: data.lcIssueDate,
            purchaseOrderUrl: data.purchaseOrderUrl 
          });
        });
        setLcOptions(fetchedLcOptions);

      } catch (error) {
        console.error("Error fetching dropdown options for PI form: ", error);
        Swal.fire("Error", "Could not load supporting data. Please try again.", "error");
      } finally {
        setIsLoadingDropdowns(false);
      }
    };
    fetchOptions();
  }, []);

  const watchedConnectedLcId = form.watch("connectedLcId");
  React.useEffect(() => {
    if (watchedConnectedLcId && lcOptions.length > 0 && watchedConnectedLcId !== NONE_LC_VALUE) {
      const selectedLc = lcOptions.find(opt => opt.value === watchedConnectedLcId);
      if (selectedLc) {
        setSelectedLcIssueDate(selectedLc.issueDate && isValid(parseISO(selectedLc.issueDate)) ? format(parseISO(selectedLc.issueDate), 'PPP') : null);
        form.setValue("purchaseOrderUrl", selectedLc.purchaseOrderUrl || '');
      } else {
        setSelectedLcIssueDate(null);
        form.setValue("purchaseOrderUrl", '');
      }
    } else {
        setSelectedLcIssueDate(null);
        form.setValue("purchaseOrderUrl", '');
    }
  }, [watchedConnectedLcId, lcOptions, form, setSelectedLcIssueDate]);

  const watchedLineItems = form.watch("lineItems");
  const watchedFreightOption = form.watch("freightChargeOption");
  const watchedFreightAmountString = form.watch("freightChargeAmount");
  const watchedMiscellaneousExpensesString = form.watch("miscellaneousExpenses");

  React.useEffect(() => {
    let newTotalQty = 0;
    let newTotalPurchase = 0;
    let newTotalSalesLineItems = 0;
    let newTotalExtraNetComm = 0;

    if (Array.isArray(watchedLineItems)) {
        watchedLineItems.forEach(item => {
          const qty = parseFloat(String(item.qty)) || 0;
          const purchaseP = parseFloat(String(item.purchasePrice)) || 0;
          const salesP = parseFloat(String(item.salesPrice)) || 0;
          const netCommP = parseFloat(String(item.netCommissionPercentage || '0')) || 0;

          if (qty > 0) {
            newTotalQty += qty;
            if (purchaseP >= 0) { 
              newTotalPurchase += qty * purchaseP;
              if (netCommP > 0 && netCommP <= 100 && purchaseP > 0) {
                 newTotalExtraNetComm += (qty * purchaseP * netCommP) / 100;
              }
            }
            if (salesP >= 0) newTotalSalesLineItems += qty * salesP;
          }
        });
    }

    setTotalQty(newTotalQty);
    setTotalPurchasePriceAmount(newTotalPurchase);
    setTotalSalesPriceFromLineItems(newTotalSalesLineItems);
    setTotalExtraNetCommission(newTotalExtraNetComm);

    const freightAmountNum = watchedFreightOption === "Freight Excluded" ? (parseFloat(String(watchedFreightAmountString || '0')) || 0) : 0;
    const miscellaneousExpensesNum = parseFloat(String(watchedMiscellaneousExpensesString || '0')) || 0;

    const grossSalesPriceBeforeDeductions = newTotalSalesLineItems + freightAmountNum;
    const currentGrandTotalSalesPrice = grossSalesPriceBeforeDeductions - miscellaneousExpensesNum;
    setGrandTotalSalesPrice(currentGrandTotalSalesPrice);

    // Commission based on sales vs purchase, then add extra net commission
    const baseCommissionUSD = currentGrandTotalSalesPrice - newTotalPurchase;
    const newGrandTotalCommissionUSD = baseCommissionUSD + newTotalExtraNetComm;
    setGrandTotalCommissionUSD(newGrandTotalCommissionUSD);

    if (newTotalPurchase > 0) {
      const commissionPercentage = (newGrandTotalCommissionUSD / newTotalPurchase) * 100;
      setTotalCommissionPercentage(parseFloat(commissionPercentage.toFixed(2)));
    } else {
      setTotalCommissionPercentage(0);
    }
  }, [watchedLineItems, watchedFreightOption, watchedFreightAmountString, watchedMiscellaneousExpensesString]);

  async function onSubmit(data: ProformaInvoiceFormValues) {
    setIsSubmitting(true);

    const finalApplicantId = data.applicantId;
    const finalBeneficiaryId = data.beneficiaryId;
    const finalConnectedLcId = data.connectedLcId === NONE_LC_VALUE ? '' : data.connectedLcId;


    const selectedApplicant = applicantOptions.find(opt => opt.value === finalApplicantId);
    const selectedBeneficiary = beneficiaryOptions.find(opt => opt.value === finalBeneficiaryId);
    const selectedLc = finalConnectedLcId ? lcOptions.find(opt => opt.value === finalConnectedLcId) : undefined;

    let calculatedTotalQty = 0;
    let calculatedTotalPurchasePrice = 0;
    let calculatedTotalSalesPriceLineItems = 0;
    let calculatedTotalExtraNetCommission = 0;

    const processedLineItems = data.lineItems.map(item => {
      const qty = parseFloat(String(item.qty));
      const purchasePrice = parseFloat(String(item.purchasePrice));
      const salesPrice = parseFloat(String(item.salesPrice));
      const netCommP = parseFloat(String(item.netCommissionPercentage || '0'));

      calculatedTotalQty += qty;
      calculatedTotalPurchasePrice += qty * purchasePrice;
      calculatedTotalSalesPriceLineItems += qty * salesPrice;
      if (netCommP > 0 && netCommP <= 100 && purchasePrice > 0) {
          calculatedTotalExtraNetCommission += (qty * purchasePrice * netCommP) / 100;
      }

      const lineItemData: ProformaInvoiceLineItem = {
          modelNo: item.modelNo,
          qty: qty,
          purchasePrice: purchasePrice,
          salesPrice: salesPrice,
      };
      if (item.slNo) lineItemData.slNo = item.slNo;
      if (netCommP > 0) lineItemData.netCommissionPercentage = netCommP;

      return lineItemData;
    });

    const finalFreightAmount = data.freightChargeOption === "Freight Excluded" ? (parseFloat(data.freightChargeAmount || '0') || 0) : 0;
    const finalMiscExpenses = parseFloat(data.miscellaneousExpenses || '0') || 0;

    const grossSalesBeforeDeductions = calculatedTotalSalesPriceLineItems + finalFreightAmount;
    const finalGrandTotalSalesPrice = grossSalesBeforeDeductions - finalMiscExpenses;
    
    const baseCommission = finalGrandTotalSalesPrice - calculatedTotalPurchasePrice;
    const finalGrandTotalCommissionUSD = baseCommission + calculatedTotalExtraNetCommission;

    let finalTotalCommissionPercentage = 0;
    if (calculatedTotalPurchasePrice > 0) {
      finalTotalCommissionPercentage = parseFloat(((finalGrandTotalCommissionUSD / calculatedTotalPurchasePrice) * 100).toFixed(2));
    }

    const dataToSave: Omit<ProformaInvoiceDocument, 'id' | 'createdAt' | 'updatedAt'> = {
      beneficiaryId: finalBeneficiaryId,
      beneficiaryName: selectedBeneficiary?.label || 'N/A',
      applicantId: finalApplicantId,
      applicantName: selectedApplicant?.label || 'N/A',
      piNo: data.piNo,
      piDate: format(data.piDate, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"),
      salesPersonName: data.salesPersonName,
      connectedLcId: finalConnectedLcId || undefined,
      connectedLcNumber: selectedLc?.label === "None" ? undefined : selectedLc?.label,
      connectedLcIssueDate: selectedLc?.issueDate ? format(parseISO(selectedLc.issueDate), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx") : undefined,
      purchaseOrderUrl: data.purchaseOrderUrl || undefined,
      lineItems: processedLineItems,
      freightChargeOption: data.freightChargeOption,
      freightChargeAmount: finalFreightAmount > 0 || data.freightChargeOption === "Freight Excluded" ? finalFreightAmount : undefined,
      miscellaneousExpenses: finalMiscExpenses > 0 ? finalMiscExpenses : undefined,
      totalQty: calculatedTotalQty,
      totalPurchasePrice: calculatedTotalPurchasePrice,
      totalSalesPrice: calculatedTotalSalesPriceLineItems, 
      totalExtraNetCommission: calculatedTotalExtraNetCommission > 0 ? calculatedTotalExtraNetCommission : undefined,
      grandTotalSalesPrice: finalGrandTotalSalesPrice,
      grandTotalCommissionUSD: finalGrandTotalCommissionUSD,
      totalCommissionPercentage: finalTotalCommissionPercentage,
    };

    try {
      const docToSaveInFirestore = {
        ...dataToSave,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      
      Object.keys(docToSaveInFirestore).forEach(key => {
        if (docToSaveInFirestore[key as keyof typeof docToSaveInFirestore] === undefined) {
          delete docToSaveInFirestore[key as keyof typeof docToSaveInFirestore];
        }
      });

      await addDoc(collection(firestore, "proforma_invoices"), docToSaveInFirestore);
      Swal.fire({
        title: "PI Saved!",
        text: "Proforma Invoice has been successfully saved.",
        icon: "success",
        timer: 1000,
        showConfirmButton: false,
      });
      form.reset({
        beneficiaryId: '',
        applicantId: '',
        piNo: '',
        piDate: new Date(),
        salesPersonName: '',
        connectedLcId: '',
        purchaseOrderUrl: '',
        lineItems: [{ slNo: '1', modelNo: '', qty: '', purchasePrice: '', salesPrice: '', netCommissionPercentage: '' }],
        freightChargeOption: "Freight Included",
        freightChargeAmount: '',
        miscellaneousExpenses: '',
      });
      setSelectedLcIssueDate(null);
    } catch (error: any) {
      console.error("Error adding PI document: ", error);
      Swal.fire({
        title: "Save Failed",
        text: `Failed to save PI: ${error.message}`,
        icon: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const handleAddLineItem = () => {
    append({ slNo: (fields.length + 1).toString(), modelNo: '', qty: '', purchasePrice: '', salesPrice: '', netCommissionPercentage: '' });
  };

  const handleViewUrl = (url: string | undefined | null) => {
    if (url && url.trim() !== "") {
      try {
        new URL(url);
        window.open(url, '_blank', 'noopener,noreferrer');
      } catch (e) {
        Swal.fire("Invalid URL", "The provided URL is not valid.", "error");
      }
    } else {
      Swal.fire("No URL", "No URL provided to view.", "info");
    }
  };


  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="beneficiaryId"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center"><Building className="mr-2 h-4 w-4 text-muted-foreground" />Beneficiary Name*</FormLabel>
                 <Combobox
                  options={beneficiaryOptions}
                  value={field.value || PLACEHOLDER_BENEFICIARY_VALUE}
                  onValueChange={(value) => field.onChange(value === PLACEHOLDER_BENEFICIARY_VALUE ? '' : value)}
                  placeholder="Search Beneficiary..."
                  selectPlaceholder={isLoadingDropdowns ? "Loading..." : "Select Beneficiary"}
                  emptyStateMessage="No beneficiary found."
                  disabled={isLoadingDropdowns}
                />
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="applicantId"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center"><Users className="mr-2 h-4 w-4 text-muted-foreground" />Applicant Name*</FormLabel>
                <Combobox
                  options={applicantOptions}
                  value={field.value || PLACEHOLDER_APPLICANT_VALUE}
                  onValueChange={(value) => field.onChange(value === PLACEHOLDER_APPLICANT_VALUE ? '' : value)}
                  placeholder="Search Applicant..."
                  selectPlaceholder={isLoadingDropdowns ? "Loading..." : "Select Applicant"}
                  emptyStateMessage="No applicant found."
                  disabled={isLoadingDropdowns}
                />
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <FormField
            control={form.control}
            name="piNo"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center"><FileText className="mr-2 h-4 w-4 text-muted-foreground" />PI No.*</FormLabel>
                <FormControl>
                  <Input placeholder="Enter Proforma Invoice number" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="piDate"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel className="flex items-center"><CalendarDays className="mr-2 h-4 w-4 text-muted-foreground" />PI Date*</FormLabel>
                <DatePickerField field={field} placeholder="Select PI date" />
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="salesPersonName"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center"><User className="mr-2 h-4 w-4 text-muted-foreground" />Sales Person Name*</FormLabel>
                <FormControl>
                  <Input placeholder="Enter sales person's name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
          <FormField
            control={form.control}
            name="connectedLcId"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center"><Link2 className="mr-2 h-4 w-4 text-muted-foreground" />Connected LC Number</FormLabel>
                <Combobox
                  options={lcOptions}
                  value={field.value === '' ? NONE_LC_VALUE : field.value}
                  onValueChange={(value) => field.onChange(value === NONE_LC_VALUE ? '' : value)}
                  placeholder="Search L/C Number..."
                  selectPlaceholder={isLoadingDropdowns ? "Loading L/Cs..." : "Select L/C (Optional)"}
                  emptyStateMessage="No L/C found."
                  disabled={isLoadingDropdowns}
                />
                <FormMessage />
              </FormItem>
            )}
          />
          {selectedLcIssueDate && (
            <div className="mt-2">
              <FormLabel className="text-sm text-muted-foreground">LC Issue Date:</FormLabel>
              <p className="text-sm font-medium p-2 border rounded-md bg-muted/50 h-10 flex items-center">{selectedLcIssueDate}</p>
            </div>
          )}
        </div>
         <FormField
          control={form.control}
          name="purchaseOrderUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center"><LinkIcon className="mr-2 h-4 w-4 text-muted-foreground"/>Purchase Order URL</FormLabel>
              <div className="flex items-center gap-2">
                <FormControl className="flex-grow">
                  <Input type="url" placeholder="https://example.com/purchase-order.pdf" {...field} value={field.value ?? ""} />
                </FormControl>
                <Button
                  type="button"
                  variant="default"
                  size="icon"
                  onClick={() => handleViewUrl(field.value)}
                  disabled={!field.value}
                  title="View Purchase Order"
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />


        <Separator />
        <h3 className={cn(sectionHeadingClass, "text-lg")}>
           <DollarSign className="mr-2 h-5 w-5 text-primary" /> Line Items
        </h3>

        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">SL No.</TableHead>
                <TableHead>Model No.*</TableHead>
                <TableHead className="w-[100px]">Qty*</TableHead>
                <TableHead className="w-[150px]">Purchase Price*</TableHead>
                <TableHead className="w-[150px]">Sales Price*</TableHead>
                <TableHead className="w-[120px]">Net Com.%</TableHead>
                <TableHead className="w-[80px] text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fields.map((item, index) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <FormField
                      control={form.control}
                      name={`lineItems.${index}.slNo`}
                      render={({ field }) => (
                        <Input placeholder="SL" {...field} value={field.value ?? ''} className="h-9"/>
                      )}
                    />
                  </TableCell>
                  <TableCell>
                    <FormField
                      control={form.control}
                      name={`lineItems.${index}.modelNo`}
                      render={({ field }) => (
                        <>
                          <Input placeholder="Model No." {...field} value={field.value ?? ''} className="h-9"/>
                          <FormMessage className="text-xs mt-1">{form.formState.errors.lineItems?.[index]?.modelNo?.message}</FormMessage>
                        </>
                      )}
                    />
                  </TableCell>
                  <TableCell>
                     <FormField
                      control={form.control}
                      name={`lineItems.${index}.qty`}
                      render={({ field }) => (
                        <>
                          <Input type="text" placeholder="Qty" {...field} value={field.value ?? ''} className="h-9"/>
                          <FormMessage className="text-xs mt-1">{form.formState.errors.lineItems?.[index]?.qty?.message}</FormMessage>
                        </>
                      )}
                    />
                  </TableCell>
                  <TableCell>
                     <FormField
                      control={form.control}
                      name={`lineItems.${index}.purchasePrice`}
                      render={({ field }) => (
                         <>
                          <Input type="text" placeholder="Purchase Price" {...field} value={field.value ?? ''} className="h-9"/>
                          <FormMessage className="text-xs mt-1">{form.formState.errors.lineItems?.[index]?.purchasePrice?.message}</FormMessage>
                        </>
                      )}
                    />
                  </TableCell>
                  <TableCell>
                     <FormField
                      control={form.control}
                      name={`lineItems.${index}.salesPrice`}
                      render={({ field }) => (
                        <>
                          <Input type="text" placeholder="Sales Price" {...field} value={field.value ?? ''} className="h-9"/>
                          <FormMessage className="text-xs mt-1">{form.formState.errors.lineItems?.[index]?.salesPrice?.message}</FormMessage>
                        </>
                      )}
                    />
                  </TableCell>
                  <TableCell>
                     <FormField
                      control={form.control}
                      name={`lineItems.${index}.netCommissionPercentage`}
                      render={({ field }) => (
                        <>
                          <Input type="text" placeholder="e.g., 5" {...field} value={field.value ?? ''} className="h-9"/>
                          <FormMessage className="text-xs mt-1">{form.formState.errors.lineItems?.[index]?.netCommissionPercentage?.message}</FormMessage>
                        </>
                      )}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} disabled={fields.length <= 1} title="Remove line item">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {form.formState.errors.lineItems && !form.formState.errors.lineItems.message && typeof form.formState.errors.lineItems === 'object' && form.formState.errors.lineItems.root && (
            <p className="text-sm font-medium text-destructive">{form.formState.errors.lineItems.root?.message || "Please ensure all line items are valid."}</p>
        )}
        <Button type="button" variant="outline" onClick={handleAddLineItem} className="mt-2">
          <PlusCircle className="mr-2 h-4 w-4" /> Add Line Item
        </Button>

        <Separator />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
             <FormField
                control={form.control}
                name="freightChargeOption"
                render={({ field }) => (
                <FormItem>
                    <FormLabel className="flex items-center"><Ship className="mr-2 h-4 w-4 text-muted-foreground" />Freight Charge*</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                        <SelectTrigger>
                        <SelectValue placeholder="Select Freight Option" />
                        </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                        {freightChargeOptions.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                    </SelectContent>
                    </Select>
                    <FormMessage />
                </FormItem>
                )}
            />
            {form.watch("freightChargeOption") === "Freight Excluded" && (
                <FormField
                    control={form.control}
                    name="freightChargeAmount"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel className="flex items-center"><DollarSign className="mr-2 h-4 w-4 text-muted-foreground" />Freight Amount</FormLabel>
                        <FormControl>
                            <Input type="text" placeholder="Enter freight amount" {...field} value={field.value ?? ''} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
            )}
        </div>
        
        <FormField
            control={form.control}
            name="miscellaneousExpenses"
            render={({ field }) => (
            <FormItem>
                <FormLabel className="flex items-center"><MinusCircle className="mr-2 h-4 w-4 text-muted-foreground" />Miscellaneous Expenses</FormLabel>
                <FormControl>
                    <Input type="text" placeholder="Enter misc. expenses" {...field} value={field.value ?? ''} />
                </FormControl>
                <FormDescription>This amount will be deducted from the Grand Total Sales.</FormDescription>
                <FormMessage />
            </FormItem>
            )}
        />


        <Separator />
         <div className="space-y-2 text-sm p-4 border rounded-md shadow-sm bg-muted/30">
            <h4 className="font-medium text-lg text-foreground">Calculated Totals:</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2">
                <p><strong className="text-muted-foreground">Total Qty:</strong> <span className="font-semibold text-foreground">{totalQty}</span></p>
                <p><strong className="text-muted-foreground">Total Purchase Price:</strong> <span className="font-semibold text-foreground">{totalPurchasePriceAmount.toFixed(2)}</span></p>
                <p><strong className="text-muted-foreground">Total Sales (Line Items):</strong> <span className="font-semibold text-foreground">{totalSalesPriceFromLineItems.toFixed(2)}</span></p>
                <p><strong className="text-muted-foreground">Total Extra Net Comm.:</strong> <span className="font-semibold text-foreground">{totalExtraNetCommission.toFixed(2)}</span></p>
                <p className="font-semibold text-primary md:col-span-1 mt-2 md:mt-0"><strong className="text-muted-foreground">Grand Total Sales:</strong> <span className="text-primary">{grandTotalSalesPrice.toFixed(2)}</span></p>
                <p className="font-semibold text-green-700 dark:text-green-400 md:col-span-1 mt-2 md:mt-0"><strong className="text-muted-foreground">Grand Total Comm. USD:</strong> <span className="text-green-700 dark:text-green-400">{grandTotalCommissionUSD.toFixed(2)}</span></p>
                <p className="font-semibold text-green-600 dark:text-green-500 md:col-span-1 mt-2 md:mt-0"><strong className="text-muted-foreground">Total Comm. (%):</strong> <span className="text-green-600 dark:text-green-500">{totalCommissionPercentage.toFixed(2)}%</span></p>
            </div>
        </div>

        <Button type="submit" className="w-full md:w-auto" disabled={isSubmitting || isLoadingDropdowns}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving PI...
            </>
          ) : (
            <>
              <FileText className="mr-2 h-4 w-4" />
              Save Proforma Invoice
            </>
          )}
        </Button>
      </form>
    </Form>
  );
}

    

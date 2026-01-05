"use client";

import * as React from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Swal from 'sweetalert2';
import { format } from 'date-fns';
import { firestore } from '@/lib/firebase/config';
import { collection, doc, serverTimestamp, getDocs, runTransaction, query, orderBy } from 'firebase/firestore';
import type { CustomerDocument, SaleDocument as ProjectInvoiceDocument } from '@/types';
import type { Project, Task } from '@/types/projectManagement';
import { quoteTaxTypes, saleStatusOptions } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { DatePickerField } from '@/components/forms/common';
import { Loader2, PlusCircle, Trash2, Users, CalendarDays, Save, X, ShoppingBag, Hash, Columns, Briefcase } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { z } from 'zod';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuCheckboxItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const sectionHeadingClass = "font-bold text-xl lg:text-2xl bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out border-b pb-2 mb-6 flex items-center";

const PLACEHOLDER_CUSTOMER_VALUE = "__PROJECT_INVOICE_CUSTOMER_PLACEHOLDER__";

interface CustomerOption extends ComboboxOption {
    address?: string;
}

// Local Schema Definition
const ProjectInvoiceSchema = z.object({
    projectId: z.string().min(1, "Project is required"),
    taskId: z.string().optional(),
    customerId: z.string().min(1, "Customer is required"),
    billingAddress: z.string().optional(),
    shippingAddress: z.string().optional(),
    invoiceDate: z.date(),
    salesperson: z.string().optional(),
    lineItems: z.array(z.object({
        description: z.string().min(1, "Description is required"),
        qty: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0, "Qty must be > 0"),
        unitPrice: z.string().refine((val) => !isNaN(Number(val)) && Number(val) >= 0, "Price must be >= 0"),
        discountPercentage: z.string().optional(),
        taxPercentage: z.string().optional(),
        total: z.string().optional(),
    })).min(1, "At least one item is required"),
    status: z.enum(["Draft", "Pending", "Quote", "Ordered", "Sent", "Partial", "Paid", "Cancelled"]),
    taxType: z.string().optional(),
    comments: z.string().optional(),
    privateComments: z.string().optional(),
    showDiscountColumn: z.boolean().optional(),
    showTaxColumn: z.boolean().optional(),
    packingCharge: z.string().optional(),
    handlingCharge: z.string().optional(),
    otherCharges: z.string().optional(),
});

type ProjectInvoiceFormValues = z.infer<typeof ProjectInvoiceSchema>;

export function CreateProjectInvoiceForm() {
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [customerOptions, setCustomerOptions] = React.useState<CustomerOption[]>([]);
    const [projects, setProjects] = React.useState<Project[]>([]);
    const [tasks, setTasks] = React.useState<Task[]>([]);
    const [isLoadingDropdowns, setIsLoadingDropdowns] = React.useState(true);
    const [generatedInvoiceId, setGeneratedInvoiceId] = React.useState<string | null>(null);

    const form = useForm<ProjectInvoiceFormValues>({
        resolver: zodResolver(ProjectInvoiceSchema),
        defaultValues: {
            projectId: '',
            taskId: '',
            customerId: '',
            billingAddress: '',
            shippingAddress: '',
            invoiceDate: new Date(),
            salesperson: '',
            lineItems: [{
                description: '',
                qty: '1',
                unitPrice: '0',
                discountPercentage: '0',
                taxPercentage: '0',
                total: '0.00'
            }],
            status: "Draft",
            taxType: 'Default',
            comments: '',
            privateComments: '',
            showDiscountColumn: true,
            showTaxColumn: true,
            packingCharge: undefined,
            handlingCharge: undefined,
            otherCharges: undefined,
        },
    });

    const { control, setValue, watch, getValues, reset } = form;

    const showDiscountColumn = watch("showDiscountColumn");
    const showTaxColumn = watch("showTaxColumn");
    const watchedProjectId = watch("projectId");

    const { fields, append, remove } = useFieldArray({
        control,
        name: "lineItems",
    });

    const watchedCustomerId = watch("customerId");
    const watchedLineItems = watch("lineItems");
    const watchedPackingCharge = watch("packingCharge");
    const watchedHandlingCharge = watch("handlingCharge");
    const watchedOtherCharges = watch("otherCharges");

    const filteredTasks = React.useMemo(() => {
        if (!watchedProjectId) return [];
        return tasks.filter(task => task.projectId === watchedProjectId);
    }, [tasks, watchedProjectId]);

    const { subtotal, totalDiscountAmount, totalTaxAmount, grandTotal } = React.useMemo(() => {
        let currentSubtotal = 0;
        let currentTotalTax = 0;
        let currentTotalDiscount = 0;

        if (Array.isArray(watchedLineItems)) {
            watchedLineItems.forEach((item, index) => {
                const qty = parseFloat(String(item.qty || '0')) || 0;
                const unitPrice = parseFloat(String(item.unitPrice || '0')) || 0;
                const discountP = showDiscountColumn ? (parseFloat(String(item.discountPercentage || '0')) || 0) : 0;
                const taxP = showTaxColumn ? (parseFloat(String(item.taxPercentage || '0')) || 0) : 0;

                let itemTotalBeforeDiscount = 0;
                if (qty > 0 && unitPrice >= 0) {
                    itemTotalBeforeDiscount = qty * unitPrice;
                    const lineDiscountAmount = itemTotalBeforeDiscount * (discountP / 100);
                    const itemTotalAfterDiscount = itemTotalBeforeDiscount - lineDiscountAmount;
                    const lineTaxAmount = itemTotalAfterDiscount * (taxP / 100);

                    currentSubtotal += itemTotalBeforeDiscount;
                    currentTotalDiscount += lineDiscountAmount;
                    currentTotalTax += lineTaxAmount;
                }

                const displayLineTotal = isNaN(itemTotalBeforeDiscount) ? 0 : itemTotalBeforeDiscount;

                const currentFormLineTotal = getValues(`lineItems.${index}.total`);
                if (String(displayLineTotal.toFixed(2)) !== currentFormLineTotal) {
                    setValue(`lineItems.${index}.total`, displayLineTotal.toFixed(2));
                }
            });
        }

        const packing = Number(watchedPackingCharge || 0);
        const handling = Number(watchedHandlingCharge || 0);
        const other = Number(watchedOtherCharges || 0);
        const additionalCharges = packing + handling + other;

        const currentGrandTotal = currentSubtotal - currentTotalDiscount + currentTotalTax + additionalCharges;

        return {
            subtotal: currentSubtotal,
            totalDiscountAmount: currentTotalDiscount,
            totalTaxAmount: currentTotalTax,
            grandTotal: currentGrandTotal,
        };
    }, [watchedLineItems, showDiscountColumn, showTaxColumn, getValues, setValue, watchedPackingCharge, watchedHandlingCharge, watchedOtherCharges]);

    React.useEffect(() => {
        const fetchOptions = async () => {
            setIsLoadingDropdowns(true);
            try {
                const customersSnap = await getDocs(collection(firestore, "customers"));
                setCustomerOptions(
                    customersSnap.docs.map(doc => {
                        const data = doc.data() as CustomerDocument;
                        return { value: doc.id, label: data.applicantName || 'Unnamed Customer', address: data.address };
                    })
                );

                const projectsSnap = await getDocs(query(collection(firestore, "projects"), orderBy("updatedAt", "desc")));
                setProjects(projectsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project)));

                const tasksSnap = await getDocs(collection(firestore, "project_tasks"));
                setTasks(tasksSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task)));
            } catch (error) {
                console.error("Error fetching dropdown options for Project Invoice form: ", error);
                Swal.fire("Error", "Could not load data. Please try again.", "error");
            } finally {
                setIsLoadingDropdowns(false);
            }
        };
        fetchOptions();
    }, []);

    React.useEffect(() => {
        if (watchedCustomerId) {
            const selectedCustomer = customerOptions.find(opt => opt.value === watchedCustomerId);
            if (selectedCustomer) {
                setValue("billingAddress", selectedCustomer.address || "");
                setValue("shippingAddress", selectedCustomer.address || "");
            }
        } else {
            setValue("billingAddress", "");
            setValue("shippingAddress", "");
        }
    }, [watchedCustomerId, customerOptions, setValue]);

    async function onSubmit(data: ProjectInvoiceFormValues) {
        setIsSubmitting(true);

        try {
            const counterRef = doc(firestore, "counters", "projectInvoiceNumberGenerator");

            const newInvoiceId = await runTransaction(firestore, async (transaction) => {
                // ----- READ PHASE -----
                const counterDoc = await transaction.get(counterRef);

                // ----- WRITE PHASE -----
                const currentYear = new Date().getFullYear();
                let currentCount = 0;
                if (counterDoc.exists()) {
                    const counterData = counterDoc.data();
                    currentCount = counterData?.yearlyCounts?.[currentYear] || 0;
                }
                const newCount = currentCount + 1;
                const formattedInvoiceId = `PI${currentYear}-${String(newCount).padStart(2, '0')}`;

                const selectedCustomer = customerOptions.find(opt => opt.value === data.customerId);
                const selectedProject = projects.find(p => p.id === data.projectId);
                const selectedTask = tasks.find(t => t.id === data.taskId);

                const processedLineItems = data.lineItems.map(item => {
                    const qty = parseFloat(String(item.qty || '0'));
                    const unitPriceStr = String(item.unitPrice || '0');
                    const finalUnitPrice = parseFloat(unitPriceStr);
                    const discountPercentageStr = String(item.discountPercentage || '0');
                    const finalDiscountPercentage = parseFloat(discountPercentageStr);
                    const taxPercentageStr = String(item.taxPercentage || '0');
                    const finalTaxPercentage = parseFloat(taxPercentageStr);

                    const itemTotalBeforeDiscount = qty * finalUnitPrice;

                    const lineItemData: any = {
                        description: item.description || '',
                        qty, unitPrice: finalUnitPrice, discountPercentage: finalDiscountPercentage, taxPercentage: finalTaxPercentage, total: itemTotalBeforeDiscount,
                    };

                    return lineItemData;
                });

                const dataToSave: Record<string, any> = {
                    customerId: data.customerId, customerName: selectedCustomer?.label || 'N/A',
                    projectId: data.projectId, projectTitle: selectedProject?.projectTitle || 'Unknown Project',
                    taskId: data.taskId, taskTitle: selectedTask?.taskTitle || '',
                    billingAddress: data.billingAddress, shippingAddress: data.shippingAddress,
                    invoiceDate: format(data.invoiceDate, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"),
                    salesperson: data.salesperson,
                    lineItems: processedLineItems, taxType: data.taxType,
                    comments: data.comments, privateComments: data.privateComments,
                    subtotal: subtotal, totalDiscountAmount: totalDiscountAmount, totalTaxAmount: totalTaxAmount,
                    totalAmount: grandTotal, status: data.status || "Draft",
                    packingCharge: data.packingCharge,
                    handlingCharge: data.handlingCharge,
                    otherCharges: data.otherCharges,
                    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
                    showDiscountColumn: data.showDiscountColumn,
                    showTaxColumn: data.showTaxColumn,
                };

                const cleanedDataToSave = Object.fromEntries(
                    Object.entries(dataToSave).filter(([, value]) => value !== undefined && value !== '')
                ) as Partial<Omit<ProjectInvoiceDocument, 'id'>>;

                const newInvoiceRef = doc(firestore, "project_invoices", formattedInvoiceId);
                transaction.set(newInvoiceRef, cleanedDataToSave);

                const newCounters = {
                    yearlyCounts: {
                        ...(counterDoc.exists() ? counterDoc.data().yearlyCounts : {}),
                        [currentYear]: newCount,
                    }
                };
                transaction.set(counterRef, newCounters, { merge: true });

                return formattedInvoiceId;
            });

            setGeneratedInvoiceId(newInvoiceId);
            Swal.fire({
                title: "Project Invoice Recorded!",
                text: `Invoice successfully recorded with ID: ${newInvoiceId}.`,
                icon: "success",
            });
            form.reset();
        } catch (error: any) {
            console.error("Error recording project invoice: ", error);
            Swal.fire({
                title: "Save Failed",
                text: `Failed to record invoice: ${error.message}`,
                icon: "error",
            });
        } finally {
            setIsSubmitting(false);
        }
    }

    if (isLoadingDropdowns) {
        return (
            <div className="flex items-center justify-center py-10">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-2 text-muted-foreground">Loading form options...</p>
            </div>
        );
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">



                <h3 className={cn(sectionHeadingClass)}><Users className="mr-2 h-5 w-5 text-primary" />Customer & Delivery</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <FormField
                            control={control}
                            name="customerId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Customer*</FormLabel>
                                    <Combobox
                                        options={customerOptions}
                                        value={field.value || PLACEHOLDER_CUSTOMER_VALUE}
                                        onValueChange={(value) => field.onChange(value === PLACEHOLDER_CUSTOMER_VALUE ? '' : value)}
                                        placeholder="Search Customer..."
                                        selectPlaceholder="Select Customer"
                                        emptyStateMessage="No customer found."
                                        disabled={isLoadingDropdowns}
                                    />
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                    <div>
                        <FormField
                            control={control}
                            name="shippingAddress"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Delivery Address*</FormLabel>
                                    <FormControl>
                                        <Textarea placeholder="Delivery address" {...field} rows={3} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <FormField
                            control={control}
                            name="salesperson"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Salesperson*</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Enter salesperson name" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                    <div>
                        <FormField
                            control={control}
                            name="billingAddress"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Bill To*</FormLabel>
                                    <FormControl>
                                        <Textarea placeholder="Billing address" {...field} rows={3} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                </div>

                <h3 className={cn(sectionHeadingClass)}><Briefcase className="mr-2 h-5 w-5 text-primary" />Project & Task</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                        control={control}
                        name="projectId"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Project*</FormLabel>
                                <Select onValueChange={(val) => { field.onChange(val); setValue('taskId', ''); }} value={field.value}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select Project" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {projects.map((project) => (
                                            <SelectItem key={project.id} value={project.id}>
                                                {project.projectTitle} ({project.projectId})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={control}
                        name="taskId"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Task (Optional)</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value} disabled={!watchedProjectId}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select Task" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {filteredTasks.length > 0 ? filteredTasks.map((task) => (
                                            <SelectItem key={task.id} value={task.id}>
                                                {task.taskTitle} ({task.taskId})
                                            </SelectItem>
                                        )) : <SelectItem value="none" disabled>No tasks available</SelectItem>}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                <h3 className={cn(sectionHeadingClass)}>
                    <CalendarDays className="mr-2 h-5 w-5 text-primary" />
                    Invoice Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
                    <FormItem>
                        <FormLabel className="flex items-center"><Hash className="mr-2 h-4 w-4 text-muted-foreground" />Invoice ID</FormLabel>
                        <Input value={generatedInvoiceId || "(Auto-generated on save)"} readOnly disabled className="bg-muted/50 cursor-not-allowed h-10" />
                    </FormItem>
                    <FormField
                        control={control}
                        name="invoiceDate"
                        render={({ field }) => (
                            <FormItem className="flex flex-col">
                                <FormLabel>Invoice Date*</FormLabel>
                                <DatePickerField field={field} placeholder="Select invoice date" />
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="taxType"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Tax</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value ?? 'Default'}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select tax type" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {quoteTaxTypes.map((type) => (
                                            <SelectItem key={type} value={type}>{type}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="status"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Status*</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value ?? 'Draft'}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select a status" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {saleStatusOptions.map(status => (
                                            <SelectItem key={status} value={status}>{status}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                <Separator />
                <div className="flex justify-between items-center">
                    <h3 className={cn(sectionHeadingClass, "mb-0 border-b-0")}>
                        <ShoppingBag className="mr-2 h-5 w-5 text-primary" /> Line Items
                    </h3>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="outline" size="sm"><Columns className="mr-2 h-4 w-4" />Columns</Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end"><DropdownMenuLabel>Toggle Columns</DropdownMenuLabel><DropdownMenuSeparator />
                            <DropdownMenuCheckboxItem checked={showDiscountColumn} onCheckedChange={(checked) => setValue('showDiscountColumn', !!checked)}>Discount %</DropdownMenuCheckboxItem>
                            <DropdownMenuCheckboxItem checked={showTaxColumn} onCheckedChange={(checked) => setValue('showTaxColumn', !!checked)}>Tax %</DropdownMenuCheckboxItem>
                        </DropdownMenuContent></DropdownMenu>
                </div>
                <div className="rounded-md border overflow-x-auto">
                    <Table><TableHeader><TableRow><TableHead className="w-[120px]">Qty*</TableHead><TableHead className="min-w-[250px]">Description</TableHead><TableHead className="w-[120px]">Unit Price*</TableHead>
                        {showDiscountColumn && <TableHead className="w-[100px]">Discount %</TableHead>}
                        {showTaxColumn && <TableHead className="w-[100px]">Tax %</TableHead>}
                        <TableHead className="w-[130px] text-right">Total Price</TableHead><TableHead className="w-[50px] text-right">Action</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {fields.map((field, index) => (
                                <TableRow key={field.id}>
                                    <TableCell><FormField control={control} name={`lineItems.${index}.qty`} render={({ field: itemField }) => (<Input type="text" placeholder="1" {...itemField} className="h-9" />)} /><FormMessage className="text-xs mt-1">{form.formState.errors.lineItems?.[index]?.qty?.message}</FormMessage></TableCell>
                                    <TableCell><FormField control={control} name={`lineItems.${index}.description`} render={({ field: itemField }) => (<Textarea placeholder="Item description" {...itemField} rows={1} className="h-9 min-h-[2.25rem] resize-y" />)} /></TableCell>
                                    <TableCell><FormField control={control} name={`lineItems.${index}.unitPrice`} render={({ field: itemField }) => (<Input type="text" placeholder="0.00" {...itemField} className="h-9" />)} /><FormMessage className="text-xs mt-1">{form.formState.errors.lineItems?.[index]?.unitPrice?.message}</FormMessage></TableCell>
                                    {showDiscountColumn && <TableCell><FormField control={control} name={`lineItems.${index}.discountPercentage`} render={({ field: itemField }) => (<Input type="text" placeholder="0" {...itemField} className="h-9" />)} /><FormMessage className="text-xs mt-1">{form.formState.errors.lineItems?.[index]?.discountPercentage?.message}</FormMessage></TableCell>}
                                    {showTaxColumn && <TableCell><FormField control={control} name={`lineItems.${index}.taxPercentage`} render={({ field: itemField }) => (<Input type="text" placeholder="0" {...itemField} className="h-9" />)} /><FormMessage className="text-xs mt-1">{form.formState.errors.lineItems?.[index]?.taxPercentage?.message}</FormMessage></TableCell>}
                                    <TableCell className="text-right"><FormField control={control} name={`lineItems.${index}.total`} render={({ field: itemField }) => (<Input type="text" {...itemField} readOnly disabled className="h-9 bg-muted/50 text-right font-medium" />)} /></TableCell>
                                    <TableCell className="text-right"><Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} disabled={fields.length <= 1} title="Remove line item"><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                                </TableRow>))}
                        </TableBody>
                    </Table>
                </div>
                {form.formState.errors.lineItems && !form.formState.errors.lineItems.message && typeof form.formState.errors.lineItems === 'object' && form.formState.errors.lineItems.root && (<p className="text-sm font-medium text-destructive">{form.formState.errors.lineItems.root?.message || "Please ensure all line items are valid."}</p>)}
                <Button type="button" variant="outline" onClick={() => append({ description: '', qty: '1', unitPrice: '0', discountPercentage: '0', taxPercentage: '0', total: '0.00' })} className="mt-2"><PlusCircle className="mr-2 h-4 w-4" /> Add Item</Button>

                <Separator />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <FormField control={control} name="packingCharge" render={({ field }) => (<FormItem><FormLabel>Packing Charge</FormLabel><FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={control} name="handlingCharge" render={({ field }) => (<FormItem><FormLabel>Handling Charge</FormLabel><FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={control} name="otherCharges" render={({ field }) => (<FormItem><FormLabel>Freight Charges</FormLabel><FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField control={control} name="comments" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="font-bold underline">TERMS AND CONDITIONS:</FormLabel>
                            <FormControl><Textarea placeholder="Public comments" {...field} rows={3} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                    <FormField control={control} name="privateComments" render={({ field }) => (<FormItem><FormLabel>Private Comments (Internal)</FormLabel><FormControl><Textarea placeholder="Internal notes" {...field} rows={3} /></FormControl><FormMessage /></FormItem>)} />
                </div>

                <div className="flex justify-end space-y-2 mt-6">
                    <div className="w-full max-w-sm space-y-2">
                        <div className="flex justify-between"><span className="text-muted-foreground">Subtotal:</span><span className="font-medium text-foreground">{subtotal.toFixed(2)}</span></div>
                        {showDiscountColumn && (<div className="flex justify-between"><span className="text-muted-foreground">Total Discount:</span><span className="font-medium text-foreground">(-) {totalDiscountAmount.toFixed(2)}</span></div>)}
                        {showTaxColumn && (<div className="flex justify-between"><span className="text-muted-foreground">Total Tax:</span><span className="font-medium text-foreground">(+) {totalTaxAmount.toFixed(2)}</span></div>)}
                        <div className="flex justify-between"><span className="text-muted-foreground">Additional Charges:</span><span className="font-medium text-foreground">(+) {(Number(watchedPackingCharge || 0) + Number(watchedHandlingCharge || 0) + Number(watchedOtherCharges || 0)).toFixed(2)}</span></div>
                        <Separator />
                        <div className="flex justify-between text-lg font-bold"><span className="text-primary">Grand Total:</span><span className="text-primary">{grandTotal.toFixed(2)}</span></div>
                    </div>
                </div>
                <Separator />

                <div className="flex flex-wrap gap-2 justify-end">
                    <Button type="button" variant="outline" onClick={() => {
                        form.reset();
                        setGeneratedInvoiceId(null);
                    }}>
                        <X className="mr-2 h-4 w-4" />Cancel
                    </Button>
                    <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isSubmitting || isLoadingDropdowns}>
                        {isSubmitting ? (
                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Recording Invoice...</>
                        ) : (
                            <><Save className="mr-2 h-4 w-4" />Record Project Invoice</>
                        )}
                    </Button>
                </div>
            </form>
        </Form>
    );
}

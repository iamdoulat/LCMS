
import { NextRequest, NextResponse } from 'next/server';
import easyinvoice from 'easyinvoice';
import { firestore } from '@/lib/firebase/config';
import { doc, getDoc } from 'firebase/firestore';
import type { InvoiceDocument, QuoteDocument, OrderDocument, CompanyProfile, CustomerDocument, SupplierDocument } from '@/types';
import { format, parseISO, isValid } from 'date-fns';

const FINANCIAL_SETTINGS_COLLECTION = 'financial_settings';
const FINANCIAL_SETTINGS_DOC_ID = 'main_settings';

const formatDisplayDate = (dateString?: string) => {
  if (!dateString) return 'N/A';
  try {
    const date = parseISO(dateString);
    return isValid(date) ? format(date, 'dd-MM-yyyy') : 'N/A';
  } catch (e) {
    return 'N/A';
  }
};

const getCompanyProfile = async (): Promise<Partial<CompanyProfile>> => {
    try {
        const settingsDocRef = doc(firestore, FINANCIAL_SETTINGS_COLLECTION, FINANCIAL_SETTINGS_DOC_ID);
        const settingsDocSnap = await getDoc(settingsDocRef);
        if (settingsDocSnap.exists()) {
            return settingsDocSnap.data() as CompanyProfile;
        }
    } catch (e) {
        console.error("Error fetching company profile:", e);
    }
    return {};
};

const getCustomerOrSupplierInfo = async (docId: string, collectionName: 'customers' | 'suppliers'): Promise<any> => {
    if (!docId) return {};
    try {
        const docRef = doc(firestore, collectionName, docId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return docSnap.data();
        }
    } catch (e) {
        console.error(`Error fetching from ${collectionName}:`, e);
    }
    return {};
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') as 'invoice' | 'quote' | 'order' | 'sale';
  const id = searchParams.get('id');

  if (!type || !id) {
    return new NextResponse('Missing document type or ID.', { status: 400 });
  }

  try {
    const companyProfile = await getCompanyProfile();

    let documentData: any;
    let customerInfo: any = {};
    const collectionName = type === 'sale' ? 'sales' : `${type}s`;
    const docRef = doc(firestore, collectionName, id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return new NextResponse('Document not found.', { status: 404 });
    }
    
    documentData = { id: docSnap.id, ...docSnap.data() };

    // Fetch related customer/supplier info
    if (documentData.customerId) {
        customerInfo = await getCustomerOrSupplierInfo(documentData.customerId, 'customers');
    } else if (documentData.beneficiaryId) { // For Orders
        customerInfo = await getCustomerOrSupplierInfo(documentData.beneficiaryId, 'suppliers');
    }
    
    const information: { number: string; date: string; 'due-date'?: string } = {
        number: documentData.id,
        date: formatDisplayDate(documentData.invoiceDate || documentData.quoteDate || documentData.orderDate || documentData.saleDate),
    };

    if (documentData.dueDate) {
        information['due-date'] = formatDisplayDate(documentData.dueDate);
    }

    const invoiceData = {
      "currency": documentData.currency || "USD",
      "marginTop": 25,
      "marginRight": 25,
      "marginLeft": 25,
      "marginBottom": 25,
      "images": {
          "logo": companyProfile.invoiceLogoUrl || "https://public.easyinvoice.cloud/img/logo_en_original.png",
      },
      "sender": {
        "company": companyProfile.companyName || "Your Company Name",
        "address": companyProfile.address || "123 Main St, Anytown, USA",
        "zip": "",
        "city": "",
        "country": "",
        "custom1": `Email: ${companyProfile.emailId || ''}`,
        "custom2": `Phone: ${companyProfile.cellNumber || ''}`,
      },
      "client": {
        "company": documentData.customerName || documentData.beneficiaryName || "N/A",
        "address": documentData.billingAddress || customerInfo.address || "N/A",
        "zip": "",
        "city": "",
        "country": "",
        "custom1": `BIN: ${customerInfo.binNo || 'N/A'}`
      },
      "information": information,
      "products": documentData.lineItems?.map((item: any) => ({
        "quantity": item.qty?.toString() || '0',
        "description": item.itemName || 'N/A',
        "tax-rate": item.taxPercentage || 0,
        "price": item.unitPrice || 0
      })) || [],
      "bottom-notice": documentData.comments || "Thank you for your business.",
      "settings": {
        "locale": "en-US",
        "tax-notation": documentData.taxType || "vat",
        "currency": documentData.currency || "USD"
      },
       "translate": {
           "products": "Item Description"
       }
    };
    
    // Customize document title based on type
    if (type === 'quote') (invoiceData as any).documentTitle = "QUOTATION";
    else if (type === 'order') (invoiceData as any).documentTitle = "ORDER";
    else if (type === 'sale') (invoiceData as any).documentTitle = "SALE INVOICE";
    else (invoiceData as any).documentTitle = "INVOICE";
    
    const result = await easyinvoice.createInvoice(invoiceData as any);
    const pdfBuffer = Buffer.from(result.pdf, 'base64');
    
    const headers = new Headers();
    headers.set('Content-Type', 'application/pdf');
    headers.set('Content-Disposition', `attachment; filename="${type}_${id}.pdf"`);

    return new NextResponse(pdfBuffer, { status: 200, headers });

  } catch (error) {
    console.error(`Error generating PDF for ${type} ${id}:`, error);
    return new NextResponse('Failed to generate PDF.', { status: 500 });
  }
}

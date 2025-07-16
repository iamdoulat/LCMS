// src/app/api/generate-pdf/route.ts
import { NextRequest, NextResponse } from 'next/server';
import puppeteer from 'puppeteer';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const urlToPrint = searchParams.get('url');

  if (!urlToPrint) {
    return new NextResponse('URL to print is required.', { status: 400 });
  }

  let browser;
  try {
    const fullUrl = new URL(urlToPrint, request.nextUrl.origin).href;

    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    
    const page = await browser.newPage();
    
    // Set a cookie to indicate a Puppeteer session, if needed by the print layout
    // For now, this is not strictly necessary as we use CSS print media types.
    // await page.setCookie(...); // Example of setting cookies if login is required

    await page.goto(fullUrl, {
      waitUntil: 'networkidle0', // Wait for network activity to cease
    });

    // Ensure print styles are applied
    await page.emulateMediaType('print');

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20px',
        right: '20px',
        bottom: '20px',
        left: '20px',
      },
    });

    const headers = new Headers();
    headers.set('Content-Type', 'application/pdf');
    const documentName = urlToPrint.split('/').slice(-2).join('_');
    headers.set('Content-Disposition', `attachment; filename="${documentName}.pdf"`);

    return new NextResponse(pdfBuffer, { status: 200, headers });

  } catch (error) {
    console.error('Error generating PDF:', error);
    return new NextResponse('Failed to generate PDF.', { status: 500 });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

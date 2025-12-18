// This API route has been removed.
// PDF generation is now handled client-side via print preview pages
// which use the browser's built-in "Print to PDF" functionality for better results.

import { NextResponse } from 'next/server';

export async function GET() {
  return new NextResponse('This API endpoint is deprecated. Please use the /preview/ pages for printing.', { status: 410 });
}

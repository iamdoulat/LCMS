
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  // This endpoint is disabled.
  return NextResponse.json(
    { error: "User registration is disabled." },
    { status: 403 } // 403 Forbidden
  );
}

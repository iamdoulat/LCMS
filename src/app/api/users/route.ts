// This API route has been removed as user creation is now handled on the client-side via the /register page.
// The previous implementation required the Firebase Admin SDK, which is no longer used for user creation.

import { NextResponse } from 'next/server';

export async function POST(_request: Request) {
    return NextResponse.json(
        { error: 'This user creation endpoint is disabled. Please use the public /register page.' },
        { status: 404 }
    );
}

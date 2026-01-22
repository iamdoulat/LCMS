import { admin } from '@/lib/firebase/admin';
import { NextResponse } from 'next/server';

export interface AuthUser {
    uid: string;
    email?: string;
    roles: string[];
}

/**
 * Verifies the Firebase ID Token in the Authorization header.
 * @param request The incoming Request object
 * @param allowedRoles Optional array of roles allowed to access this endpoint
 * @returns {Promise<{user: AuthUser | null, error?: NextResponse}>}
 */
export async function verifyAuth(
    request: Request,
    allowedRoles?: string[]
): Promise<{ user: AuthUser | null; error?: NextResponse }> {
    try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return {
                user: null,
                error: NextResponse.json(
                    { error: 'Missing or invalid Authorization header' },
                    { status: 401 }
                ),
            };
        }

        const idToken = authHeader.split('Bearer ')[1];
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const uid = decodedToken.uid;

        // Fetch user roles from Firestore
        const userDoc = await admin.firestore().collection('users').doc(uid).get();
        const userData = userDoc.data();

        let roles: string[] = [];
        if (userData) {
            const roleData = userData.role || userData.roles || [];
            roles = Array.isArray(roleData) ? roleData : [roleData];
        }

        const user: AuthUser = {
            uid,
            email: decodedToken.email,
            roles,
        };

        // Check for required roles if specified
        if (allowedRoles && allowedRoles.length > 0) {
            const hasRequiredRole = roles.some(role => allowedRoles.includes(role));
            if (!hasRequiredRole) {
                return {
                    user,
                    error: NextResponse.json(
                        { error: 'Forbidden: You do not have the required permissions' },
                        { status: 403 }
                    ),
                };
            }
        }

        return { user };
    } catch (error: any) {
        console.error('API Auth Error:', error);
        return {
            user: null,
            error: NextResponse.json(
                { error: `Unauthorized: ${error.message}` },
                { status: 401 }
            ),
        };
    }
}

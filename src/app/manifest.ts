import { MetadataRoute } from 'next';
import { admin } from '@/lib/firebase/admin';

const FINANCIAL_SETTINGS_COLLECTION = 'financial_settings';
const COMPANY_PROFILE_DOC_ID = 'main_settings';

export const dynamic = 'force-dynamic';

export default async function manifest(): Promise<MetadataRoute.Manifest> {
    let name = 'LCMS';
    let shortName = 'LCMS';
    let description = 'LCMS - LC & HR Management System - Employee Portal';

    let icon192 = '/icons/icon-192x192.png';
    let icon512 = '/icons/icon-512x512.png';
    let icon144 = '/icons/icon-144x144.png';
    let iconMaskable = '/icons/maskable-icon-192x192.png';
    let screenshot = '/screenshots/dashboard.png';

    try {
        const db = admin.firestore();
        const docRef = db.collection(FINANCIAL_SETTINGS_COLLECTION).doc(COMPANY_PROFILE_DOC_ID);
        const docSnap = await docRef.get();

        if (docSnap.exists) {
            const data = docSnap.data();
            if (data?.pwaAppName) name = data.pwaAppName;
            if (data?.pwaShortName) shortName = data.pwaShortName;
            if (data?.pwaDescription) description = data.pwaDescription;
            if (data?.pwaIcon192Url) icon192 = data.pwaIcon192Url;
            if (data?.pwaIcon512Url) icon512 = data.pwaIcon512Url;
            if (data?.pwaIcon144Url) icon144 = data.pwaIcon144Url;
            if (data?.pwaIconMaskableUrl) iconMaskable = data.pwaIconMaskableUrl;
            if (data?.pwaScreenshotUrl) screenshot = data.pwaScreenshotUrl;
        }
    } catch (error) {
        console.error('Error fetching manifest data:', error);
    }

    return {
        name: name,
        short_name: shortName,
        description: description,
        start_url: '/mobile/dashboard',
        display: 'standalone',
        background_color: '#0a1e60',
        theme_color: '#0a1e60',
        orientation: 'portrait',
        scope: '/',
        icons: [
            {
                src: icon144,
                sizes: '144x144',
                type: 'image/png',
                purpose: 'any',
            },
            {
                src: icon192,
                sizes: '192x192',
                type: 'image/png',
                purpose: 'any',
            },
            {
                src: icon512,
                sizes: '512x512',
                type: 'image/png',
                purpose: 'any',
            },
            {
                src: iconMaskable,
                sizes: '192x192',
                type: 'image/png',
                purpose: 'maskable',
            },
            // Fallbacks for other requested sizes
            { src: icon144, sizes: '72x72', type: 'image/png' },
            { src: icon144, sizes: '96x96', type: 'image/png' },
            { src: icon192, sizes: '128x128', type: 'image/png' },
            { src: icon512, sizes: '384x384', type: 'image/png' },
        ],
        categories: ['business', 'productivity', 'Finaintial',],
        screenshots: [
            {
                src: screenshot,
                sizes: '540x720',
                type: 'image/png',
            },
        ],
        shortcuts: [
            {
                name: 'Check In',
                short_name: 'Check In',
                url: '/mobile/check-in-out',
                icons: [
                    {
                        src: icon192,
                        sizes: '192x192',
                    },
                ],
            },
            {
                name: 'My Attendance',
                short_name: 'Attendance',
                url: '/mobile/attendance/my-attendance',
                icons: [
                    {
                        src: icon192,
                        sizes: '192x192',
                    },
                ],
            },
        ],
    };
}

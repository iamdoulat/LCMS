"use client";

import React, { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import { MultipleCheckInOutRecord } from '@/types/checkInOut';
import { format } from 'date-fns';
import { ChevronLeft, Loader2, MapPin } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import dynamic from 'next/dynamic';

// Dynamically import Leaflet components to avoid SSR issues
const MapContainer = dynamic(
    () => import('react-leaflet').then((mod) => mod.MapContainer),
    { ssr: false }
);
const TileLayer = dynamic(
    () => import('react-leaflet').then((mod) => mod.TileLayer),
    { ssr: false }
);
const Marker = dynamic(
    () => import('react-leaflet').then((mod) => mod.Marker),
    { ssr: false }
);
const Popup = dynamic(
    () => import('react-leaflet').then((mod) => mod.Popup),
    { ssr: false }
);

// Leaflet CSS needs to be imported, usually in layout or here. 
// If not globally available, we might need a style tag or import 'leaflet/dist/leaflet.css';
import 'leaflet/dist/leaflet.css';
// Fix for default marker icon in Leaflet with Webpack
import L from 'leaflet';

// Fix Leaflet marker icon issue
const iconUrl = 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png';
const iconRetinaUrl = 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png';
const shadowUrl = 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png';

// We need to set this on client side only, inside the component or effect
// But `L` usage might crash SSR if not careful.

export default function RemoteAttendanceDetailsPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const id = searchParams.get('id');

    const [record, setRecord] = useState<MultipleCheckInOutRecord | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Fix Leaflet Icon
        if (typeof window !== 'undefined') {
            (async () => {
                const L = await import('leaflet');
                // @ts-ignore
                delete L.Icon.Default.prototype._getIconUrl;
                L.Icon.Default.mergeOptions({
                    iconRetinaUrl,
                    iconUrl,
                    shadowUrl,
                });
            })();
        }

        const fetchRecord = async () => {
            if (!id) return;
            try {
                const docRef = doc(firestore, 'multiple_check_inout', id);
                const snap = await getDoc(docRef);
                if (snap.exists()) {
                    setRecord({ id: snap.id, ...snap.data() } as MultipleCheckInOutRecord);
                }
            } catch (error) {
                console.error("Error fetching record:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchRecord();
    }, [id]);

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-[#0a1e60]">
                <Loader2 className="animate-spin text-white w-8 h-8" />
            </div>
        );
    }

    if (!record) {
        return (
            <div className="flex flex-col h-screen bg-[#0a1e60]">
                <div className="px-6 pt-12 pb-6 flex items-center gap-4 text-white">
                    <button onClick={() => router.back()} className="p-2 -ml-2 rounded-full hover:bg-white/10">
                        <ChevronLeft className="w-6 h-6" />
                    </button>
                    <h1 className="text-lg font-bold">Details Not Found</h1>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen bg-slate-100 relative">
            {/* Header - Transparent overlay or fixed top */}
            <div className="absolute top-0 left-0 right-0 z-[1000] px-6 pt-12 pb-4 pointer-events-none">
                <div className="flex items-center gap-4 bg-[#0a1e60] text-white p-4 rounded-2xl shadow-lg pointer-events-auto">
                    <button
                        onClick={() => router.back()}
                        className="p-1 hover:bg-white/10 rounded-full transition-colors"
                    >
                        <ChevronLeft className="w-6 h-6" />
                    </button>
                    <h1 className="text-lg font-bold">Remote Att. Details</h1>
                </div>
            </div>

            {/* Map */}
            <div className="flex-1 w-full h-full z-0">
                <MapContainer
                    center={[record.location.latitude, record.location.longitude]}
                    zoom={15}
                    style={{ height: '100%', width: '100%' }}
                    zoomControl={false}
                >
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <Marker position={[record.location.latitude, record.location.longitude]}>
                        <Popup>
                            {record.location.address || "Check-In Location"}
                        </Popup>
                    </Marker>
                </MapContainer>
            </div>

            {/* Bottom Card Overlay */}
            <div className="absolute bottom-6 left-6 right-6 z-[1000]">
                <div className="bg-white p-5 rounded-2xl shadow-xl">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex gap-2">
                            <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">042</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${record.status === 'Approved' ? 'bg-emerald-100 text-emerald-600' :
                                record.status === 'Rejected' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'
                                }`}>
                                {record.status || 'Pending'}
                            </span>
                            <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded uppercase">
                                {record.type}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 mb-4">
                        <Avatar className="w-12 h-12 border border-slate-100">
                            <AvatarImage src={record.imageURL} />
                            <AvatarFallback className="text-sm bg-slate-200">
                                {record.employeeName?.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                        </Avatar>
                        <div>
                            <h3 className="text-base font-bold text-slate-800">{record.employeeName}</h3>
                            <div className="text-sm font-bold text-indigo-600">
                                {format(new Date(record.timestamp), 'dd-MM-yyyy • hh:mm a')}
                            </div>
                        </div>
                    </div>

                    {/* Address Box */}
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                            <MapPin className="w-4 h-4 text-blue-600" />
                        </div>
                        <div className="text-xs font-semibold text-slate-600 leading-relaxed">
                            {record.location.address || "Address not available"}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

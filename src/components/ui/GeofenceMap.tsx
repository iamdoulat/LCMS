"use client";

import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Circle, useMap, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface GeofenceMapProps {
    userLocation: { lat: number; lng: number; address?: string } | null;
    branchLocation: { lat: number; lng: number; radius: number; name?: string; address?: string } | null;
    hotspots?: { lat: number; lng: number; radius: number; name?: string; address?: string }[];
}

const UserLocationMarker = ({ position, address }: { position: L.LatLng; address?: string }) => {
    const map = useMap();
    useEffect(() => {
        if (position) {
            map.flyTo(position, map.getZoom());
        }
    }, [position, map]);

    const icon = L.divIcon({
        className: 'custom-user-location',
        html: `<div style="
            background-color: #4285F4;
            width: 15px;
            height: 15px;
            border-radius: 50%;
            border: 2px solid white;
            box-shadow: 0 0 10px rgba(0,0,0,0.2);
        "></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
    });

    return (
        <Marker position={position} icon={icon}>
            <Popup>
                <div className="text-sm font-medium">Your Current Location</div>
                {address && <div className="text-xs text-muted-foreground">{address}</div>}
            </Popup>
        </Marker>
    );
};

// Helper component to capture the map instance
const MapCapture = ({ setMap }: { setMap: (map: L.Map) => void }) => {
    const map = useMap();
    useEffect(() => {
        setMap(map);
    }, [map, setMap]);
    return null;
};

export default function GeofenceMap({ userLocation, branchLocation, hotspots = [], onRefresh, isLoading }: GeofenceMapProps & { onRefresh?: () => void, isLoading?: boolean }) {
    const [map, setMap] = useState<L.Map | null>(null);

    const defaultCenter: [number, number] = branchLocation
        ? [branchLocation.lat, branchLocation.lng]
        : (userLocation ? [userLocation.lat, userLocation.lng] : [23.8103, 90.4125]);

    const handleRecenter = () => {
        if (map && userLocation) {
            map.flyTo([userLocation.lat, userLocation.lng], map.getZoom());
        }
    };

    return (
        <div className="relative h-[250px] w-full rounded-md overflow-hidden bg-slate-50 border border-slate-200 isolate">
            {/* Layer 1: Map Container */}
            <div className="absolute inset-0 z-0">
                <MapContainer
                    center={defaultCenter}
                    zoom={16}
                    scrollWheelZoom={true}
                    style={{ height: '100%', width: '100%' }}
                    zoomControl={false} // Disable default zoom control to avoid clutter
                >
                    <MapCapture setMap={setMap} />
                    <TileLayer
                        attribution='&copy; Google Maps'
                        url="http://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
                        subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
                    />

                    {/* Branch Circle */}
                    {branchLocation && (
                        <>
                            <Circle
                                center={[branchLocation.lat, branchLocation.lng]}
                                radius={branchLocation.radius}
                                pathOptions={{ color: '#4285F4', fillColor: '#4285F4', fillOpacity: 0.15, weight: 2 }}
                            />
                            <Marker
                                position={[branchLocation.lat, branchLocation.lng]}
                                icon={L.divIcon({
                                    className: 'branch-marker',
                                    html: `<div style="background-color: #EA4335; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 5px rgba(0,0,0,0.3);"></div>`,
                                    iconSize: [16, 16],
                                    iconAnchor: [8, 8]
                                })}
                            >
                                <Popup>
                                    <div className="text-sm font-bold">{branchLocation.name || 'Branch Center'}</div>
                                    {branchLocation.address && <div className="text-xs text-muted-foreground">{branchLocation.address}</div>}
                                </Popup>
                            </Marker>
                        </>
                    )}

                    {/* Hotspots Rendering */}
                    {hotspots && hotspots.map((hotspot, idx) => (
                        <React.Fragment key={`hotspot-${idx}`}>
                            <Circle
                                center={[hotspot.lat, hotspot.lng]}
                                radius={hotspot.radius}
                                pathOptions={{
                                    fillColor: '#9333ea',
                                    fillOpacity: 0.15,
                                    color: '#9333ea',
                                    weight: 1,
                                    dashArray: '5, 5'
                                }}
                            />
                            <Marker
                                position={[hotspot.lat, hotspot.lng]}
                                icon={L.divIcon({
                                    className: 'hotspot-marker',
                                    html: `<div style="background-color: #9333ea; width: 10px; height: 10px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 5px rgba(0,0,0,0.3);"></div>`,
                                    iconSize: [14, 14],
                                    iconAnchor: [7, 7]
                                })}
                            >
                                <Popup>
                                    <div className="text-sm font-bold">Hotspot: {hotspot.name}</div>
                                    {hotspot.address && <div className="text-xs text-muted-foreground">{hotspot.address}</div>}
                                </Popup>
                            </Marker>
                        </React.Fragment>
                    ))}

                    {/* User Location Marker */}
                    {userLocation && (
                        <UserLocationMarker position={new L.LatLng(userLocation.lat, userLocation.lng)} address={userLocation.address} />
                    )}
                </MapContainer>
            </div>

            {/* Layer 2: Controls - Explicitly on top */}
            <div className="absolute top-3 right-3 z-[1000] flex flex-col gap-2 pointer-events-auto">
                {/* Refresh Button */}
                {onRefresh && (
                    <button
                        className="bg-white p-2 hover:bg-slate-50 focus:outline-none flex items-center justify-center w-9 h-9 shadow-sm rounded-lg border border-slate-200 text-slate-700 transition-colors"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onRefresh();
                        }}
                        disabled={isLoading}
                        title="Refresh Location"
                        type="button"
                    >
                        {isLoading ? (
                            <div className="h-4 w-4 border-2 border-primary border-t-transparent animate-spin rounded-full"></div>
                        ) : (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 2v6h-6" />
                                <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
                                <path d="M3 22v-6h6" />
                                <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
                            </svg>
                        )}
                    </button>
                )}

                {/* Recenter Button */}
                <button
                    className="bg-white p-2 hover:bg-slate-50 focus:outline-none flex items-center justify-center w-9 h-9 shadow-sm rounded-lg border border-slate-200 text-slate-700 transition-colors"
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleRecenter();
                    }}
                    title="Recenter"
                    type="button"
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <circle cx="12" cy="12" r="3" />
                        <line x1="12" y1="2" x2="12" y2="22" />
                        <line x1="2" y1="12" x2="22" y2="12" />
                    </svg>
                </button>
            </div>

            {/* Layer 3: Legend - Explicitly on top */}
            <div className="absolute top-3 left-3 z-[1000] pointer-events-none">
                <div className="bg-white/95 backdrop-blur-sm px-2.5 py-2 rounded-lg border border-slate-200 shadow-sm flex flex-col gap-1.5 text-[10px] font-medium text-slate-600">
                    <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 bg-[#4285F4] rounded-full border border-white shadow-sm"></div>
                        <span>You</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 bg-[#EA4335] rounded-full border border-white shadow-sm"></div>
                        <span>Branch</span>
                    </div>
                    {hotspots.length > 0 && (
                        <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 bg-[#9333ea] rounded-full border border-white shadow-sm"></div>
                            <span>Hotspot</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

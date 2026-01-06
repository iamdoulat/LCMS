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
        <div className="relative h-[250px] w-full rounded-lg overflow-hidden border border-slate-200">
            {/* Map Layer - Explicitly behind everything */}
            <div
                className="absolute inset-0"
                style={{ zIndex: 1 }}
            >
                <MapContainer
                    center={defaultCenter}
                    zoom={16}
                    scrollWheelZoom={true}
                    style={{ height: '100%', width: '100%' }}
                    zoomControl={false}
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

            {/* Floating Control Buttons - Simple approach */}
            <div
                className="absolute top-2 right-2 flex flex-col gap-2"
                style={{
                    zIndex: 9999,
                    pointerEvents: 'auto'
                }}
            >
                {/* Refresh Button */}
                {onRefresh && (
                    <button
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onRefresh();
                        }}
                        disabled={isLoading}
                        title="Refresh Location"
                        type="button"
                        className="w-10 h-10 bg-white rounded-lg shadow-lg border-2 border-slate-300 hover:bg-blue-50 hover:border-blue-400 flex items-center justify-center transition-all"
                        style={{
                            zIndex: 10000
                        }}
                    >
                        {isLoading ? (
                            <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600">
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
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleRecenter();
                    }}
                    title="Recenter Map"
                    type="button"
                    className="w-10 h-10 bg-white rounded-lg shadow-lg border-2 border-slate-300 hover:bg-blue-50 hover:border-blue-400 flex items-center justify-center transition-all"
                    style={{
                        zIndex: 10000
                    }}
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-blue-600">
                        <circle cx="12" cy="12" r="10" />
                        <circle cx="12" cy="12" r="3" />
                        <line x1="12" y1="2" x2="12" y2="22" />
                        <line x1="2" y1="12" x2="22" y2="12" />
                    </svg>
                </button>
            </div>

            {/* Legend */}
            <div
                className="absolute top-2 left-2 bg-white/95 backdrop-blur-sm px-3 py-2 rounded-lg border border-slate-200 shadow-md"
                style={{ zIndex: 9999 }}
            >
                <div className="flex flex-col gap-1.5 text-[11px] font-medium">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-blue-500 rounded-full border-2 border-white shadow-sm"></div>
                        <span className="text-slate-700">You</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-red-500 rounded-full border-2 border-white shadow-sm"></div>
                        <span className="text-slate-700">Branch</span>
                    </div>
                    {hotspots.length > 0 && (
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-purple-600 rounded-full border-2 border-white shadow-sm"></div>
                            <span className="text-slate-700">Hotspot</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

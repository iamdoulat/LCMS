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

interface LocateControlProps {
    targetLocation: { lat: number; lng: number } | null;
}

const LocateControl = ({ targetLocation }: LocateControlProps) => {
    const map = useMap();

    const handleRecenter = () => {
        if (targetLocation) {
            map.flyTo([targetLocation.lat, targetLocation.lng], map.getZoom());
        }
    };

    return (
        <div className="leaflet-top leaflet-right z-[1100]" style={{ marginTop: '60px', marginRight: '10px' }}>
            <div className="leaflet-control leaflet-bar">
                <button
                    className="bg-white p-2 hover:bg-gray-50 focus:outline-none flex items-center justify-center w-10 h-10 shadow-md rounded"
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleRecenter();
                    }}
                    title="Recenter"
                    type="button"
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <circle cx="12" cy="12" r="3" />
                        <line x1="12" y1="2" x2="12" y2="22" />
                        <line x1="2" y1="12" x2="22" y2="12" />
                    </svg>
                </button>
            </div>
        </div>
    );
};

interface RefreshControlProps {
    onRefresh: () => void;
    isLoading?: boolean;
}

const RefreshControl = ({ onRefresh, isLoading }: RefreshControlProps) => {
    return (
        <div className="leaflet-top leaflet-right z-[1100]" style={{ marginTop: '10px', marginRight: '10px' }}>
            <div className="leaflet-control leaflet-bar">
                <button
                    className="bg-white p-2 hover:bg-gray-50 focus:outline-none flex items-center justify-center w-10 h-10 shadow-md rounded text-primary"
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
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 2v6h-6" />
                            <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
                            <path d="M3 22v-6h6" />
                            <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
                        </svg>
                    )}
                </button>
            </div>
        </div>
    );
};

export default function GeofenceMap({ userLocation, branchLocation, hotspots = [], onRefresh, isLoading }: GeofenceMapProps & { onRefresh?: () => void, isLoading?: boolean }) {
    const defaultCenter: [number, number] = branchLocation
        ? [branchLocation.lat, branchLocation.lng]
        : (userLocation ? [userLocation.lat, userLocation.lng] : [23.8103, 90.4125]);

    return (
        <div className="h-[250px] w-full rounded-md overflow-hidden border z-0 relative">
            <MapContainer
                center={defaultCenter}
                zoom={16}
                scrollWheelZoom={true}
                style={{ height: '100%', width: '100%' }}
            >
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

                <LocateControl targetLocation={userLocation} />
                {onRefresh && <RefreshControl onRefresh={onRefresh} isLoading={isLoading} />}
            </MapContainer>

            {/* Floating Legend - More compact */}
            <div className="absolute top-2 left-2 z-[1000] bg-white/90 backdrop-blur-sm px-2 py-1.5 rounded border border-gray-100 flex flex-col gap-1 pointer-events-none text-[9px] shadow-sm">
                <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 bg-[#4285F4] rounded-full"></div>
                    <span className="text-gray-600">You</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 bg-[#EA4335] rounded-full"></div>
                    <span className="text-gray-600">Branch</span>
                </div>
                {hotspots.length > 0 && (
                    <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 bg-[#9333ea] rounded-full"></div>
                        <span className="text-gray-600">Hotspot</span>
                    </div>
                )}
            </div>

        </div>
    );
}

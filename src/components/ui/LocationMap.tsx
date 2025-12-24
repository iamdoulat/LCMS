"use client";

import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icon in Leaflet with Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface LocationMapProps {
    latitude?: number;
    longitude?: number;
    radius?: number;
    onLocationSelect: (lat: number, lng: number) => void;
    onAddressFound?: (address: string) => void;
}

// Helper components defined outside to prevent recreation on render
const LocationMarker = ({ position, setPosition }: { position: L.LatLng | null, setPosition: (pos: L.LatLng) => void }) => {
    const map = useMapEvents({
        click(e) {
            setPosition(e.latlng);
            map.flyTo(e.latlng, map.getZoom());
        },
    });

    useEffect(() => {
        if (position) {
            map.flyTo(position, map.getZoom());
        }
    }, [position, map]);

    return position === null ? null : (
        <Marker position={position}></Marker>
    );
};

const RecenterMap = ({ lat, lng }: { lat: number, lng: number }) => {
    const map = useMap();
    useEffect(() => {
        map.setView([lat, lng]);
    }, [lat, lng, map]);
    return null;
}

export default function LocationMap({ latitude, longitude, radius, onLocationSelect, onAddressFound }: LocationMapProps) {
    const defaultCenter = { lat: 23.8103, lng: 90.4125 }; // Dhaka center as default
    const [position, setPosition] = useState<L.LatLng | null>(
        latitude && longitude ? new L.LatLng(latitude, longitude) : new L.LatLng(defaultCenter.lat, defaultCenter.lng)
    );

    // Use passed props to initialize, but don't strictly bind if user moves it?
    // Actually, if we are editing, we want to show saved location. 
    // If we click, we update parent. 

    useEffect(() => {
        if (latitude && longitude) {
            setPosition(new L.LatLng(latitude, longitude));
        }
    }, [latitude, longitude]);

    const handlePositionChange = async (newPos: L.LatLng) => {
        setPosition(newPos);
        onLocationSelect(newPos.lat, newPos.lng);

        if (onAddressFound) {
            try {
                const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${newPos.lat}&lon=${newPos.lng}`);
                const data = await response.json();
                if (data && data.display_name) {
                    onAddressFound(data.display_name);
                }
            } catch (error) {
                console.error("Failed to fetch address:", error);
            }
        }
    };

    return (
        <div className="h-[300px] w-full rounded-md overflow-hidden border z-0">
            <MapContainer
                center={position || [defaultCenter.lat, defaultCenter.lng]}
                zoom={15}
                scrollWheelZoom={true}
                style={{ height: '100%', width: '100%' }}
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {position && radius && radius > 0 && (
                    <Circle
                        center={[position.lat, position.lng]}
                        radius={radius}
                        pathOptions={{
                            color: '#4285F4',
                            fillColor: '#4285F4',
                            fillOpacity: 0.15,
                            weight: 2,
                            dashArray: '5, 10'
                        }}
                    />
                )}

                <LocationMarker position={position} setPosition={handlePositionChange} />
                {/* Recenter mechanism if needed */}
            </MapContainer>
        </div>
    );
}

"use client";

import React, { useRef, useState, useEffect } from 'react';
import { Camera, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface CameraCaptureProps {
    onCapture: (file: File) => void;
    onCancel: () => void;
}

export function CameraCapture({ onCapture, onCancel }: CameraCaptureProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [error, setError] = useState<string>('');
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        // Check if device is mobile
        const checkMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        setIsMobile(checkMobile);

        if (!checkMobile) {
            setError('Camera capture is only available on mobile devices');
            return;
        }

        startCamera();

        return () => {
            stopCamera();
        };
    }, []);

    const startCamera = async () => {
        try {
            const mediaStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'user', // Front camera
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                },
                audio: false,
            });

            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream;
            }
            setStream(mediaStream);
        } catch (err) {
            console.error('Error accessing camera:', err);
            setError('Could not access camera. Please grant camera permissions.');
        }
    };

    const stopCamera = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
        }
    };

    const capturePhoto = () => {
        if (!videoRef.current || !canvasRef.current) return;

        const video = videoRef.current;
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');

        if (!context) return;

        // Set canvas dimensions to match video
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        // Draw video frame to canvas
        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Convert canvas to blob
        canvas.toBlob((blob) => {
            if (blob) {
                const file = new File([blob], `checkin_${Date.now()}.jpg`, { type: 'image/jpeg' });
                stopCamera();
                onCapture(file);
            }
        }, 'image/jpeg', 0.9);
    };

    if (error) {
        return (
            <Card className="p-6">
                <div className="text-center">
                    <p className="text-destructive mb-4">{error}</p>
                    <Button onClick={onCancel} variant="outline">
                        Close
                    </Button>
                </div>
            </Card>
        );
    }

    return (
        <Card className="p-4">
            <div className="space-y-4">
                <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                    />
                    <canvas ref={canvasRef} className="hidden" />
                </div>

                <div className="flex gap-2 justify-center">
                    <Button onClick={capturePhoto} size="lg" className="flex-1">
                        <Camera className="mr-2 h-5 w-5" />
                        Capture Photo
                    </Button>
                    <Button onClick={() => { stopCamera(); onCancel(); }} variant="outline" size="lg">
                        <X className="mr-2 h-5 w-5" />
                        Cancel
                    </Button>
                </div>
            </div>
        </Card>
    );
}

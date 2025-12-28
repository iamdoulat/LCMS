
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Loader2 } from 'lucide-react';

interface DeviceApprovalPopupProps {
    isOpen: boolean;
    onCheckNow: () => Promise<void>;
    onTryNewUser: () => void;
}

export function DeviceApprovalPopup({ isOpen, onCheckNow, onTryNewUser }: DeviceApprovalPopupProps) {
    const [isLoading, setIsLoading] = useState(false);

    const handleCheckNow = async () => {
        setIsLoading(true);
        try {
            await onCheckNow();
        } catch (error) {
            console.error("Check failed", error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={() => { }}>
            <DialogContent className="sm:max-w-md [&>button]:hidden">
                <DialogHeader className="flex flex-col items-center justify-center text-center space-y-4">
                    <div className="w-48 h-48 relative mb-4">
                        {/* Placeholder for the illustration from the screenshot. 
                    In a real implementation, use the generate_image tool or an asset. 
                    For now, I'll use a descriptive placeholder or checking animation. 
                 */}
                        <img
                            src="/api/placeholder/400/320"
                            alt="Pending Approval"
                            className="object-contain w-full h-full"
                            style={{ display: 'none' }} // Hide until real image is available, or use SVG
                        />
                        <div className="flex items-center justify-center w-full h-full bg-blue-50 rounded-full">
                            <Loader2 className="h-16 w-16 text-blue-500 animate-spin" />
                        </div>
                    </div>
                    <DialogTitle className="text-xl font-bold text-blue-900">
                        Your Request is Pending for Approval
                    </DialogTitle>
                    <DialogDescription className="text-center text-gray-600 font-medium">
                        This device is awaiting approval from HR. Please wait or try again later.
                    </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col space-y-3 py-4 w-full">
                    <Button
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-6 rounded-xl"
                        onClick={handleCheckNow}
                        disabled={isLoading}
                    >
                        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Check Again
                    </Button>
                    <Button
                        className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-6 rounded-xl"
                        onClick={onTryNewUser}
                    >
                        Try Later
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

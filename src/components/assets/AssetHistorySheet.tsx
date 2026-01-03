"use client";

import React from 'react';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from '@/components/ui/sheet';
import { useFirestoreQuery } from '@/hooks/useFirestoreQuery';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';
import type { AssetDistributionDocument } from '@/types';
import { format, parseISO } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from "@/components/ui/scroll-area";

interface AssetHistorySheetProps {
    assetId: string | null;
    isOpen: boolean;
    onClose: () => void;
    assetName: string;
}

export function AssetHistorySheet({ assetId, isOpen, onClose, assetName }: AssetHistorySheetProps) {
    const { data: history, isLoading } = useFirestoreQuery<AssetDistributionDocument[]>(
        assetId ? query(
            collection(firestore, "asset_distributions"),
            where("assetId", "==", assetId),
            orderBy("startDate", "desc")
        ) : null,
        { enabled: !!assetId },
        ['asset_distributions_history', assetId]
    );

    return (
        <Sheet open={isOpen} onOpenChange={onClose}>
            <SheetContent className="w-[400px] sm:w-[540px]">
                <SheetHeader className="mb-6">
                    <SheetTitle>Distribution History</SheetTitle>
                    <SheetDescription>
                        History of assignment for <strong>{assetName}</strong>
                    </SheetDescription>
                </SheetHeader>

                <ScrollArea className="h-[calc(100vh-120px)] pr-4">
                    <div className="space-y-6">
                        {isLoading ? (
                            Array.from({ length: 3 }).map((_, i) => (
                                <div key={i} className="flex gap-4">
                                    <Skeleton className="h-10 w-10 rounded-full" />
                                    <div className="space-y-2 flex-1">
                                        <Skeleton className="h-4 w-32" />
                                        <Skeleton className="h-4 w-24" />
                                    </div>
                                </div>
                            ))
                        ) : history && history.length > 0 ? (
                            history.map((record) => (
                                <div key={record.id} className="relative pl-6 border-l-2 border-muted pb-6 last:pb-0 last:border-0">
                                    <div className="absolute -left-[9px] top-0 h-4 w-4 rounded-full bg-primary border-4 border-background" />
                                    <div className="flex items-start gap-4">
                                        <Avatar className="h-10 w-10 border">
                                            <AvatarImage src={record.employeePhotoUrl} />
                                            <AvatarFallback>{record.employeeName.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        <div className="space-y-1">
                                            <p className="text-sm font-medium leading-none">{record.employeeName}</p>
                                            <p className="text-xs text-muted-foreground">{record.employeeDesignation}</p>

                                            <div className="flex items-center gap-2 mt-2">
                                                <Badge variant="outline" className="text-xs">
                                                    {format(parseISO(record.startDate), 'MMM dd, yyyy')}
                                                </Badge>
                                                <span className="text-xs text-muted-foreground">to</span>
                                                <Badge variant="outline" className="text-xs">
                                                    {record.endDate ? format(parseISO(record.endDate), 'MMM dd, yyyy') : 'Present'}
                                                </Badge>
                                            </div>

                                            <div className="mt-2">
                                                <Badge variant={record.status === 'Returned' ? 'secondary' : 'default'} className="text-[10px] h-5">
                                                    {record.status}
                                                </Badge>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center text-muted-foreground py-10">
                                No distribution history found for this asset.
                            </div>
                        )}
                    </div>
                </ScrollArea>
            </SheetContent>
        </Sheet>
    );
}

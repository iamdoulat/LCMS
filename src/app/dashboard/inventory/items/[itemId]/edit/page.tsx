
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Package as PackageIcon, Loader2, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { EditItemForm } from '@/components/forms/EditItemForm';
import { firestore } from '@/lib/firebase/config';
import { doc, getDoc } from 'firebase/firestore';
import type { ItemDocument } from '@/types';
import Swal from 'sweetalert2';
import { cn } from '@/lib/utils';

export default function EditItemPage() {
  const params = useParams();
  const router = useRouter();
  const itemId = params.itemId as string;

  const [itemData, setItemData] = useState<ItemDocument | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchItemData = useCallback(async () => {
    if (!itemId) {
      setError("No Item ID provided.");
      setIsLoading(false);
      Swal.fire("Error", "No Item ID specified.", "error").then(() => {
        router.push('/dashboard/inventory/items/list');
      });
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const itemDocRef = doc(firestore, "items", itemId);
      const itemDocSnap = await getDoc(itemDocRef);

      if (itemDocSnap.exists()) {
        setItemData({ id: itemDocSnap.id, ...itemDocSnap.data() } as ItemDocument);
      } else {
        setError("Item not found.");
        Swal.fire("Error", `Item with ID ${itemId} not found.`, "error");
        router.push('/dashboard/inventory/items/list');
      }
    } catch (err: any) {
      console.error("Error fetching item data: ", err);
      setError(`Failed to fetch item data: ${err.message}`);
      Swal.fire("Error", `Failed to fetch item data: ${err.message}`, "error");
    } finally {
      setIsLoading(false);
    }
  }, [itemId, router]);

  useEffect(() => {
    fetchItemData();
  }, [fetchItemData]);



  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-5 flex flex-col items-center justify-center min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading item details for ID: {itemId}...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8 px-5">
        <Card className="max-w-5xl mx-auto shadow-xl border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl font-bold text-destructive">
              <AlertTriangle className="h-7 w-7" />
              Error Loading Item
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-destructive-foreground">{error}</p>
            <Button variant="outline" asChild className="mt-4">
              <Link href="/dashboard/inventory/items/list">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Items List
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!itemData) {
    return (
      <div className="container mx-auto py-8 px-5 text-center">
        <p className="text-muted-foreground">Item data could not be loaded.</p>
        <Button variant="outline" asChild className="mt-4">
          <Link href="/dashboard/inventory/items/list">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Items List
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-5">
      <div className="mb-6">
        <Link href="/dashboard/inventory/items/list" passHref>
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Items List
          </Button>
        </Link>
      </div>
      <Card className="max-w-[68rem] mx-auto shadow-xl">
        <CardHeader>
          <CardTitle className={cn("flex items-center gap-2", "font-bold text-2xl lg:text-3xl bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
            <PackageIcon className="h-7 w-7 text-primary" />
            Edit Item
          </CardTitle>
          <CardDescription>
            Modify the details for item: <span className="font-semibold text-foreground">{itemData.itemName} (ID: {itemId})</span>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EditItemForm initialData={itemData} itemId={itemId} />
        </CardContent>
      </Card>
    </div>
  );
}

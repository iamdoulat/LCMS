
"use client"

import React from 'react'
import { AddHotspotForm } from '@/components/forms/hr'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function AddHotspotPage() {
    const router = useRouter()

    return (
        <div className="container mx-auto py-8 max-w-5xl px-[25px]">
            <div className="mb-6">
                <Button variant="ghost" onClick={() => router.back()} className="gap-2 pl-0 hover:bg-transparent hover:text-primary">
                    <ArrowLeft className="h-4 w-4" /> Back to Hotspots
                </Button>
                <h1 className="text-3xl font-bold tracking-tight mt-2 text-primary">Add New Hotspot</h1>
                <p className="text-muted-foreground">Create a new geofenced location for attendance.</p>
            </div>

            <Card className="shadow-lg border-t-4 border-t-primary">
                <CardHeader>
                    <CardTitle>Hotspot Details</CardTitle>
                    <CardDescription>Fill in the details to setup a new hotspot.</CardDescription>
                </CardHeader>
                <CardContent>
                    <AddHotspotForm />
                </CardContent>
            </Card>
        </div>
    )
}


"use client"

import React, { useEffect, useState } from 'react'
import { EditHotspotForm } from '@/components/forms/EditHotspotForm'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { useRouter, useParams } from 'next/navigation'
import { doc, getDoc } from 'firebase/firestore'
import { firestore } from '@/lib/firebase/config'
import type { HotspotDocument } from '@/types'

export default function EditHotspotPage() {
    const router = useRouter()
    const params = useParams()
    const hotspotId = params.hotspotId as string
    const [hotspotData, setHotspotData] = useState<HotspotDocument | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const fetchHotspot = async () => {
            try {
                const docRef = doc(firestore, 'hotspots', hotspotId)
                const docSnap = await getDoc(docRef)

                if (docSnap.exists()) {
                    setHotspotData({ id: docSnap.id, ...docSnap.data() } as HotspotDocument)
                } else {
                    setError("Hotspot not found.")
                }
            } catch (err: any) {
                console.error("Error fetching hotspot:", err)
                setError(err.message || "Failed to load hotspot data.")
            } finally {
                setIsLoading(false)
            }
        }

        if (hotspotId) {
            fetchHotspot()
        }
    }, [hotspotId])

    if (isLoading) {
        return (
            <div className="container mx-auto py-20 flex justify-center items-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    if (error || !hotspotData) {
        return (
            <div className="container mx-auto py-20 text-center">
                <h2 className="text-xl font-semibold text-destructive">Error</h2>
                <p className="text-muted-foreground">{error || "Something went wrong."}</p>
                <Button variant="outline" className="mt-4" onClick={() => router.back()}>Go Back</Button>
            </div>
        )
    }

    return (
        <div className="container mx-auto py-8 max-w-5xl px-[25px]">
            <div className="mb-6">
                <Button variant="ghost" onClick={() => router.back()} className="gap-2 pl-0 hover:bg-transparent hover:text-primary">
                    <ArrowLeft className="h-4 w-4" /> Back to Hotspots
                </Button>
                <h1 className="text-3xl font-bold tracking-tight mt-2 text-primary">Edit Hotspot: {hotspotData.name}</h1>
                <p className="text-muted-foreground">Modify geofencing settings for this location.</p>
            </div>

            <Card className="shadow-lg border-t-4 border-t-primary">
                <CardHeader>
                    <CardTitle>Hotspot Details</CardTitle>
                    <CardDescription>Update the settings below.</CardDescription>
                </CardHeader>
                <CardContent>
                    <EditHotspotForm initialData={hotspotData} />
                </CardContent>
            </Card>
        </div>
    )
}

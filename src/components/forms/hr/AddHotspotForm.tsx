
"use client"

import React, { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from "@/components/ui/button"
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Loader2, MapPin, Info } from 'lucide-react'
import { useToast } from "@/hooks/use-toast"
import { useRouter } from 'next/navigation'
import { doc, setDoc, collection, getDocs, query, orderBy, serverTimestamp } from 'firebase/firestore'
import { firestore } from '@/lib/firebase/config'
import { HotspotSchema, type HotspotFormValues, type BranchDocument } from '@/types'
import dynamic from 'next/dynamic'

// Dynamically import LocationMap to avoid SSR issues with Leaflet
const LocationMap = dynamic(() => import('@/components/ui/LocationMap'), {
    ssr: false,
    loading: () => <div className="h-[300px] w-full bg-muted animate-pulse rounded-md flex items-center justify-center">Loading Map...</div>
})

interface AddHotspotFormProps {
    onSuccess?: () => void
}

export function AddHotspotForm({ onSuccess }: AddHotspotFormProps) {
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [branches, setBranches] = useState<BranchDocument[]>([])
    const [isLoadingBranches, setIsLoadingBranches] = useState(true)
    const { toast } = useToast()
    const router = useRouter()

    const form = useForm<HotspotFormValues>({
        resolver: zodResolver(HotspotSchema),
        defaultValues: {
            name: '',
            branchId: '',
            allowRadius: 50,
            address: '',
            latitude: 23.8103, // Default Dhaka
            longitude: 90.4125,
            isActive: true,
            requireRemoteAttendanceApproval: false,
        },
    })

    useEffect(() => {
        const fetchBranches = async () => {
            try {
                const q = query(collection(firestore, 'branches'), orderBy('name', 'asc'))
                const snapshot = await getDocs(q)
                const branchData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BranchDocument))
                setBranches(branchData)
            } catch (error) {
                console.error("Error fetching branches:", error)
                toast({ title: "Error", description: "Failed to load branches.", variant: "destructive" })
            } finally {
                setIsLoadingBranches(false)
            }
        }
        fetchBranches()
    }, [toast])

    const onSubmit = async (values: HotspotFormValues) => {
        setIsSubmitting(true)
        try {
            const selectedBranch = branches.find(b => b.id === values.branchId)
            const hotspotId = `HOTSPOT-${Date.now()}`
            const hotspotRef = doc(firestore, 'hotspots', hotspotId)

            await setDoc(hotspotRef, {
                id: hotspotId,
                ...values,
                branchName: selectedBranch?.name || 'Unknown',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            })

            toast({ title: "Success", description: "Hotspot created successfully." })
            router.push('/dashboard/hr/settings/hotspots')
            if (onSuccess) onSuccess()
        } catch (error: any) {
            console.error("Error creating hotspot:", error)
            toast({ title: "Error", description: error.message || "Failed to create hotspot.", variant: "destructive" })
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

                {/* Row 1: Hotspot Name & Radius */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="flex items-center gap-1">Hotspot name <span className="text-destructive">*</span></FormLabel>
                                <FormControl>
                                    <Input placeholder="e.g. Dhaka" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="allowRadius"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="flex items-center gap-1">Radius in Meter <span className="text-destructive">*</span></FormLabel>
                                <FormControl>
                                    <Input
                                        type="number"
                                        placeholder="e.g. 50"
                                        {...field}
                                        onChange={e => field.onChange(e.target.value)}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                {/* Row 2: Branch */}
                <FormField
                    control={form.control}
                    name="branchId"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Branch</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isLoadingBranches}>
                                <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a branch" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {branches.map((branch) => (
                                        <SelectItem key={branch.id} value={branch.id}>
                                            {branch.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                {/* Row 3: Checkbox */}
                <FormField
                    control={form.control}
                    name="requireRemoteAttendanceApproval"
                    render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md p-2">
                            <FormControl>
                                <Checkbox
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                                <FormLabel className="font-bold text-sm">
                                    Approval is required for remote attendance of employees of other branches
                                </FormLabel>
                                <div className="flex items-center text-muted-foreground pt-1">
                                    <Info className="h-4 w-4" />
                                </div>
                            </div>
                        </FormItem>
                    )}
                />

                {/* Row 4: Address (Hotspot Location) */}
                <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Hotspot Location</FormLabel>
                            <FormControl>
                                <Input placeholder="Full Address" {...field} readOnly className="bg-muted/20" />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                {/* Row 5: Map */}
                <div className="space-y-2">
                    <h4 className="text-sm font-medium text-foreground">Please point your hotspot location</h4>
                    <Card className="overflow-hidden border border-muted">
                        <LocationMap
                            latitude={form.watch('latitude')}
                            longitude={form.watch('longitude')}
                            radius={Number(form.watch('allowRadius'))}
                            onLocationSelect={(lat, lng) => {
                                form.setValue('latitude', lat)
                                form.setValue('longitude', lng)
                            }}
                            onAddressFound={(address) => {
                                form.setValue('address', address)
                            }}
                        />
                    </Card>
                </div>

                {/* Hidden Lat/Lng fields or just stored */}


                <div className="flex justify-end gap-4 pt-4 border-t">
                    <Button type="button" variant="outline" className="bg-primary-foreground text-primary hover:bg-primary/10 border-primary-100" onClick={() => router.back()}>Cancel</Button>
                    <Button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 text-white min-w-[100px]">
                        {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : 'Save'}
                    </Button>
                </div>
            </form>
        </Form>
    )
}

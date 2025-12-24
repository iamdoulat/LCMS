
"use client"

import React, { useState, useMemo } from 'react'
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, Search, Lightbulb, Bookmark, Hexagon } from "lucide-react" // Using Hexagon as generic shape placeholder if needed, User has specific icons top right
import { HotspotListTable } from '@/components/dashboard/hr/HotspotListTable'
import { useFirestoreQuery } from '@/hooks/useFirestoreQuery'
import { collection, query, orderBy } from 'firebase/firestore'
import { firestore } from '@/lib/firebase/config'
import Link from 'next/link'
import { useAuth } from '@/context/AuthContext'
import type { HotspotDocument } from '@/types'

export default function HotspotSetupPage() {
    const { userRole } = useAuth()
    const [searchQuery, setSearchQuery] = useState('')

    const { data: hotspots, isLoading } = useFirestoreQuery<HotspotDocument[]>(
        query(collection(firestore, 'hotspots'), orderBy("createdAt", "desc")),
        undefined,
        ['hotspots']
    )

    const filteredHotspots = useMemo(() => {
        if (!hotspots) return []
        if (!searchQuery) return hotspots
        const lowerQuery = searchQuery.toLowerCase()
        return hotspots.filter(h =>
            h.name.toLowerCase().includes(lowerQuery) ||
            h.branchName.toLowerCase().includes(lowerQuery) ||
            (h.address && h.address.toLowerCase().includes(lowerQuery))
        )
    }, [hotspots, searchQuery])

    return (
        <div className="container mx-auto py-8">
            <div className="flex items-center justify-between bg-primary p-4 rounded-t-lg text-primary-foreground mb-0">
                <h1 className="text-xl font-semibold">Hotspot Setup</h1>
                <div className="flex gap-2">
                    <Button variant="ghost" size="icon" className="hover:bg-primary-foreground/10 text-primary-foreground"><Lightbulb className="h-5 w-5" /></Button>
                    <Button variant="ghost" size="icon" className="hover:bg-primary-foreground/10 text-primary-foreground"><Bookmark className="h-5 w-5" /></Button>
                    {/* Add more icons as per screenshot if needed */}
                </div>
            </div>

            <Card className="rounded-t-none border-t-0 shadow-md">
                <CardContent className="p-6">
                    <div className="flex justify-between items-center mb-6 gap-4">
                        <div className="relative w-[300px]">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search"
                                className="pl-9 bg-muted/50 border-none"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <Button asChild className="bg-blue-600 hover:bg-blue-700 text-white">
                            <Link href="/dashboard/hr/settings/hotspots/add">
                                <Plus className="mr-2 h-4 w-4" /> Add New
                            </Link>
                        </Button>
                    </div>

                    <HotspotListTable
                        data={filteredHotspots}
                        isLoading={isLoading}
                        userRole={userRole?.[0]}
                    />

                    {/* Pagination could go here, for now relying on scroll or basic pagination if data gets large */}
                </CardContent>
            </Card>
        </div>
    )
}

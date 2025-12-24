
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Edit } from "lucide-react"
import { useRouter } from "next/navigation"
import type { HotspotDocument } from "@/types"

interface HotspotListTableProps {
    data: HotspotDocument[]
    isLoading: boolean
    userRole?: string
}

export function HotspotListTable({ data, isLoading, userRole }: HotspotListTableProps) {
    const router = useRouter()
    const isReadOnly = userRole === 'Viewer'

    if (isLoading) {
        return (
            <div className="rounded-md border">
                <Table>
                    <TableHeader><TableRow><TableHead>Hotspot name</TableHead><TableHead>Branch</TableHead><TableHead>Allow Radius</TableHead><TableHead>Address</TableHead><TableHead>Latitude</TableHead><TableHead>Longitude</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                    <TableBody>
                        {[1, 2, 3].map((i) => (
                            <TableRow key={i}>
                                <TableCell className="h-12 animate-pulse bg-muted/50" colSpan={7} />
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        )
    }

    if (!data?.length) {
        return <div className="text-center py-10 text-muted-foreground">No hotspots found.</div>
    }

    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Hotspot name</TableHead>
                        <TableHead>Branch</TableHead>
                        <TableHead>Allow Radius</TableHead>
                        <TableHead>Address</TableHead>
                        <TableHead>Latitude</TableHead>
                        <TableHead>Longitude</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {data.map((hotspot) => (
                        <TableRow key={hotspot.id}>
                            <TableCell className="font-medium">{hotspot.name}</TableCell>
                            <TableCell>{hotspot.branchName}</TableCell>
                            <TableCell>{hotspot.allowRadius} m</TableCell>
                            <TableCell className="max-w-[300px] truncate" title={hotspot.address}>{hotspot.address || '-'}</TableCell>
                            <TableCell>{hotspot.latitude}</TableCell>
                            <TableCell>{hotspot.longitude}</TableCell>
                            <TableCell className="text-right">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => router.push(`/dashboard/hr/settings/hotspots/edit/${hotspot.id}`)}
                                    disabled={isReadOnly}
                                >
                                    <Edit className="h-4 w-4" />
                                </Button>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}

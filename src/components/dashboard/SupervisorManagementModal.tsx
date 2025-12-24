
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Input } from '@/components/ui/input';
import { Trash2, Plus, CalendarIcon } from 'lucide-react';
import { EmployeeDocument, SupervisorConfig } from '@/types';
import Swal from 'sweetalert2';
import { format, parseISO } from 'date-fns';
import { Calendar } from "@/components/ui/calendar"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

interface SupervisorManagementModalProps {
    isOpen: boolean;
    onClose: () => void;
    employee: EmployeeDocument | null;
    allEmployees: EmployeeDocument[];
    onSave: (employeeId: string, supervisors: SupervisorConfig[]) => Promise<void>;
}

export function SupervisorManagementModal({ isOpen, onClose, employee, allEmployees, onSave }: SupervisorManagementModalProps) {
    const [localSupervisors, setLocalSupervisors] = useState<SupervisorConfig[]>([]);
    const [selectedNewSupervisorId, setSelectedNewSupervisorId] = useState<string>('');
    const [newEffectiveDate, setNewEffectiveDate] = useState<Date | undefined>(new Date());
    const [isSaving, setIsSaving] = useState(false);

    // Initialize state when modal opens
    useEffect(() => {
        if (isOpen && employee) {
            if (employee.supervisors && employee.supervisors.length > 0) {
                setLocalSupervisors([...employee.supervisors]);
            } else {
                // Fallback for legacy data migration
                const initialSupervisors: SupervisorConfig[] = [];
                if (employee.supervisorId) {
                    initialSupervisors.push({
                        supervisorId: employee.supervisorId,
                        isDirectSupervisor: true,
                        isSupervisor: true,
                        isLeaveApprover: employee.leaveApproverId === employee.supervisorId, // If same, mark as leave approver too
                        effectiveDate: format(new Date(), 'yyyy-MM-dd')
                    });
                }
                if (employee.leaveApproverId && employee.leaveApproverId !== employee.supervisorId) {
                    initialSupervisors.push({
                        supervisorId: employee.leaveApproverId,
                        isDirectSupervisor: false,
                        isSupervisor: false, // Maybe just leave approver?
                        isLeaveApprover: true,
                        effectiveDate: format(new Date(), 'yyyy-MM-dd')
                    });
                }
                setLocalSupervisors(initialSupervisors);
            }
            // Reset form
            setSelectedNewSupervisorId('');
            setNewEffectiveDate(new Date());
        }
    }, [isOpen, employee]);

    const handleAddSupervisor = () => {
        if (!selectedNewSupervisorId) {
            Swal.fire('Error', 'Please select a supervisor', 'error');
            return;
        }
        if (!newEffectiveDate) {
            Swal.fire('Error', 'Please select an effective date', 'error');
            return;
        }

        // Check if already exists
        if (localSupervisors.some(s => s.supervisorId === selectedNewSupervisorId)) {
            Swal.fire('Error', 'This supervisor is already in the list', 'error');
            return;
        }

        const newSupervisor: SupervisorConfig = {
            supervisorId: selectedNewSupervisorId,
            effectiveDate: format(newEffectiveDate, 'yyyy-MM-dd'),
            isDirectSupervisor: localSupervisors.length === 0, // Default to true if first
            isSupervisor: true,
            isLeaveApprover: true,
        };

        setLocalSupervisors([...localSupervisors, newSupervisor]);
        setSelectedNewSupervisorId('');
    };

    const handleRemoveSupervisor = (id: string) => {
        setLocalSupervisors(prev => prev.filter(s => s.supervisorId !== id));
    };

    const handleRoleChange = (id: string, field: 'isDirectSupervisor' | 'isSupervisor' | 'isLeaveApprover', value: boolean) => {
        setLocalSupervisors(prev => prev.map(s => {
            if (s.supervisorId !== id) {
                // If setting direct supervisor, uncheck others logic?
                if (field === 'isDirectSupervisor' && value === true) {
                    return { ...s, isDirectSupervisor: false };
                }
                return s;
            }
            return { ...s, [field]: value };
        }));
    };

    const handleSave = async () => {
        if (!employee) return;
        setIsSaving(true);
        try {
            await onSave(employee.id, localSupervisors);
            onClose();
        } catch (error) {
            console.error(error);
            // Error handled in parent usually, or we can show here
        } finally {
            setIsSaving(false);
        }
    };

    const getSupervisorDetails = (id: string) => allEmployees.find(e => e.id === id);

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Set Supervisor and Leave Approver</DialogTitle>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* Add Section */}
                    <div className="bg-muted/30 p-4 rounded-lg flex flex-col md:flex-row gap-4 items-end">
                        <div className="flex-1 space-y-2 w-full">
                            <label className="text-sm font-medium">Select Supervisor</label>
                            <Select value={selectedNewSupervisorId} onValueChange={setSelectedNewSupervisorId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Employee" />
                                </SelectTrigger>
                                <SelectContent>
                                    {(() => {
                                        console.log('All Employees in modal:', allEmployees);
                                        console.log('All Employees length:', allEmployees?.length);
                                        console.log('Current employee ID:', employee?.id);

                                        const filtered = allEmployees
                                            ?.filter(e => e.id !== employee?.id)
                                            ?.filter(e => !localSupervisors.some(s => s.supervisorId === e.id));

                                        console.log('Filtered employees:', filtered);
                                        console.log('Filtered length:', filtered?.length);

                                        if (!filtered || filtered.length === 0) {
                                            return <div className="py-6 text-center text-sm text-muted-foreground">No employees available</div>;
                                        }

                                        return filtered.map(emp => (
                                            <SelectItem key={emp.id} value={emp.id}>
                                                {emp.fullName} ({emp.employeeCode})
                                            </SelectItem>
                                        ));
                                    })()}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex-1 space-y-2 w-full">
                            <label className="text-sm font-medium">Effective Date *</label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant={"outline"}
                                        className={cn(
                                            "w-full justify-start text-left font-normal",
                                            !newEffectiveDate && "text-muted-foreground"
                                        )}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {newEffectiveDate ? format(newEffectiveDate, "PPP") : <span>Pick a date</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                    <Calendar
                                        mode="single"
                                        selected={newEffectiveDate}
                                        onSelect={setNewEffectiveDate}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                        <Button onClick={handleAddSupervisor} className="w-full md:w-auto bg-primary text-primary-foreground hover:bg-primary/90">
                            Add to list
                        </Button>
                    </div>

                    {/* List Section */}
                    <div className="border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Code</TableHead>
                                    <TableHead>Name</TableHead>
                                    <TableHead className="text-center">Direct Supervisor</TableHead>
                                    <TableHead className="text-center">Supervisor</TableHead>
                                    <TableHead className="text-center">Leave Approver</TableHead>
                                    <TableHead>Effective Date</TableHead>
                                    <TableHead className="text-right">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {localSupervisors.length > 0 ? (
                                    localSupervisors.map(sup => {
                                        const details = getSupervisorDetails(sup.supervisorId);
                                        return (
                                            <TableRow key={sup.supervisorId}>
                                                <TableCell>{details?.employeeCode || 'N/A'}</TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <Avatar className="h-6 w-6">
                                                            <AvatarImage src={details?.photoURL} />
                                                            <AvatarFallback>{details?.fullName?.charAt(0)}</AvatarFallback>
                                                        </Avatar>
                                                        <span className="font-medium">{details?.fullName || 'Unknown'}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <div className="flex justify-center">
                                                        <div
                                                            className={cn("h-4 w-4 rounded-full border border-primary cursor-pointer flex items-center justify-center", sup.isDirectSupervisor ? "bg-primary text-white" : "bg-transparent")}
                                                            onClick={() => handleRoleChange(sup.supervisorId, 'isDirectSupervisor', true)}
                                                        >
                                                            {sup.isDirectSupervisor && <div className="h-2 w-2 rounded-full bg-white" />}
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <div className="flex justify-center">
                                                        <Checkbox
                                                            checked={sup.isSupervisor}
                                                            onCheckedChange={(checked) => handleRoleChange(sup.supervisorId, 'isSupervisor', checked === true)}
                                                        />
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <div className="flex justify-center">
                                                        <Checkbox
                                                            checked={sup.isLeaveApprover}
                                                            onCheckedChange={(checked) => handleRoleChange(sup.supervisorId, 'isLeaveApprover', checked === true)}
                                                        />
                                                    </div>
                                                </TableCell>
                                                <TableCell>{sup.effectiveDate}</TableCell>
                                                <TableCell className="text-right">
                                                    <Button variant="ghost" size="icon" onClick={() => handleRemoveSupervisor(sup.supervisorId)}>
                                                        <Trash2 className="h-4 w-4 text-destructive" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">
                                            No supervisors assigned yet.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={isSaving}>Cancel</Button>
                    <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving ? 'Saving...' : 'Save'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

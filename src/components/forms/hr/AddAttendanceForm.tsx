
"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Swal from 'sweetalert2';
import { firestore } from '@/lib/firebase/config';
import { collection, doc, serverTimestamp, setDoc, getDocs, query, orderBy } from 'firebase/firestore';
import type { AttendanceFormValues, EmployeeDocument } from '@/types';
import { AttendanceFormSchema, attendanceFlagOptions } from '@/types';
import { format, differenceInMinutes, parse, isValid } from 'date-fns';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePickerField } from '@/components/forms/common';
import { Loader2, Save, User, Calendar, Clock, MessageSquare, AlertCircle, ToggleLeft, ToggleRight } from 'lucide-react';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { useAuth } from '@/context/AuthContext';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useRouter } from 'next/navigation';
import { Switch } from '@/components/ui/switch';

const PLACEHOLDER_EMPLOYEE_VALUE = "__ADD_ATTENDANCE_EMPLOYEE__";

interface AddAttendanceFormProps {
  onFormSubmit: () => void;
}

export function AddAttendanceForm({ onFormSubmit }: AddAttendanceFormProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [employeeOptions, setEmployeeOptions] = React.useState<ComboboxOption[]>([]);
  const [isLoadingEmployees, setIsLoadingEmployees] = React.useState(true);
  const [workingHours, setWorkingHours] = React.useState<string | null>(null);

  const form = useForm<AttendanceFormValues>({
    resolver: zodResolver(AttendanceFormSchema),
    defaultValues: {
      employeeId: '',
      date: new Date(),
      flag: 'P',
      enableInTime: true,
      enableOutTime: true,
      inTime: '09:00',
      outTime: '18:00',
      inTimeRemarks: '',
      outTimeRemarks: ''
    },
  });

  const { watch, control, handleSubmit, reset } = form;
  const inTime = watch('inTime');
  const outTime = watch('outTime');
  const selectedFlag = watch('flag');
  const enableInTime = watch('enableInTime');
  const enableOutTime = watch('enableOutTime');


  React.useEffect(() => {
    const fetchEmployees = async () => {
      setIsLoadingEmployees(true);
      try {
        const employeesQuery = query(collection(firestore, "employees"), orderBy("fullName"));
        const snapshot = await getDocs(employeesQuery);
        setEmployeeOptions(
          snapshot.docs.map(doc => {
            const data = doc.data() as EmployeeDocument;
            return { 
              value: doc.id, 
              label: `${data.fullName} (${data.employeeCode})` 
            };
          })
        );
      } catch (error) {
        console.error("Error fetching employees:", error);
        Swal.fire("Error", "Could not load employees.", "error");
      } finally {
        setIsLoadingEmployees(false);
      }
    };
    fetchEmployees();
  }, []);

  React.useEffect(() => {
    if (selectedFlag !== 'P' && selectedFlag !== 'D') {
      setWorkingHours(null);
      return;
    }

    if (!enableInTime || !enableOutTime || !inTime || !outTime) {
      setWorkingHours(null);
      return;
    }

    try {
      const inDate = parse(inTime, 'HH:mm', new Date());
      const outDate = parse(outTime, 'HH:mm', new Date());
      if(isValid(inDate) && isValid(outDate) && outDate >= inDate) {
        const diffMins = differenceInMinutes(outDate, inDate);
        const hours = Math.floor(diffMins / 60);
        const minutes = diffMins % 60;
        setWorkingHours(`${hours}h ${minutes.toString().padStart(2, '0')}m`);
      } else {
        setWorkingHours("Invalid");
      }
    } catch {
      setWorkingHours("Error");
    }
  }, [inTime, outTime, selectedFlag, enableInTime, enableOutTime]);

  async function onSubmit(data: AttendanceFormValues) {
    if (!user) {
      Swal.fire("Authentication Error", "You must be logged in.", "error");
      return;
    }
    
    if (!data.employeeId || data.employeeId === PLACEHOLDER_EMPLOYEE_VALUE) {
      Swal.fire("Validation Error", "Please select an employee.", "error");
      return;
    }

    setIsSubmitting(true);
    const formattedDate = format(data.date, 'yyyy-MM-dd');
    const docId = `${data.employeeId}_${formattedDate}`;

    const selectedEmployee = employeeOptions.find(emp => emp.value === data.employeeId);

    const dataToSave: Record<string, any> = {
      ...data,
      employeeName: selectedEmployee?.label || 'N/A', // Add employeeName
      date: format(data.date, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"),
      workingHours: (data.flag === 'P' || data.flag === 'D') && data.enableInTime && data.enableOutTime ? workingHours : null,
      updatedBy: user.uid,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    };
    
    if (data.flag !== 'P' && data.flag !== 'D' || !data.enableInTime) {
      delete dataToSave.inTime;
      delete dataToSave.inTimeRemarks;
    }
    if (data.flag !== 'P' && data.flag !== 'D' || !data.enableOutTime) {
        delete dataToSave.outTime;
        delete dataToSave.outTimeRemarks;
    }
     if (data.flag !== 'P' && data.flag !== 'D' || !data.enableInTime || !data.enableOutTime) {
        delete dataToSave.workingHours;
    }

    try {
      await setDoc(doc(firestore, "attendance", docId), dataToSave, { merge: true });
      Swal.fire({
        title: "Attendance Saved!",
        text: `Attendance record saved successfully.`,
        icon: "success",
        timer: 1000,
        showConfirmButton: false,
      });
      reset();
      onFormSubmit();
    } catch (error: any) {
        console.error("Error saving attendance:", error);
        Swal.fire("Save Failed", `Failed to save attendance record: ${error.message}`, "error");
      } finally {
        setIsSubmitting(false);
      }
    }
  
    return (
      <Form {...form}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
              <FormField
                control={control}
                name="employeeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center">
                      <User className="mr-2 h-4 w-4 text-muted-foreground" />
                      Employee*
                    </FormLabel>
                    <Combobox
                      options={employeeOptions}
                      value={field.value || PLACEHOLDER_EMPLOYEE_VALUE}
                      onValueChange={(value) => field.onChange(value === PLACEHOLDER_EMPLOYEE_VALUE ? '' : value)}
                      placeholder="Search Employee..."
                      selectPlaceholder={isLoadingEmployees ? "Loading..." : "Select Employee"}
                      disabled={isLoadingEmployees}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name="date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel className="flex items-center">
                      <Calendar className="mr-2 h-4 w-4 text-muted-foreground" />
                      Attendance Date*
                    </FormLabel>
                    <DatePickerField field={field} />
                    <FormMessage />
                  </FormItem>
                )}
              />
          </div>
          
          <FormField
              control={control}
              name="flag"
              render={({ field }) => (
              <FormItem>
                  <FormLabel>Attendance Flag*</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                          <SelectTrigger>
                              <SelectValue placeholder="Select Flag"/>
                          </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                          {attendanceFlagOptions.map(opt => (
                              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                          ))}
                      </SelectContent>
                  </Select>
                  <FormMessage />
              </FormItem>
              )}
          />
          
          {(selectedFlag === 'P' || selectedFlag === 'D') && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                    <FormField
                        control={form.control}
                        name="enableInTime"
                        render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                                <div className="space-y-0.5">
                                    <FormLabel className="text-base flex items-center gap-2"><ToggleRight /> Enable In Time</FormLabel>
                                </div>
                                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="enableOutTime"
                        render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                                <div className="space-y-0.5">
                                    <FormLabel className="text-base flex items-center gap-2"><ToggleLeft /> Enable Out Time</FormLabel>
                                </div>
                                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                            </FormItem>
                        )}
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                    {enableInTime && (
                         <div>
                            <FormField control={control} name="inTime" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="flex items-center"><Clock className="mr-2 h-4 w-4 text-muted-foreground"/>In Time</FormLabel>
                                    <FormControl><Input type="time" {...field} value={field.value ?? ''} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}/>
                            <FormField control={control} name="inTimeRemarks" render={({ field }) => (
                                <FormItem className="mt-4">
                                    <FormLabel className="flex items-center"><MessageSquare className="mr-2 h-4 w-4 text-muted-foreground"/>In Time Remarks</FormLabel>
                                    <FormControl><Input placeholder="Optional remarks..." {...field} value={field.value ?? ''} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}/>
                        </div>
                    )}
                     {enableOutTime && (
                         <div>
                            <FormField control={control} name="outTime" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="flex items-center"><Clock className="mr-2 h-4 w-4 text-muted-foreground"/>Out Time</FormLabel>
                                    <FormControl><Input type="time" {...field} value={field.value ?? ''} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}/>
                            <FormField control={control} name="outTimeRemarks" render={({ field }) => (
                                <FormItem className="mt-4">
                                    <FormLabel className="flex items-center"><MessageSquare className="mr-2 h-4 w-4 text-muted-foreground"/>Out Time Remarks</FormLabel>
                                    <FormControl><Input placeholder="Optional remarks..." {...field} value={field.value ?? ''} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}/>
                        </div>
                    )}
                </div>
  
                  {workingHours && (
                      <Alert>
                          <AlertCircle className="h-4 w-4" />
                          <AlertTitle>Calculated Working Hours</AlertTitle>
                          <AlertDescription>
                              Total working hours: {workingHours}
                          </AlertDescription>
                      </Alert>
                  )}
              </div>
          )}
  
          <div className="flex justify-end gap-4 pt-4">
              <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => router.push('/dashboard/hr/attendance')}
              >
                  Cancel
              </Button>
              <Button 
                  type="submit" 
                  disabled={isSubmitting || isLoadingEmployees}
              >
                  {isSubmitting ? (
                      <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving Attendance...
                      </>
                  ) : (
                      <>
                          <Save className="mr-2 h-4 w-4" />
                          Save Attendance
                      </>
                  )}
              </Button>
          </div>
        </form>
      </Form>
    );
  }

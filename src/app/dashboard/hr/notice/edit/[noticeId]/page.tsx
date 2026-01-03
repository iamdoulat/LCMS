
"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Swal from 'sweetalert2';
import { firestore } from '@/lib/firebase/config';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import type { NoticeBoardSettings } from '@/types';
import { NoticeBoardSettingsSchema, userRoles } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormDescription, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, BellRing, Save, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { RichTextEditor } from '@/components/ui/RichTextEditor';
import { DatePickerField } from '@/components/forms/common/DatePickerField';

export default function EditNoticePage() {
  const { userRole, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const noticeId = params.noticeId as string;

  const [isLoadingData, setIsLoadingData] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<NoticeBoardSettings>({
    resolver: zodResolver(NoticeBoardSettingsSchema),
    defaultValues: {
      title: '',
      content: '',
      isEnabled: false,
      isPopupEnabled: true,

      targetRoles: [],
      displayStartDate: undefined,
      displayEndDate: undefined,
    },
  });

  React.useEffect(() => {
    if (!authLoading && !userRole?.some(r => ["Super Admin", "Admin", "HR"].includes(r))) {
      Swal.fire({
        title: 'Access Denied',
        text: 'You do not have permission to manage notices.',
        icon: 'error',
        timer: 2000,
        showConfirmButton: false,
      }).then(() => router.push('/dashboard'));
    }
  }, [userRole, authLoading, router]);

  React.useEffect(() => {
    if (!noticeId) {
      Swal.fire("Error", "No notice ID provided.", "error").then(() => router.push('/dashboard/hr/notice'));
      return;
    }

    const fetchNotice = async () => {
      setIsLoadingData(true);
      try {
        const noticeDocRef = doc(firestore, 'site_settings', noticeId);
        const docSnap = await getDoc(noticeDocRef);
        if (docSnap.exists()) {
          const data = docSnap.data() as NoticeBoardSettings;
          form.reset({
            title: data.title || '',
            content: data.content || '',
            isEnabled: data.isEnabled || false,
            isPopupEnabled: data.isPopupEnabled ?? true,
            targetRoles: Array.isArray(data.targetRoles) ? data.targetRoles : [],
            displayStartDate: data.displayStartDate ? (data.displayStartDate as any).toDate() : undefined,
            displayEndDate: data.displayEndDate ? (data.displayEndDate as any).toDate() : undefined,
          });
        } else {
          Swal.fire("Error", "Notice not found.", "error");
          router.push('/dashboard/hr/notice');
        }
      } catch (error) {
        console.error("Error fetching notice settings:", error);
        Swal.fire("Error", "Could not load notice settings.", "error");
      } finally {
        setIsLoadingData(false);
      }
    };
    if (userRole?.some(r => ["Super Admin", "Admin", "HR"].includes(r))) {
      fetchNotice();
    }
  }, [noticeId, form, userRole, router]);

  async function onSubmit(data: NoticeBoardSettings) {
    setIsSubmitting(true);
    try {
      const noticeDocRef = doc(firestore, 'site_settings', noticeId);
      await updateDoc(noticeDocRef, { ...data, updatedAt: serverTimestamp() });
      Swal.fire("Success", "Notice settings have been updated.", "success");
      router.push('/dashboard/hr/notice');
    } catch (error) {
      console.error("Error saving notice settings:", error);
      Swal.fire("Error", "Failed to save settings.", "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (authLoading || isLoadingData) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] w-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="mb-6">
        <Link href="/dashboard/hr/notice" passHref>
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Manage Notices
          </Button>
        </Link>
      </div>
      <Card className="max-w-4xl mx-auto shadow-xl">
        <CardHeader>
          <CardTitle className={cn("flex items-center gap-2", "font-bold text-2xl lg:text-3xl bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
            <BellRing className="h-7 w-7 text-primary" />
            Edit Notice
          </CardTitle>
          <CardDescription>
            Modify the notice that will appear as a pop-up on user dashboards.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-lg">Notice Title*</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter the notice title" {...field} />
                    </FormControl>
                    <FormDescription>This will be the title of the pop-up dialog.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="displayStartDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Display Start Date</FormLabel>
                      <DatePickerField field={field} placeholder="Select Start Date" />
                      <FormDescription>Date when the notice starts showing.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="displayEndDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Display End Date</FormLabel>
                      <DatePickerField field={field} placeholder="Select End Date" />
                      <FormDescription>Date when the notice stops showing.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="content"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-lg">Notice Content*</FormLabel>
                    <FormControl>
                      <RichTextEditor
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Enter the notice content here..."
                      />
                    </FormControl>
                    <FormDescription>This content will be displayed in the pop-up.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Separator />
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="isEnabled"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Enable Notice Board</FormLabel>
                        <FormDescription>Master switch to show or hide the notice entirely.</FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="isPopupEnabled"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Show as Pop-up</FormLabel>
                        <FormDescription>If enabled, the notice will appear as a pop-up dialog.</FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <Separator />
              <FormField
                control={form.control}
                name="targetRoles"
                render={() => (
                  <FormItem>
                    <div className="mb-4">
                      <FormLabel className="text-lg">Target Audience*</FormLabel>
                      <FormDescription>Select which user roles will see this notice.</FormDescription>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {userRoles.map((role) => (
                        <FormField
                          key={role}
                          control={form.control}
                          name="targetRoles"
                          render={({ field }) => {
                            return (
                              <FormItem key={role} className="flex flex-row items-center space-x-3 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes(role)}
                                    onCheckedChange={(checked) => {
                                      const currentValue = field.value || [];
                                      return checked
                                        ? field.onChange([...currentValue, role])
                                        : field.onChange(currentValue.filter((value) => value !== role));
                                    }}
                                  />
                                </FormControl>
                                <FormLabel className="font-normal">{role}</FormLabel>
                              </FormItem>
                            );
                          }}
                        />
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full md:w-auto" disabled={isSubmitting}>
                {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving Changes...</> : <><Save className="mr-2 h-4 w-4" />Save Changes</>}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}


"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Swal from 'sweetalert2';
import { firestore } from '@/lib/firebase/config';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import type { NoticeBoardSettings, UserRole } from '@/types';
import { NoticeBoardSettingsSchema, userRoles } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormDescription, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, BellRing, Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';

const NOTICE_COLLECTION = 'site_settings';
const NOTICE_DOC_ID = 'notice_board';

export default function NoticeSettingsPage() {
  const { userRole, loading: authLoading } = useAuth();
  const router = useRouter();
  const [isLoadingData, setIsLoadingData] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<NoticeBoardSettings>({
    resolver: zodResolver(NoticeBoardSettingsSchema),
    defaultValues: {
      title: '',
      content: '',
      isEnabled: false,
      targetRoles: [],
    },
  });

  React.useEffect(() => {
    if (!authLoading && !userRole?.includes("Super Admin") && !userRole?.includes("Admin")) {
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
    const fetchNotice = async () => {
      setIsLoadingData(true);
      try {
        const noticeDocRef = doc(firestore, NOTICE_COLLECTION, NOTICE_DOC_ID);
        const docSnap = await getDoc(noticeDocRef);
        if (docSnap.exists()) {
          const data = docSnap.data() as NoticeBoardSettings;
          form.reset({
            title: data.title || '',
            content: data.content || '',
            isEnabled: data.isEnabled || false,
            targetRoles: Array.isArray(data.targetRoles) ? data.targetRoles : [],
          });
        }
      } catch (error) {
        console.error("Error fetching notice settings:", error);
        Swal.fire("Error", "Could not load notice settings.", "error");
      } finally {
        setIsLoadingData(false);
      }
    };
    if (userRole?.includes("Super Admin") || userRole?.includes("Admin")) {
        fetchNotice();
    }
  }, [form, userRole]);

  async function onSubmit(data: NoticeBoardSettings) {
    setIsSubmitting(true);
    try {
      const noticeDocRef = doc(firestore, NOTICE_COLLECTION, NOTICE_DOC_ID);
      await setDoc(noticeDocRef, { ...data, updatedAt: serverTimestamp() }, { merge: true });
      Swal.fire("Success", "Notice Board settings have been updated.", "success");
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
      <Card className="max-w-4xl mx-auto shadow-xl">
        <CardHeader>
          <CardTitle className={cn("flex items-center gap-2", "font-bold text-2xl lg:text-3xl bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
            <BellRing className="h-7 w-7 text-primary" />
            Notice Board Settings
          </CardTitle>
          <CardDescription>
            Create and manage a sitewide notice that will appear as a pop-up on user dashboards.
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
              <FormField
                control={form.control}
                name="content"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-lg">Notice Content*</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Enter the notice content here... You can use markdown for formatting." {...field} rows={8} />
                    </FormControl>
                    <FormDescription>This content will be displayed in the pop-up. Markdown is supported.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Separator />
              <FormField
                control={form.control}
                name="isEnabled"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Enable Notice Board</FormLabel>
                      <FormDescription>Toggle to show or hide the notice pop-up for all selected users.</FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
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
                {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : <><Save className="mr-2 h-4 w-4" />Save Notice Settings</>}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

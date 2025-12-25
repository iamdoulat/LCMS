
"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Swal from 'sweetalert2';
import { firestore } from '@/lib/firebase/config';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import type { NoticeBoardSettings, UserRole } from '@/types';
import { NoticeBoardSettingsSchema, userRoles } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormDescription, FormMessage } from '@/components/ui/form';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Save } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { RichTextEditor } from '@/components/ui/RichTextEditor';

export function AddNoticeForm() {
  const { userRole, loading: authLoading } = useAuth();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<NoticeBoardSettings>({
    resolver: zodResolver(NoticeBoardSettingsSchema),
    defaultValues: {
      title: '',
      content: '',
      isEnabled: true,
      isPopupEnabled: true,
      targetRoles: [],
    },
  });

  async function onSubmit(data: NoticeBoardSettings) {
    setIsSubmitting(true);
    try {
      await addDoc(collection(firestore, 'site_settings'), {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      Swal.fire("Success", "New notice has been created successfully.", "success");
      form.reset(); 
      router.push('/dashboard/hr/notice');
    } catch (error) {
      console.error("Error creating notice:", error);
      Swal.fire("Error", "Failed to create notice.", "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
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
          {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating Notice...</> : <><Save className="mr-2 h-4 w-4" />Create Notice</>}
        </Button>
      </form>
    </Form>
  );
}

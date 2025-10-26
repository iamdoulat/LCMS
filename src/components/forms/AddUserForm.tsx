
"use client";

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, UserPlus, Save } from 'lucide-react';
import Swal from 'sweetalert2';
import type { UserRole } from '@/types';
import { userRoles } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Checkbox } from '@/components/ui/checkbox';

const addUserSchema = z.object({
  displayName: z.string().min(3, "Display name must be at least 3 characters long."),
  email: z.string().email("Invalid email address.").min(1, "Email is required."),
  password: z.string().min(6, "Password must be at least 6 characters long."),
  role: z.array(z.string()).refine((value) => value.some((item) => item), {
    message: "You have to select at least one role.",
  }),
});

type AddUserFormValues = z.infer<typeof addUserSchema>;

export function AddUserForm() {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const { register } = useAuth(); // Using the centralized register function

  const form = useForm<AddUserFormValues>({
    resolver: zodResolver(addUserSchema),
    defaultValues: {
      displayName: '',
      email: '',
      password: '',
      role: ['User'], // Default to 'User' role
    },
  });

  async function onSubmit(data: AddUserFormValues) {
    setIsSubmitting(true);
    try {
      // Call the register function from AuthContext, passing the roles
      await register(data.email, data.password, data.displayName, data.role as UserRole[]);
      Swal.fire({
        title: "User Created!",
        text: `Account for ${data.displayName} created successfully.`,
        icon: "success",
        timer: 2500,
        showConfirmButton: true,
      });
      form.reset();
    } catch (error: any) {
      console.error("Error adding user:", error);
      Swal.fire({
        title: "Creation Failed",
        text: `Failed to create user: ${error.message}`,
        icon: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="displayName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Display Name*</FormLabel>
              <FormControl>
                <Input placeholder="Enter user's full name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email Address*</FormLabel>
              <FormControl>
                <Input type="email" placeholder="user@example.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password*</FormLabel>
              <FormControl>
                <Input type="password" placeholder="••••••••" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="role"
          render={() => (
            <FormItem>
              <div className="mb-4">
                <FormLabel className="text-base">User Roles</FormLabel>
                <FormDescription>Select the roles to assign to this user.</FormDescription>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                {userRoles.map((role) => (
                  <FormField
                    key={role}
                    control={form.control}
                    name="role"
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
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating User...
            </>
          ) : (
            <>
              <UserPlus className="mr-2 h-4 w-4" />
              Create User
            </>
          )}
        </Button>
      </form>
    </Form>
  );
}

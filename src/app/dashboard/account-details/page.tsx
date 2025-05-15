
"use client";

import { zodResolver } from '@hookform/resolvers/zod';
import { updateProfile } from 'firebase/auth';
import { Loader2, UserCircle, Save, ShieldAlert, UploadCloud } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import Swal from 'sweetalert2';
import Image from 'next/image';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { auth, storage } from '@/lib/firebase/config'; // Import storage
import { useAuth } from '@/context/AuthContext';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { FileInput } from '@/components/forms/FileInput'; // Assuming you have this component

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

const accountDetailsSchema = z.object({
  displayName: z.string().min(1, "Display name cannot be empty.").max(50, "Display name is too long."),
  email: z.string().email("Invalid email address."), // Will be read-only
  photoFile: z.instanceof(File).optional().nullable()
    .refine(file => !file || file.size <= MAX_FILE_SIZE, `Max file size is 5MB.`)
    .refine(
      file => !file || ACCEPTED_IMAGE_TYPES.includes(file.type),
      "Only .jpg, .jpeg, .png, and .webp files are accepted."
    ),
});

type AccountDetailsFormValues = z.infer<typeof accountDetailsSchema>;

export default function AccountDetailsPage() {
  const { user, loading: authLoading, setUser: setAuthUser } = useAuth(); // Assuming useAuth exposes setUser
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);

  const form = useForm<AccountDetailsFormValues>({
    resolver: zodResolver(accountDetailsSchema),
    defaultValues: {
      displayName: '',
      email: '',
      photoFile: null,
    },
  });

  useEffect(() => {
    if (user) {
      form.reset({
        displayName: user.displayName || '',
        email: user.email || '',
        photoFile: null,
      });
      if (user.photoURL) {
        setImagePreviewUrl(user.photoURL);
      }
    }
  }, [user, form]);

  const handleFileChange = (file: File | null) => {
    if (file) {
      const previewUrl = URL.createObjectURL(file);
      setImagePreviewUrl(previewUrl);
      form.setValue('photoFile', file, { shouldValidate: true });
    } else {
      setImagePreviewUrl(user?.photoURL || null); // Revert to original if file cleared
      form.setValue('photoFile', null);
    }
  };
  
  const getInitials = (nameOrEmail: string) => {
    if (!nameOrEmail) return 'U';
    const namePart = nameOrEmail.includes('@') ? nameOrEmail.split('@')[0] : nameOrEmail;
    return namePart
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };


  const onSubmit = async (data: AccountDetailsFormValues) => {
    if (!auth.currentUser) {
      const msg = "No user logged in. Please re-authenticate.";
      setError(msg);
      Swal.fire({ title: "Error", text: msg, icon: "error" });
      return;
    }

    setIsSubmitting(true);
    setError(null);
    let newPhotoURL = user?.photoURL || null; // Keep current photoURL by default

    try {
      // Handle file upload if a new file is selected
      if (data.photoFile) {
        setIsUploading(true);
        const file = data.photoFile;
        const filePath = `profileImages/${auth.currentUser.uid}/${file.name}`;
        const imageRef = storageRef(storage, filePath);

        await uploadBytes(imageRef, file);
        newPhotoURL = await getDownloadURL(imageRef);
        setIsUploading(false);
      }

      // Update profile (displayName and potentially photoURL)
      await updateProfile(auth.currentUser, {
        displayName: data.displayName,
        ...(newPhotoURL && { photoURL: newPhotoURL }), // Only include photoURL if it's changed or set
      });

      // Update user in AuthContext if setUser is available
      if (setAuthUser && auth.currentUser) {
         const updatedUser = {
            ...auth.currentUser,
            displayName: data.displayName,
            photoURL: newPhotoURL || auth.currentUser.photoURL,
         };
         // This cast might be necessary if your AuthContext User type is slightly different
         // from firebase.User. Ensure types are compatible.
         setAuthUser(updatedUser as any);
      }


      Swal.fire({
        title: "Profile Updated",
        text: "Your account details have been successfully updated.",
        icon: "success",
        timer: 2000,
        showConfirmButton: false,
      });
      form.reset({ ...data, photoFile: null }); // Reset form, clear file input
      if(newPhotoURL) setImagePreviewUrl(newPhotoURL); // Ensure preview shows the new Firebase URL

    } catch (err: any) {
      const errorMessage = err.message || "Failed to update profile. Please try again.";
      setError(errorMessage);
      Swal.fire({
        title: "Update Failed",
        text: errorMessage,
        icon: "error",
      });
    } finally {
      setIsSubmitting(false);
      setIsUploading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
     return (
      <div className="container mx-auto py-8">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl font-bold text-primary">
              <UserCircle className="h-7 w-7" />
              Account Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Please log in to view your account details.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <Card className="max-w-2xl mx-auto shadow-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl font-bold text-primary">
            <UserCircle className="h-7 w-7" />
            Account Details
          </CardTitle>
          <CardDescription>
            View and manage your personal account information and profile picture.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-6">
              <ShieldAlert className="h-4 w-4" />
              <AlertTitle>Update Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="flex flex-col items-center space-y-4 mb-6">
                <Avatar className="h-32 w-32 border-2 border-primary shadow-md">
                  <AvatarImage src={imagePreviewUrl || undefined} alt={user.displayName || "User Avatar"} data-ai-hint="user avatar" />
                  <AvatarFallback className="text-4xl">
                    {getInitials(user.displayName || user.email || "U")}
                  </AvatarFallback>
                </Avatar>
                 <FormField
                  control={form.control}
                  name="photoFile"
                  render={({ field }) => ( // `field` here is just for RHF, actual file handling is manual
                    <FormItem className="w-full max-w-sm">
                      <FormLabel>Change Profile Picture</FormLabel>
                      <FormControl>
                        <FileInput
                          onFileChange={(file) => handleFileChange(file)}
                          accept={ACCEPTED_IMAGE_TYPES.join(',')}
                        />
                      </FormControl>
                      <FormDescription>
                        Upload a new profile picture. Max 5MB. (JPG, PNG, WEBP)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="displayName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Display Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Your display name" {...field} />
                    </FormControl>
                    <FormDescription>
                      This name will be displayed to others.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address</FormLabel>
                    <FormControl>
                      <Input placeholder="your.email@example.com" {...field} readOnly disabled className="cursor-not-allowed bg-muted/50" />
                    </FormControl>
                     <FormDescription>
                      Your email address cannot be changed here.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <Button type="submit" className="w-full md:w-auto bg-primary hover:bg-primary/90" disabled={isSubmitting || isUploading}>
                {isSubmitting || isUploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {isUploading ? "Uploading Image..." : "Saving..."}
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Changes
                  </>
                )}
              </Button>
            </form>
          </Form>
          <Separator className="my-8" />
            <div className="space-y-2">
                <h3 className="text-lg font-semibold text-foreground">User ID</h3>
                <p className="text-sm text-muted-foreground break-all">{user.uid}</p>
                <h3 className="text-lg font-semibold text-foreground mt-4">Provider Data</h3>
                {user.providerData.map((provider, index) => (
                    <div key={index} className="text-sm text-muted-foreground">
                        <p>Provider ID: {provider.providerId}</p>
                        {provider.displayName && <p>Provider Display Name: {provider.displayName}</p>}
                        {provider.email && <p>Provider Email: {provider.email}</p>}
                    </div>
                ))}
            </div>
        </CardContent>
      </Card>
    </div>
  );
}

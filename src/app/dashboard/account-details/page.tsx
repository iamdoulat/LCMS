
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
import { FileInput } from '@/components/forms/FileInput';

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
  const { user, loading: authLoading, setUser: setAuthUser } = useAuth();
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
    let newPhotoURL = user?.photoURL || null; 
    const originalDisplayName = user?.displayName;

    try {
      if (data.photoFile) {
        setIsUploading(true);
        const file = data.photoFile;

        if (!storage.app.options.storageBucket) {
          const configErrorMsg = "Firebase Storage Bucket is not configured. Please check your project's .env.local file for NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET and restart the server.";
          setError(configErrorMsg);
          Swal.fire("Configuration Error", configErrorMsg, "error");
          setIsSubmitting(false);
          setIsUploading(false);
          return;
        }
        
        const filePath = `profileImages/${auth.currentUser.uid}/${file.name}`;
        const imageRef = storageRef(storage, filePath);

        await uploadBytes(imageRef, file);
        newPhotoURL = await getDownloadURL(imageRef);
        setIsUploading(false);
      }

      await updateProfile(auth.currentUser, {
        displayName: data.displayName,
        ...(newPhotoURL && { photoURL: newPhotoURL }), 
      });

      if (setAuthUser && auth.currentUser) {
         const updatedUser = {
            ...auth.currentUser,
            displayName: data.displayName,
            photoURL: newPhotoURL || auth.currentUser.photoURL,
         };
         setAuthUser(updatedUser as any);
      }

      const photoWasUpdated = data.photoFile && newPhotoURL && newPhotoURL !== user?.photoURL;
      const nameWasUpdated = data.displayName !== originalDisplayName;
      let successMessage = "No changes were made to your profile.";

      if (photoWasUpdated && nameWasUpdated) {
        successMessage = "Profile picture and display name updated successfully.";
      } else if (photoWasUpdated) {
        successMessage = "Profile picture updated successfully.";
      } else if (nameWasUpdated) {
        successMessage = "Display name updated successfully.";
      } else if (data.photoFile && newPhotoURL === user?.photoURL) {
        // This case means a new photo was selected, uploaded, but it resulted in the same URL (e.g. re-uploading same image)
        // or if the name wasn't changed.
        successMessage = "Profile picture re-saved. Display name was not changed.";
         if(nameWasUpdated) successMessage = "Profile picture re-saved and display name updated.";
      }


      Swal.fire({
        title: "Profile Updated",
        text: successMessage,
        icon: "success",
        timer: 2000,
        showConfirmButton: false,
      });
      form.reset({ ...data, photoFile: null }); 
      if(newPhotoURL) setImagePreviewUrl(newPhotoURL); 

    } catch (err: any) {
      console.error("Profile update or file upload error details:", err); // Log the full error object
      let errorMessage = "Failed to update profile. Please try again.";
      if (err.code) { // Check if it's a Firebase error with a code
        switch (err.code) {
          case 'storage/unauthorized':
            errorMessage = "Permission denied. Please check Firebase Storage security rules to allow uploads to your profileImages folder.";
            break;
          case 'storage/canceled':
            errorMessage = "Upload was cancelled by the user.";
            break;
          case 'storage/object-not-found':
             errorMessage = "File not found. This can happen if the storage path is incorrect or the object doesn't exist.";
            break;
          case 'storage/bucket-not-found':
            errorMessage = "Firebase Storage bucket not found. Please ensure NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET in .env.local is correct and the bucket exists.";
            break;
          case 'storage/project-not-found':
            errorMessage = "Firebase project not found. Please check your Firebase configuration.";
            break;
          case 'storage/quota-exceeded':
            errorMessage = "Storage quota exceeded. Please check your Firebase Storage plan.";
            break;
          case 'storage/unauthenticated':
            errorMessage = "User is not authenticated. Please log in again.";
            break;
          case 'storage/retry-limit-exceeded':
            errorMessage = "Upload timed out. Please check your internet connection and try again.";
            break;
          case 'storage/invalid-checksum':
            errorMessage = "File integrity check failed during upload. Please try again.";
            break;
          case 'auth/requires-recent-login':
             errorMessage = "This operation is sensitive and requires recent authentication. Please log out and log back in before updating your profile.";
             break;
          default:
            errorMessage = `An error occurred: ${err.message} (Code: ${err.code})`;
        }
      } else if (err.message) {
        errorMessage = err.message;
      }
      
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
            The profile picture preview is displayed at approximately 150x150px and in the header at 32x32px using CSS styling.
            Actual client-side image cropping before upload is not implemented; the original selected image is uploaded.
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
                  render={({ field }) => ( 
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

    
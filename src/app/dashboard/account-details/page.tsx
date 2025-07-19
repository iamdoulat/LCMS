
"use client";

import { zodResolver } from '@hookform/resolvers/zod';
import { updateProfile, sendPasswordResetEmail } from 'firebase/auth';
import { Loader2, UserCircle, Save, ShieldAlert, Image as ImageIcon, Link2 } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import Swal from 'sweetalert2';
import Image from 'next/image';
import { doc, updateDoc, serverTimestamp, getDoc } from 'firebase/firestore';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { auth, firestore } from '@/lib/firebase/config';
import { useAuth } from '@/context/AuthContext';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

const accountDetailsSchema = z.object({
  displayName: z.string().min(1, "Display name cannot be empty.").max(50, "Display name is too long."),
  email: z.string().email("Invalid email address."), // Will be read-only
  photoURLInput: z.preprocess(
    (val) => (String(val).trim() === "" ? undefined : String(val).trim()),
    z.string().url({ message: "Invalid URL format for profile picture." }).optional()
  ),
});

type AccountDetailsFormValues = z.infer<typeof accountDetailsSchema>;

export default function AccountDetailsPage() {
  const { user, loading: authLoading, setUser: setAuthUser, userRole } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const isReadOnly = userRole?.includes('Viewer');

  const form = useForm<AccountDetailsFormValues>({
    resolver: zodResolver(accountDetailsSchema),
    defaultValues: {
      displayName: '',
      email: '',
      photoURLInput: '',
    },
  });

  const watchedPhotoURLInput = form.watch('photoURLInput');

  useEffect(() => {
    if (user) {
      form.reset({
        displayName: user.displayName || '',
        email: user.email || '',
        photoURLInput: user.photoURL || '',
      });
      setImagePreviewUrl(user.photoURL || null);
    }
  }, [user, form]);

  useEffect(() => {
    if (watchedPhotoURLInput !== undefined) {
        // Basic check for URL validity before attempting to set as preview
        if (watchedPhotoURLInput && (watchedPhotoURLInput.startsWith('http://') || watchedPhotoURLInput.startsWith('https://'))) {
            setImagePreviewUrl(watchedPhotoURLInput);
        } else if (!watchedPhotoURLInput && user?.photoURL) {
            setImagePreviewUrl(user.photoURL); // Revert to original if URL cleared
        } else if (!watchedPhotoURLInput) {
            setImagePreviewUrl(null); // Clear preview if URL is empty
        }
        // If it's an invalid URL, we don't update the preview to avoid broken image
    }
  }, [watchedPhotoURLInput, user?.photoURL]);


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

    const originalDisplayName = auth.currentUser.displayName;
    const originalPhotoURL = auth.currentUser.photoURL;

    const newDisplayName = data.displayName;
    let newPhotoURL = data.photoURLInput?.trim() || null;
    if (newPhotoURL === "") newPhotoURL = null; // Treat empty string as clearing the photo

    const nameChanged = newDisplayName !== originalDisplayName;
    const photoChanged = newPhotoURL !== originalPhotoURL;

    if (!nameChanged && !photoChanged) {
      Swal.fire({
        title: "No Changes",
        text: "No changes were made to your profile.",
        icon: "info",
        timer: 2000,
        showConfirmButton: false,
      });
      setIsSubmitting(false);
      return;
    }

    try {
      // Update Firebase Auth profile
      await updateProfile(auth.currentUser, {
        displayName: newDisplayName,
        photoURL: newPhotoURL,
      });

      // Update Firestore user profile document
      if (auth.currentUser.uid) {
        const userDocRef = doc(firestore, "users", auth.currentUser.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          await updateDoc(userDocRef, {
            displayName: newDisplayName,
            photoURL: newPhotoURL, // Store null if cleared, or the URL
            updatedAt: serverTimestamp(),
          });
        } else {
          console.warn("User document not found in Firestore for UID:", auth.currentUser.uid, "Cannot update Firestore profile.");
          // Optionally, create the Firestore profile here if it's missing
        }
      }

      // Update AuthContext
      if (setAuthUser && auth.currentUser) {
         const updatedUser = {
            ...auth.currentUser, // This will have the latest from Firebase Auth
         };
         setAuthUser(updatedUser as any); // Auth context gets updated user
      }
      
      setImagePreviewUrl(newPhotoURL); // Update preview to reflect saved state
      form.setValue('photoURLInput', newPhotoURL || ''); // Sync form field

      let successMessage = "Profile updated successfully.";
      if (nameChanged && photoChanged) {
        successMessage = "Display name and profile picture updated successfully.";
      } else if (nameChanged) {
        successMessage = "Display name updated successfully.";
      } else if (photoChanged) {
        successMessage = "Profile picture updated successfully.";
      }

      Swal.fire({
        title: "Profile Updated",
        text: successMessage,
        icon: "success",
        timer: 2000,
        showConfirmButton: false,
      });

    } catch (err: any) {
      console.error("Profile update error details:", err);
      let errorMessage = "Failed to update profile. Please try again.";
      if (err.code) {
        switch (err.code) {
          case 'auth/requires-recent-login':
             errorMessage = "This operation is sensitive and requires recent authentication. Please log out and log back in before updating your profile.";
             break;
          default:
            errorMessage = `An error occurred: ${err.message || 'Unknown error'} (Code: ${err.code})`;
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
    }
  };

  const handlePasswordReset = async () => {
    if (!user || !user.email) {
      Swal.fire("Error", "No user email found to send reset link.", "error");
      return;
    }

    // Check if the user signed in with a password provider
    const isPasswordProvider = user.providerData.some(
      (provider) => provider.providerId === 'password'
    );

    if (!isPasswordProvider) {
      Swal.fire({
        title: "Password Reset Not Applicable",
        text: `You signed in with ${user.providerData[0]?.providerId || 'an external provider'}. Please reset your password through that provider.`,
        icon: "info",
      });
      return;
    }

    Swal.fire({
      title: 'Reset Password?',
      text: `A password reset link will be sent to ${user.email}.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Send Reset Link',
      cancelButtonText: 'Cancel',
    }).then(async (result) => {
      if (result.isConfirmed) {
        setIsSubmitting(true); // Use isSubmitting to disable buttons
        try {
          await sendPasswordResetEmail(auth, user.email!);
          Swal.fire(
            'Reset Email Sent!',
            'A password reset link has been sent to your email address. Please check your inbox.',
            'success'
          );
        } catch (error: any) {
          console.error("Error sending password reset email:", error);
          Swal.fire(
            'Error',
            `Failed to send password reset email: ${error.message}`,
            'error'
          );
        } finally {
          setIsSubmitting(false);
        }
      }
    });
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
            <CardTitle className={cn("flex items-center gap-2", "font-bold text-2xl lg:text-3xl bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
              <UserCircle className="h-7 w-7 text-primary" />
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
          <CardTitle className={cn("flex items-center gap-2", "font-bold text-2xl lg:text-3xl bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
            <UserCircle className="h-7 w-7 text-primary" />
            Account Details
          </CardTitle>
          <CardDescription>
            View and manage your personal account information and profile picture.
            The profile picture preview is displayed at approximately 128x128px and in the header at 36x36px.
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
                  name="photoURLInput"
                  render={({ field }) => (
                    <FormItem className="w-full max-w-sm">
                      <FormLabel className="flex items-center gap-1"><Link2 className="h-4 w-4 text-muted-foreground"/>Profile Picture URL</FormLabel>
                      <FormControl>
                        <Input type="url" placeholder="https://example.com/your-image.png" {...field} value={field.value || ''} disabled={isReadOnly} />
                      </FormControl>
                      <FormDescription>
                        Enter a valid URL for your profile picture. (e.g., JPG, PNG, WEBP)
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
                      <Input placeholder="Your display name" {...field} disabled={isReadOnly} />
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

              <Button type="submit" className="w-full md:w-auto bg-primary hover:bg-primary/90" disabled={isSubmitting || isReadOnly}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
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
            <div className="space-y-4">
                <div>
                    <h3 className="text-lg font-semibold text-foreground">Password</h3>
                     <Button variant="outline" onClick={handlePasswordReset} disabled={isSubmitting || !user.providerData.some(p => p.providerId === 'password') || isReadOnly}>
                        Send Password Reset Email
                     </Button>
                    <p className="text-xs text-muted-foreground mt-1">
                        {user.providerData.some(p => p.providerId === 'password')
                        ? "Click to send a password reset link to your email."
                        : "Password reset is not available for accounts signed in via an external provider (e.g., Google)."}
                    </p>
                </div>
                <Separator />
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

    
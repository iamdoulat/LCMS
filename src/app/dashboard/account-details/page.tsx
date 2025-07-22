
"use client";

import { zodResolver } from '@hookform/resolvers/zod';
import { updateProfile, sendPasswordResetEmail } from 'firebase/auth';
import { Loader2, UserCircle, Save, ShieldAlert, Image as ImageIcon, Link2, Upload, Crop } from 'lucide-react';
import React, { useEffect, useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import Swal from 'sweetalert2';
import Image from 'next/image';
import { doc, updateDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import ReactCrop, { type Crop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { auth, firestore, storage } from '@/lib/firebase/config';
import { useAuth } from '@/context/AuthContext';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';

const accountDetailsSchema = z.object({
  displayName: z.string().min(1, "Display name cannot be empty.").max(50, "Display name is too long."),
});

type AccountDetailsFormValues = z.infer<typeof accountDetailsSchema>;

// --- Helper for creating a cropped image blob ---
async function getCroppedImg(
  image: HTMLImageElement,
  crop: Crop,
  fileName: string
): Promise<File | null> {
  const canvas = document.createElement('canvas');
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;
  canvas.width = crop.width;
  canvas.height = crop.height;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return null;
  }

  const pixelRatio = window.devicePixelRatio;
  canvas.width = crop.width * pixelRatio;
  canvas.height = crop.height * pixelRatio;
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  ctx.imageSmoothingQuality = 'high';

  ctx.drawImage(
    image,
    crop.x * scaleX,
    crop.y * scaleY,
    crop.width * scaleX,
    crop.height * scaleY,
    0,
    0,
    crop.width,
    crop.height
  );

  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          resolve(null);
          return;
        }
        resolve(new File([blob], fileName, { type: 'image/jpeg' }));
      },
      'image/jpeg',
      0.95 // High quality
    );
  });
}

export default function AccountDetailsPage() {
  const { user, loading: authLoading, setUser: setAuthUser, userRole } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isReadOnly = userRole?.includes('Viewer');

  // States for image cropping
  const [imgSrc, setImgSrc] = useState('');
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<Crop>();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isCroppingDialogOpen, setIsCroppingDialogOpen] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const form = useForm<AccountDetailsFormValues>({
    resolver: zodResolver(accountDetailsSchema),
    defaultValues: { displayName: '' },
  });

  useEffect(() => {
    if (user) {
      form.reset({ displayName: user.displayName || '' });
    }
  }, [user, form]);

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
  
  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setCrop(undefined); // Reset crop state
      const file = e.target.files[0];
      setSelectedFile(file);
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        setImgSrc(reader.result?.toString() || '');
        setIsCroppingDialogOpen(true);
      });
      reader.readAsDataURL(file);
      e.target.value = ''; // Reset file input
    }
  };

  function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const { width, height } = e.currentTarget;
    const crop = centerCrop(
      makeAspectCrop({ unit: '%', width: 90 }, 1, width, height),
      width, height
    );
    setCrop(crop);
  }

  const handleCropAndUpload = async () => {
    if (!completedCrop || !imgRef.current || !selectedFile) {
        Swal.fire("Error", "Could not process the image crop.", "error");
        return;
    }
    setIsUploading(true);
    const croppedImageBlob = await getCroppedImg(imgRef.current, completedCrop, selectedFile.name);

    if (!croppedImageBlob) {
        Swal.fire("Error", "Failed to create cropped image.", "error");
        setIsUploading(false);
        return;
    }

    try {
        const storageRef = ref(storage, `profileImages/${user!.uid}/profile.jpg`);
        const snapshot = await uploadBytes(storageRef, croppedImageBlob);
        const downloadURL = await getDownloadURL(snapshot.ref);

        // Now update user profile with the new URL
        await updateProfile(auth.currentUser!, { photoURL: downloadURL });
        if (auth.currentUser!.uid) {
            const userDocRef = doc(firestore, "users", auth.currentUser!.uid);
            await updateDoc(userDocRef, { photoURL: downloadURL, updatedAt: serverTimestamp() });
        }
        
        // Update context and close dialog
        if (setAuthUser && auth.currentUser) {
            setAuthUser({ ...auth.currentUser });
        }

        setIsCroppingDialogOpen(false);
        Swal.fire({
            title: "Profile Picture Updated",
            icon: "success",
            timer: 2000,
            showConfirmButton: false,
        });

    } catch (err: any) {
        console.error("Error uploading profile picture:", err);
        Swal.fire("Upload Failed", `Failed to upload image: ${err.message}`, "error");
    } finally {
        setIsUploading(false);
    }
  };

  const onSubmitDisplayName = async (data: AccountDetailsFormValues) => {
    if (!auth.currentUser) {
      Swal.fire("Error", "No user logged in.", "error");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await updateProfile(auth.currentUser, { displayName: data.displayName });
      if (auth.currentUser.uid) {
        const userDocRef = doc(firestore, "users", auth.currentUser.uid);
        await updateDoc(userDocRef, { displayName: data.displayName, updatedAt: serverTimestamp() });
      }
      if (setAuthUser && auth.currentUser) {
        setAuthUser({ ...auth.currentUser });
      }
      Swal.fire({
        title: "Profile Updated",
        text: "Display name updated successfully.",
        icon: "success",
        timer: 2000,
        showConfirmButton: false,
      });
    } catch (err: any) {
      setError(err.message);
      Swal.fire("Update Failed", err.message, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!user || !user.email) return;
    const isPasswordProvider = user.providerData.some(p => p.providerId === 'password');
    if (!isPasswordProvider) {
      Swal.fire("Info", `You signed in with ${user.providerData[0]?.providerId || 'an external provider'}. Please reset your password there.`, "info");
      return;
    }
    Swal.fire({
      title: 'Send Password Reset Email?',
      text: `A password reset link will be sent to ${user.email}.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Send Link',
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await sendPasswordResetEmail(auth, user.email!);
          Swal.fire('Email Sent!', 'Check your inbox for the password reset link.', 'success');
        } catch (error: any) {
          Swal.fire('Error', `Failed to send email: ${error.message}`, 'error');
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
        <Card className="shadow-lg"><CardHeader><CardTitle>Account Details</CardTitle></CardHeader><CardContent><p>Please log in.</p></CardContent></Card>
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
          
          <Dialog open={isCroppingDialogOpen} onOpenChange={setIsCroppingDialogOpen}>
            <DialogContent className="max-w-md">
                <DialogHeader><DialogTitle>Crop Your Image</DialogTitle></DialogHeader>
                {imgSrc && (
                    <ReactCrop
                        crop={crop}
                        onChange={c => setCrop(c)}
                        onComplete={c => setCompletedCrop(c)}
                        aspect={1}
                        circularCrop
                        minWidth={100}
                    >
                        <img ref={imgRef} src={imgSrc} alt="Crop preview" onLoad={onImageLoad} style={{ maxHeight: '70vh' }}/>
                    </ReactCrop>
                )}
                <DialogFooter>
                    <DialogClose asChild><Button variant="outline" disabled={isUploading}>Cancel</Button></DialogClose>
                    <Button onClick={handleCropAndUpload} disabled={isUploading || !completedCrop}>
                        {isUploading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Uploading...</> : 'Crop & Upload'}
                    </Button>
                </DialogFooter>
            </DialogContent>
          </Dialog>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmitDisplayName)} className="space-y-6">
              <div className="flex flex-col items-center space-y-4 mb-8">
                <Avatar className="h-32 w-32 border-2 border-primary shadow-md">
                  <AvatarImage src={user.photoURL || undefined} alt={user.displayName || "User Avatar"} data-ai-hint="user avatar" />
                  <AvatarFallback className="text-4xl">
                    {getInitials(user.displayName || user.email || "U")}
                  </AvatarFallback>
                </Avatar>
                <div className="w-full max-w-sm">
                    <FormLabel htmlFor="profile-picture-upload">Profile Picture</FormLabel>
                    <div className="flex items-center gap-2 mt-1">
                        <Input id="profile-picture-upload" type="file" accept="image/png, image/jpeg" onChange={onFileSelect} className="flex-1" disabled={isReadOnly} />
                    </div>
                    <FormDescription className="mt-2">
                        Select a new image to upload and crop.
                    </FormDescription>
                </div>
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
                    <FormDescription>This name will be displayed to others.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                name="email"
                render={() => (
                  <FormItem>
                    <FormLabel>Email Address</FormLabel>
                    <FormControl>
                      <Input placeholder="your.email@example.com" value={user.email || ''} readOnly disabled className="cursor-not-allowed bg-muted/50" />
                    </FormControl>
                    <FormDescription>Your email address cannot be changed here.</FormDescription>
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full md:w-auto bg-primary hover:bg-primary/90" disabled={isSubmitting || isReadOnly}>
                {isSubmitting ? ( <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> ) : ( <><Save className="mr-2 h-4 w-4" />Save Name</>)}
              </Button>
            </form>
          </Form>

          <Separator className="my-8" />
          <div className="space-y-4">
              <div>
                  <h3 className="text-lg font-semibold text-foreground">Password</h3>
                  <Button variant="outline" onClick={handlePasswordReset} disabled={!user.providerData.some(p => p.providerId === 'password') || isReadOnly}>
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

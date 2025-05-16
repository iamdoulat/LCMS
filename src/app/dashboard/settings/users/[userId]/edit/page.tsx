
"use client";

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, UserCog, ShieldAlert } from 'lucide-react';
import Swal from 'sweetalert2';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

// Placeholder data - actual user data requires backend implementation
// In a real app, you'd fetch user data using userId via a backend Admin SDK call
const initialPlaceholderUsers = [
    { id: 'user1_abc', email: 'alice@example.com', displayName: 'Alice Wonderland', role: 'Admin' },
    { id: 'user2_xyz', email: 'bob@example.com', displayName: 'Bob The Builder', role: 'Editor' },
    { id: 'user3_123', email: 'carol@example.com', displayName: 'Carol Danvers', role: 'Viewer' },
    { id: 'user4_mdd', email: 'mddoulat@gmail.com', displayName: 'Doulat (Super Admin)', role: 'Super Admin' },
    { id: 'user5_css', email: 'commercial@smartsolution-bd.com', displayName: 'Commercial (Admin)', role: 'Admin' },
  ];

interface UserData {
  id: string;
  email?: string;
  displayName?: string;
  role?: string; // Simulated role
}

export default function EditUserPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.userId as string;
  const { userRole, loading: authLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [userData, setUserData] = useState<UserData | null>(null); // Placeholder for fetched user data

  useEffect(() => {
    if (!authLoading && userRole !== "Super Admin") {
      Swal.fire({
        title: 'Access Denied',
        text: 'You are not permitted to edit users.',
        icon: 'error',
        timer: 2000,
        showConfirmButton: false,
      }).then(() => {
        router.push('/dashboard/settings/users');
      });
    } else if (userId) {
      setIsLoading(true);
      console.log(`Simulating fetch for user ID: ${userId}`);
      // Simulate fetching user data from placeholder list
      setTimeout(() => {
        const foundUser = initialPlaceholderUsers.find(u => u.id === userId);
        if (foundUser) {
          setUserData(foundUser);
        } else {
          Swal.fire("Error", `User with ID ${userId} not found (simulated).`, "error");
          setUserData(null);
        }
        setIsLoading(false);
      }, 1000);
    } else {
      Swal.fire("Error", "No User ID provided.", "error");
      router.push('/dashboard/settings/users');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, userRole, authLoading, router]);


  if (authLoading || isLoading || userRole !== "Super Admin") {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] w-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-3 text-muted-foreground">Loading user details or verifying access...</p>
      </div>
    );
  }

  if (!userData) {
    return (
      <div className="container mx-auto py-8 text-center">
        <p className="text-muted-foreground mb-4">User data could not be loaded or user not found.</p>
        <Link href="/dashboard/settings/users" passHref>
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to User List
          </Button>
        </Link>
      </div>
    );
  }

  const handleSaveChanges = () => {
    Swal.fire({
        title: 'Backend Required',
        text: 'Updating another user\'s profile (Display Name, Email, Role/Custom Claims) requires a secure backend function using the Firebase Admin SDK. This action cannot be performed directly from the client-side.',
        icon: 'info',
    });
  };

  return (
    <div className="container mx-auto py-8">
      <div className="mb-6">
        <Link href="/dashboard/settings/users" passHref>
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to User List
          </Button>
        </Link>
      </div>
      <Card className="max-w-2xl mx-auto shadow-xl">
        <CardHeader>
          <CardTitle className={cn("flex items-center gap-2", "font-bold text-2xl lg:text-3xl bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
            <UserCog className="h-7 w-7 text-primary" />
            Edit User Profile (Simulated)
          </CardTitle>
          <CardDescription>
            Modify details for User ID: <span className="font-semibold text-foreground">{userId}</span>. Actual updates require backend.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="default" className="mb-6 bg-amber-500/10 border-amber-500/30">
            <ShieldAlert className="h-5 w-5 text-amber-600" />
            <AlertTitle className="text-amber-700 font-semibold">Backend Required for Full Functionality</AlertTitle>
            <AlertDescription className="text-amber-700/90">
              Editing other users' details (like email, password, display name, or role) and saving them to Firebase Authentication requires secure backend operations using the Firebase Admin SDK. This page is a UI placeholder.
            </AlertDescription>
          </Alert>
          <div className="space-y-4">
            <div>
              <label htmlFor="displayName" className="block text-sm font-medium text-muted-foreground">Display Name (Simulated)</label>
              <input
                type="text"
                id="displayName"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm p-2 bg-muted/50 cursor-not-allowed"
                defaultValue={userData.displayName || ''}
                disabled
              />
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-muted-foreground">Email (Simulated)</label>
              <input
                type="email"
                id="email"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm p-2 bg-muted/50 cursor-not-allowed"
                defaultValue={userData.email || ''}
                disabled
              />
            </div>
            <div>
              <label htmlFor="role" className="block text-sm font-medium text-muted-foreground">Role (Simulated)</label>
              <select
                id="role"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm p-2 bg-muted/50 cursor-not-allowed"
                defaultValue={userData.role || 'User'}
                disabled
              >
                <option>Super Admin</option>
                <option>Admin</option>
                <option>User</option>
              </select>
            </div>
            <div className="pt-4">
                <Button onClick={handleSaveChanges} disabled={userRole !== "Super Admin"}>Save Changes (Backend Required)</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

    
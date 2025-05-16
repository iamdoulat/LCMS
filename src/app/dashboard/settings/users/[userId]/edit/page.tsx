
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
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { UserRole } from '@/types';


// Placeholder structure for demonstrating table
interface PlaceholderUser {
  id: string;
  displayName?: string;
  email?: string;
  contactNumber?: string; 
  role?: UserRole;
}

// This would typically be fetched from a backend or come from route state if listing real users
const initialPlaceholderUsers: PlaceholderUser[] = [
  { id: 'sim_user_1', displayName: 'Demo User One', email: 'user1@example.com', contactNumber: '123-456-7890', role: 'User' },
  { id: 'sim_user_2', displayName: 'Demo Admin User', email: 'admin.test@example.com', contactNumber: '987-654-3210', role: 'Admin' },
  { id: 'sim_user_3', displayName: 'Another User', email: 'user2@example.com', role: 'User' },
];


export default function EditUserPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.userId as string;
  const { userRole: adminUserRole, loading: authLoading } = useAuth(); 
  
  const [isLoadingUserData, setIsLoadingUserData] = useState(true);
  const [userData, setUserData] = useState<PlaceholderUser | null>(null);
  
  // Form state simulation for edit
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editContactNumber, setEditContactNumber] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('User');


  useEffect(() => {
    if (!authLoading && adminUserRole !== "Super Admin" && adminUserRole !== "Admin") {
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
      setIsLoadingUserData(true);
      // Simulate fetching user data. In a real app, this would be an API call to your backend.
      const foundUser = initialPlaceholderUsers.find(u => u.id === userId);
      if (foundUser) {
        setUserData(foundUser);
        setEditDisplayName(foundUser.displayName || '');
        setEditEmail(foundUser.email || '');
        setEditContactNumber(foundUser.contactNumber || '');
        setEditRole(foundUser.role || 'User');
      } else {
        Swal.fire("Error", `User with ID ${userId} not found in placeholder list.`, "error");
        setUserData(null);
      }
      setIsLoadingUserData(false);
    } else {
      Swal.fire("Error", "No User ID provided.", "error");
      router.push('/dashboard/settings/users');
    }
  }, [userId, adminUserRole, authLoading, router]);


  if (authLoading || isLoadingUserData || (adminUserRole !== "Super Admin" && adminUserRole !== "Admin")) {
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
    const updatedUserDataSim = {
      id: userId,
      displayName: editDisplayName,
      email: editEmail,
      contactNumber: editContactNumber,
      role: editRole,
    };

    console.log(`Simulating save for user ${userId}. New Data:`, updatedUserDataSim);
    Swal.fire({
        title: 'Changes Simulated (Backend Required)',
        html: `Updating user (ID: ${userId}) details in Firebase Authentication (Display Name, Email, Password, Role/Custom Claims) requires a secure backend function using the Firebase Admin SDK.
               <br/><br/>The changes have <strong>not</strong> been saved to Firebase Auth. This is a UI simulation.
               <br/><br/>Data that would be sent to backend: <pre class="text-left text-xs bg-muted p-2 rounded">${JSON.stringify(updatedUserDataSim, null, 2)}</pre>`,
        icon: 'info',
        confirmButtonText: "OK",
    }).then(() => {
        // router.push('/dashboard/settings/users'); // Optional: redirect after simulation
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
            Edit User (Simulated)
          </CardTitle>
          <CardDescription>
            Modify details for User ID: <span className="font-semibold text-foreground">{userId}</span>. Changes are simulated.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="default" className="mb-6 bg-amber-500/10 border-amber-500/30">
            <ShieldAlert className="h-5 w-5 text-amber-600" />
            <AlertTitle className="text-amber-700 font-semibold">Backend Required for Full Functionality</AlertTitle>
            <AlertDescription className="text-amber-700/90">
              Editing other users' details (like email, password, display name, or role/custom claims) and saving them to Firebase Authentication requires secure backend operations using the Firebase Admin SDK. This page simulates the UI for such an operation.
            </AlertDescription>
          </Alert>
          <div className="space-y-4">
            <div>
              <label htmlFor="displayName" className="block text-sm font-medium text-muted-foreground">Display Name</label>
              <Input
                type="text"
                id="displayName"
                className="mt-1 block w-full rounded-md border-input bg-background shadow-sm focus:border-primary focus:ring-primary sm:text-sm p-2"
                value={editDisplayName}
                onChange={(e) => setEditDisplayName(e.target.value)}
                disabled={adminUserRole !== "Super Admin" && adminUserRole !== "Admin"}
              />
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-muted-foreground">Email</label>
              <Input
                type="email"
                id="email"
                className="mt-1 block w-full rounded-md border-input bg-background shadow-sm focus:border-primary focus:ring-primary sm:text-sm p-2"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                disabled={adminUserRole !== "Super Admin" && adminUserRole !== "Admin"}
              />
               <p className="mt-1 text-xs text-muted-foreground">Note: Actually changing a user's email in Firebase Auth has implications (e.g., verification status) and requires Admin SDK.</p>
            </div>
             <div>
              <label htmlFor="contactNumber" className="block text-sm font-medium text-muted-foreground">Contact Number (from Profile)</label>
              <Input
                type="tel"
                id="contactNumber"
                className="mt-1 block w-full rounded-md border-input bg-background shadow-sm focus:border-primary focus:ring-primary sm:text-sm p-2"
                value={editContactNumber}
                onChange={(e) => setEditContactNumber(e.target.value)}
                disabled={adminUserRole !== "Super Admin" && adminUserRole !== "Admin"}
              />
            </div>
            <div>
              <label htmlFor="role" className="block text-sm font-medium text-muted-foreground">Role (from Claims - Simulated)</label>
              <Select 
                value={editRole} 
                onValueChange={(value) => setEditRole(value as UserRole)}
                disabled={adminUserRole !== "Super Admin" && adminUserRole !== "Admin"}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Super Admin">Super Admin</SelectItem>
                  <SelectItem value="Admin">Admin</SelectItem>
                  <SelectItem value="User">User</SelectItem>
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-muted-foreground">Actual role changes are managed by setting custom claims on the user via Firebase Admin SDK.</p>
            </div>
            <div className="pt-4">
                <Button onClick={handleSaveChanges} disabled={adminUserRole !== "Super Admin" && adminUserRole !== "Admin"}>Save Changes (Simulated)</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

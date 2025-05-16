
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
import { Input } from '@/components/ui/input'; // Assuming Input and Select might be used
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface UserData {
  id: string;
  email?: string;
  displayName?: string;
  role?: string; // Simulated role, would come from custom claims
}

// Placeholder for what a backend might return for a single user
const fetchUserFromBackendPlaceholder = async (userId: string): Promise<UserData | null> => {
  console.log(`EditUserPage: Would fetch user ${userId} data from backend Admin SDK here.`);
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  // Simulate finding a user or not
  const demoUsers = [
    { id: 'user1_abc_fetched', email: 'alice.fetched@example.com', displayName: 'Alice (Fetched)', role: 'Admin' },
    { id: 'mddoulat_gmail_com', email: 'mddoulat@gmail.com', displayName: 'Doulat (Super Admin)', role: 'Super Admin' },
    { id: 'commercial_smartsolution_bd_com', email: 'commercial@smartsolution-bd.com', displayName: 'Commercial (Admin)', role: 'Admin' },
    { id: 'user2_xyz_fetched', email: 'bob.fetched@example.com', displayName: 'Bob (Fetched)', role: 'Editor' },
  ];
  const foundUser = demoUsers.find(u => u.id === userId);
  return foundUser || null;
};


export default function EditUserPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.userId as string;
  const { userRole: adminUserRole, loading: authLoading } = useAuth(); // Renamed to avoid conflict
  
  const [isLoadingUserData, setIsLoadingUserData] = useState(true);
  const [userData, setUserData] = useState<UserData | null>(null);
  
  // Form state simulation for edit
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState('');


  useEffect(() => {
    if (!authLoading && adminUserRole !== "Super Admin") {
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
      fetchUserFromBackendPlaceholder(userId).then(user => {
        if (user) {
          setUserData(user);
          setEditDisplayName(user.displayName || '');
          setEditEmail(user.email || '');
          setEditRole(user.role || 'User'); // Default to 'User' if no role
        } else {
          Swal.fire("Error", `User with ID ${userId} not found (simulated backend fetch).`, "error");
          setUserData(null);
        }
        setIsLoadingUserData(false);
      });
    } else {
      Swal.fire("Error", "No User ID provided.", "error");
      router.push('/dashboard/settings/users');
    }
  }, [userId, adminUserRole, authLoading, router]);


  if (authLoading || isLoadingUserData || adminUserRole !== "Super Admin") {
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
    const updatedData = {
        displayName: editDisplayName,
        email: editEmail, // Note: Changing email via Admin SDK is possible but complex (re-verification etc.)
        role: editRole, // Role changes would involve setting custom claims
    };
    console.log(`EditUserPage: Would call backend function to update user ${userId}. New Data:`, updatedData);
    Swal.fire({
        title: 'Backend Required for Update',
        html: `Updating user (ID: ${userId}) details (Display Name, Email) or role (via custom claims) requires a secure backend function using the Firebase Admin SDK.
               <br/><br/>Data to send to backend: <pre class="text-left text-xs bg-muted p-2 rounded">${JSON.stringify(updatedData, null, 2)}</pre>`,
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
            Edit User (Backend Dependent)
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
                disabled={adminUserRole !== "Super Admin"}
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
                disabled={adminUserRole !== "Super Admin"}
              />
               <p className="mt-1 text-xs text-muted-foreground">Note: Changing a user's email directly via Admin SDK has implications (e.g., verification status).</p>
            </div>
            <div>
              <label htmlFor="role" className="block text-sm font-medium text-muted-foreground">Role (via Custom Claims)</label>
              <Select 
                value={editRole} 
                onValueChange={setEditRole}
                disabled={adminUserRole !== "Super Admin"}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Super Admin">Super Admin</SelectItem>
                  <SelectItem value="Admin">Admin</SelectItem>
                  <SelectItem value="User">User</SelectItem>
                  {/* Add other roles as needed */}
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-muted-foreground">Role changes are managed by setting custom claims on the user via Firebase Admin SDK.</p>
            </div>
            <div className="pt-4">
                <Button onClick={handleSaveChanges} disabled={adminUserRole !== "Super Admin"}>Save Changes (Backend Required)</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

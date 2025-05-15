
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Users, Info, ShieldAlert } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

// Placeholder data - actual user data requires backend implementation
const placeholderUsers = [
  { id: 'user1_abc', email: 'alice@example.com', displayName: 'Alice Wonderland', role: 'Admin' },
  { id: 'user2_xyz', email: 'bob@example.com', displayName: 'Bob The Builder', role: 'Editor' },
  { id: 'user3_123', email: 'carol@example.com', displayName: 'Carol Danvers', role: 'Viewer' },
];

export default function UserSettingsPage() {
  return (
    <div className="container mx-auto py-8">
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className={cn("flex items-center gap-2", "font-bold text-2xl lg:text-3xl bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out")}>
            <Users className="h-7 w-7 text-primary" />
            User Management
          </CardTitle>
          <CardDescription>
            View and manage user accounts, roles, and permissions for LC Vision.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="default" className="mb-6 bg-primary/10 border-primary/30">
            <ShieldAlert className="h-5 w-5 text-primary" />
            <AlertTitle className="text-primary font-semibold">Important Security Note</AlertTitle>
            <AlertDescription className="text-primary/90">
              Displaying a full list of users requires special permissions and is typically handled by a secure backend (e.g., Firebase Cloud Functions with Admin SDK).
              The data below is for UI demonstration purposes only and does not reflect actual user data from your Firebase project.
            </AlertDescription>
          </Alert>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">User ID</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Display Name</TableHead>
                  <TableHead className="text-right">Role (Placeholder)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {placeholderUsers.length > 0 ? (
                  placeholderUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium truncate max-w-[200px]">{user.id}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>{user.displayName || 'N/A'}</TableCell>
                      <TableCell className="text-right">{user.role}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center">
                      No placeholder users to display.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
              <TableCaption className="py-4">
                This is a list of placeholder users. Actual user management requires backend integration.
              </TableCaption>
            </Table>
          </div>
          
          {/* Future: Add controls for adding users, editing roles, etc. */}
          {/* These would also require backend functionality. */}
          {/*
          <div className="mt-6 flex justify-end">
            <Button variant="outline">
              <UserPlus className="mr-2 h-4 w-4" /> Add New User (UI Placeholder)
            </Button>
          </div>
          */}
        </CardContent>
      </Card>
    </div>
  );
}

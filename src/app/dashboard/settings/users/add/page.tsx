
import { AddUserForm } from '@/components/forms/AddUserForm';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { UserPlus, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function AddUserPage() {
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
          <CardTitle className={cn("font-bold text-2xl lg:text-3xl flex items-center gap-2 text-primary")}>
            <UserPlus className="h-7 w-7" />
            Add New User
          </CardTitle>
          <CardDescription>
            Create a new user account and assign a role. An email and a temporary password are required.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AddUserForm />
        </CardContent>
      </Card>
    </div>
  );
}

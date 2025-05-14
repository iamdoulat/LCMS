
"use client";

import Link from 'next/link';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { User, LogOut, Settings, Loader2, Search } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export function AppHeader() {
  const { user, logout, loading } = useAuth();

  const getInitials = (nameOrEmail: string) => {
    if (!nameOrEmail) return 'U';
    // Check if it's an email to extract from before '@'
    const namePart = nameOrEmail.includes('@') ? nameOrEmail.split('@')[0] : nameOrEmail;
    return namePart
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  const displayName = user?.displayName || user?.email || 'User';
  const displayEmail = user?.email || 'No email available';

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-card px-4 md:px-6 shadow-sm">
      <div className="flex items-center gap-2">
        <SidebarTrigger className="md:hidden" />
        <Link href="/dashboard" className="text-xl font-semibold text-primary whitespace-nowrap">
          LC Management System
        </Link>
      </div>
      
      <div className="ml-auto flex items-center gap-2"> {/* Reduced gap from gap-4 */}
        {/* Placeholder Search Button */}
        <Button variant="ghost" size="icon" className="h-9 w-9">
          <Search className="h-5 w-5 text-muted-foreground" />
          <span className="sr-only">Search</span>
        </Button>

        {loading ? (
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        ) : user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                <Avatar className="h-9 w-9">
                  <AvatarImage src={user.photoURL || `https://placehold.co/40x40.png?text=${getInitials(displayName)}`} alt={displayName} data-ai-hint="profile avatar" />
                  <AvatarFallback>{getInitials(displayName)}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{displayName}</p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {displayEmail}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <Link href="/dashboard/account-details" passHref>
                <DropdownMenuItem>
                  <User className="mr-2 h-4 w-4" />
                  <span>Account Details</span>
                </DropdownMenuItem>
              </Link>
              {/* <DropdownMenuItem> // Future settings link
                <Settings className="mr-2 h-4 w-4" />
                <span>Settings</span>
              </DropdownMenuItem> */}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
           <Link href="/login" passHref>
             <Button variant="outline">Login</Button>
           </Link>
        )}
      </div>
    </header>
  );
}


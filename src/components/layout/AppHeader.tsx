
"use client";

import Link from 'next/link';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
import { User, LogOut, Settings, Loader2, Search, Smartphone, Trash2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { ThemeToggleButton } from '@/components/ui/ThemeToggleButton';
import { cn } from '@/lib/utils';
import Image from 'next/image';

export function AppHeader() {
  const { user, logout, loading, companyName, companyLogoUrl, setViewMode } = useAuth();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchPopoverOpen, setIsSearchPopoverOpen] = useState(false);

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

  const displayName = user?.displayName || user?.email || 'User';
  const displayEmail = user?.email || 'No email available';

  const handleSearchSubmit = (e?: React.FormEvent<HTMLFormElement>) => {
    e?.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/dashboard/search?q=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      router.push('/dashboard/search');
    }
    setSearchQuery('');
    setIsSearchPopoverOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 flex h-16 items-center gap-4 border-b bg-card shadow-sm px-2 md:px-4">
      <div className="flex items-center gap-2">
        <SidebarTrigger className="md:hidden" />
        {user && ( // Only show this link if a user is logged in
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="relative h-8 w-8 overflow-hidden rounded-full border border-border md:hidden shrink-0">
              <Image
                src={companyLogoUrl || '/icons/icon-192x192.png'}
                alt={companyName || 'Logo'}
                fill
                className="object-cover"
              />
            </div>
            <span
              className={cn(
                "font-bold text-base truncate",
                "bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-rose-500 text-transparent bg-clip-text hover:tracking-wider transition-all duration-300 ease-in-out"
              )}
            >
              <span className="hidden md:inline">Indenting & LC Management System</span>
              <span className="inline md:hidden">{companyName || 'NextSew'}</span>
            </span>
          </Link>
        )}
      </div>

      <div className="ml-auto flex items-center gap-2">
        <Popover open={isSearchPopoverOpen} onOpenChange={setIsSearchPopoverOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Search">
              <Search className="h-5 w-5 text-muted-foreground" />
              <span className="sr-only">Search</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-2">
            <form onSubmit={handleSearchSubmit} className="flex gap-2">
              <Input
                type="search"
                placeholder="Search L/C, PI, Applicant..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 h-9"
                autoFocus
              />
              <Button type="submit" size="sm" className="h-9">
                <Search className="h-4 w-4" />
              </Button>
            </form>
          </PopoverContent>
        </Popover>

        <ThemeToggleButton />

        {loading ? (
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        ) : user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                <Avatar className="h-9 w-9">
                  <AvatarImage src={user.photoURL ?? undefined} alt={displayName} />
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
                <DropdownMenuItem className="cursor-pointer">
                  <User className="mr-2 h-4 w-4" />
                  <span>Account Details</span>
                </DropdownMenuItem>
              </Link>
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={async (e) => {
                  e.preventDefault();
                  try {
                    if ('caches' in window) {
                      const cacheNames = await caches.keys();
                      await Promise.all(cacheNames.map((n) => caches.delete(n)));
                    }
                    localStorage.clear();
                    sessionStorage.clear();
                    if ('serviceWorker' in navigator) {
                      const regs = await navigator.serviceWorker.getRegistrations();
                      await Promise.all(regs.map((r) => r.unregister()));
                    }
                    alert('Cache cleared successfully! The app will reload.');
                    window.location.reload();
                  } catch (error) {
                    console.error('Error clearing cache:', error);
                  }
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                <span>Clear Cache</span>
              </DropdownMenuItem>
              <Link href="/mobile/dashboard" passHref>
                <DropdownMenuItem className="cursor-pointer" onClick={() => setViewMode('mobile')}>
                  <Smartphone className="mr-2 h-4 w-4" />
                  <span>Mobile Mode</span>
                </DropdownMenuItem>
              </Link>
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

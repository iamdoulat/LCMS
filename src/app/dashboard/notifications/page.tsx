
"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BellRing, CheckCheck, Info } from 'lucide-react';
import type { AppNotification } from '@/types';
import { NotificationItem } from '@/components/notifications/NotificationItem';
import { Separator } from '@/components/ui/separator';

const initialNotifications: AppNotification[] = [
  { 
    id: '1', 
    title: 'New L/C Created', 
    message: 'L/C #LC-2024-001 for Applicant Alpha with Beneficiary Beta has been successfully created and is in Draft status.',
    timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 minutes ago
    isRead: false, 
    link: '/dashboard/total-lc' // Placeholder link
  },
  { 
    id: '2', 
    title: 'Shipment Update: LC-2023-105', 
    message: 'The ETD for L/C #LC-2023-105 has been updated to 2024-09-15. Please review the details.',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
    isRead: false,
    link: '/dashboard/total-lc' // Placeholder link
  },
  { 
    id: '3', 
    title: 'User Profile Updated', 
    message: 'Your display name was successfully changed.',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1 day ago
    isRead: true 
  },
  {
    id: '4',
    title: 'System Maintenance Alert',
    message: 'Scheduled system maintenance will occur on Sunday at 2:00 AM UTC. Expect brief downtime.',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(), // 2 days ago
    isRead: true,
  }
];


export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<AppNotification[]>(initialNotifications);

  const handleToggleRead = (id: string) => {
    setNotifications(prevNotifications =>
      prevNotifications.map(notif =>
        notif.id === id ? { ...notif, isRead: !notif.isRead } : notif
      )
    );
  };

  const handleMarkAllAsRead = () => {
    setNotifications(prevNotifications =>
      prevNotifications.map(notif => ({ ...notif, isRead: true }))
    );
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <div className="container mx-auto py-8">
      <Card className="shadow-xl max-w-3xl mx-auto">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="flex items-center gap-2 text-2xl font-bold text-primary">
                <BellRing className="h-7 w-7" />
                Notifications
              </CardTitle>
              <CardDescription>
                View and manage your recent notifications. Unread: <span className="font-bold text-primary">{unreadCount}</span>
              </CardDescription>
            </div>
            {unreadCount > 0 && (
                <Button onClick={handleMarkAllAsRead} variant="outline" size="sm">
                    <CheckCheck className="mr-2 h-4 w-4" />
                    Mark all as read
                </Button>
            )}
          </div>
        </CardHeader>
        <Separator className="my-4" />
        <CardContent>
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
              <Info className="h-10 w-10 mb-2" />
              <p className="text-lg">No notifications yet.</p>
              <p className="text-sm">We'll let you know when something new happens.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {notifications.map(notification => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onToggleRead={handleToggleRead}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

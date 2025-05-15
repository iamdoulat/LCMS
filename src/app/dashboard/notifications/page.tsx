
"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BellRing, CheckCheck, Info, Trash2 } from 'lucide-react';
import type { AppNotification } from '@/types';
import { NotificationItem } from '@/components/notifications/NotificationItem';
import { Separator } from '@/components/ui/separator';
import Swal from 'sweetalert2';

const initialNotifications: AppNotification[] = [
  {
    id: '1',
    title: 'New L/C Created',
    message: 'L/C #LC-2024-001 for Applicant Alpha with Beneficiary Beta has been successfully created and is in Draft status.',
    timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 minutes ago
    isRead: false,
    link: '/dashboard/total-lc'
  },
  {
    id: '2',
    title: 'Shipment Update: LC-2023-105',
    message: 'The ETD for L/C #LC-2023-105 has been updated to 2024-09-15. Please review the details.',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
    isRead: false,
    link: '/dashboard/total-lc'
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

const NOTIFICATIONS_STORAGE_KEY = 'appNotificationsList';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  // Function to update localStorage for the global unread status (for header dot)
  const updateUnreadStatusInStorage = (currentNotifications: AppNotification[]) => {
    const anyUnread = currentNotifications.some(n => !n.isRead);
    if (typeof window !== 'undefined') {
        localStorage.setItem('appNotificationsAllRead', anyUnread ? 'false' : 'true');
        window.dispatchEvent(new Event('notificationsUpdated')); // Notify header
    }
  };

  // Helper to save the entire notifications list to localStorage
  const saveNotificationsToLocalStorage = (updatedNotifications: AppNotification[]) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(updatedNotifications));
    }
  };

  // Initialize notifications from localStorage or use initialNotifications
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedNotifications = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
      let currentNotifications: AppNotification[];
      if (storedNotifications) {
        try {
          currentNotifications = JSON.parse(storedNotifications);
        } catch (e) {
          console.error("Error parsing stored notifications, defaulting to initial:", e);
          currentNotifications = [...initialNotifications];
          saveNotificationsToLocalStorage(currentNotifications); // Save initial if parsing failed
        }
      } else {
        currentNotifications = [...initialNotifications];
        saveNotificationsToLocalStorage(currentNotifications);
      }
      setNotifications(currentNotifications);
      updateUnreadStatusInStorage(currentNotifications);
    }
  }, []);


  const handleToggleRead = (id: string) => {
    const updatedNotifications = notifications.map(notif =>
      notif.id === id ? { ...notif, isRead: !notif.isRead } : notif
    );
    setNotifications(updatedNotifications);
    saveNotificationsToLocalStorage(updatedNotifications);
    updateUnreadStatusInStorage(updatedNotifications);
  };

  const handleMarkAllAsRead = () => {
    const updatedNotifications = notifications.map(notif => ({ ...notif, isRead: true }));
    setNotifications(updatedNotifications);
    saveNotificationsToLocalStorage(updatedNotifications);
    updateUnreadStatusInStorage(updatedNotifications);
    Swal.fire({
      title: "All Read",
      text: "All notifications have been marked as read.",
      icon: "success",
      timer: 1500,
      showConfirmButton: false
    });
  };

  const handleDeleteNotification = (id: string) => {
    const notificationToDelete = notifications.find(n => n.id === id);
    Swal.fire({
      title: 'Delete Notification?',
      text: `Are you sure you want to delete the notification: "${notificationToDelete?.title || 'this notification'}"? This action cannot be undone.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: 'hsl(var(--destructive))',
      cancelButtonColor: 'hsl(var(--secondary))',
      confirmButtonText: 'Yes, delete it!',
      reverseButtons: true,
    }).then((result) => {
      if (result.isConfirmed) {
        const updatedNotifications = notifications.filter(notif => notif.id !== id);
        setNotifications(updatedNotifications);
        saveNotificationsToLocalStorage(updatedNotifications);
        updateUnreadStatusInStorage(updatedNotifications);
        Swal.fire(
          'Deleted!',
          'The notification has been removed.',
          'success'
        );
      }
    });
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
                  onDelete={handleDeleteNotification}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


"use client";

import type { AppNotification } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from 'date-fns';
import Link from "next/link";
import { Eye, CheckCircle2, Circle, Trash2 } from "lucide-react";

interface NotificationItemProps {
  notification: AppNotification;
  onToggleRead: (id: string) => void;
  onDelete: (id: string) => void;
}

export function NotificationItem({ notification, onToggleRead, onDelete }: NotificationItemProps) {
  const timeAgo = formatDistanceToNow(new Date(notification.timestamp), { addSuffix: true });

  return (
    <Card className={cn("mb-4 shadow-md hover:shadow-lg transition-shadow", notification.isRead ? "bg-muted/50" : "bg-card")}>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
            <div>
                <CardTitle className={cn("text-lg", notification.isRead ? "text-muted-foreground font-normal" : "text-primary font-semibold")}>
                {notification.title}
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">{timeAgo}</CardDescription>
            </div>
            {notification.isRead ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
            ) : (
                <Circle className="h-5 w-5 text-blue-500 animate-pulse" />
            )}
        </div>
      </CardHeader>
      <CardContent className="pt-0 pb-3">
        <p className={cn("text-sm", notification.isRead ? "text-muted-foreground" : "text-foreground")}>{notification.message}</p>
      </CardContent>
      <CardFooter className="flex justify-end gap-2 pt-0">
        {notification.link && (
          <Link href={notification.link} passHref>
            <Button variant="outline" size="sm">
              <Eye className="mr-2 h-4 w-4" />
              View Details
            </Button>
          </Link>
        )}
        <Button variant="ghost" size="sm" onClick={() => onToggleRead(notification.id)}>
          {notification.isRead ? "Mark as Unread" : "Mark as Read"}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => onDelete(notification.id)} className="text-destructive hover:text-destructive hover:bg-destructive/10">
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </Button>
      </CardFooter>
    </Card>
  );
}

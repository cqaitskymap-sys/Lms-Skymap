"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import {
  getUserNotifications,
  markNotificationRead,
} from "@/lib/services/training";
import { TRAINING_UPDATED_EVENT } from "@/lib/training/demo-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";
import type { Notification } from "@/types";

export default function NotificationsPage() {
  const { profile } = useAuth();
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!profile) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setItems(await getUserNotifications(profile.uid));
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    void refresh();
    const onUpdate = () => void refresh();
    window.addEventListener(TRAINING_UPDATED_EVENT, onUpdate);
    window.addEventListener("pharma-lifecycle-updated", onUpdate);
    return () => {
      window.removeEventListener(TRAINING_UPDATED_EVENT, onUpdate);
      window.removeEventListener("pharma-lifecycle-updated", onUpdate);
    };
  }, [refresh]);

  const handleOpen = async (n: Notification) => {
    if (!n.isRead) {
      try {
        await markNotificationRead(n.id);
        setItems((prev) =>
          prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x))
        );
      } catch {
        /* non-blocking */
      }
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
        <p className="text-muted-foreground">
          Assignments, assessments, SOP revisions & certificates
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No notifications yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((n) => (
            <Card key={n.id} className={!n.isRead ? "border-primary/40" : undefined}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{n.title}</CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{n.type}</Badge>
                    {!n.isRead && <Badge>New</Badge>}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{n.message}</p>
                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{formatDateTime(n.createdAt)}</span>
                  {n.link && (
                    <Link
                      href={n.link}
                      className="text-primary hover:underline"
                      onClick={() => void handleOpen(n)}
                    >
                      Open →
                    </Link>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

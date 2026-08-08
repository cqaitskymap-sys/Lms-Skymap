"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth-context";
import { RequirePermission } from "@/components/auth/require-permission";
import {
  deleteNotification,
  getUserNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  NOTIFICATIONS_UPDATED_EVENT,
} from "@/lib/services/notifications";
import { TRAINING_UPDATED_EVENT } from "@/lib/training/demo-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/utils";
import type { Notification, NotificationType } from "@/types";
import { cn } from "@/lib/utils";

const TYPE_LABEL: Record<NotificationType, string> = {
  assignment: "Assignment",
  reminder: "Reminder",
  assessment: "Assessment",
  certificate: "Certificate",
  sop_revision: "SOP revision",
  handover: "Handover",
  retraining: "Retraining",
  system: "System",
};

type Filter = "all" | "unread";

export default function NotificationsPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");

  const refresh = useCallback(async () => {
    if (!profile) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setItems(await getUserNotifications(profile.uid));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load notifications");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    void refresh();
    const onUpdate = () => void refresh();
    window.addEventListener(TRAINING_UPDATED_EVENT, onUpdate);
    window.addEventListener("pharma-lifecycle-updated", onUpdate);
    window.addEventListener(NOTIFICATIONS_UPDATED_EVENT, onUpdate);
    return () => {
      window.removeEventListener(TRAINING_UPDATED_EVENT, onUpdate);
      window.removeEventListener("pharma-lifecycle-updated", onUpdate);
      window.removeEventListener(NOTIFICATIONS_UPDATED_EVENT, onUpdate);
    };
  }, [refresh]);

  const markRead = async (n: Notification) => {
    if (n.isRead) return;
    try {
      await markNotificationRead(n.id);
      setItems((prev) =>
        prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x))
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not mark as read");
    }
  };

  const handleOpen = async (n: Notification) => {
    await markRead(n);
    if (n.link) router.push(n.link);
  };

  const handleMarkAll = async () => {
    if (!profile) return;
    setMarkingAll(true);
    try {
      await markAllNotificationsRead(profile.uid);
      setItems((prev) => prev.map((x) => ({ ...x, isRead: true })));
      toast.success("All notifications marked as read");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Mark all failed");
    } finally {
      setMarkingAll(false);
    }
  };

  const handleDelete = async (n: Notification) => {
    try {
      await deleteNotification(n.id);
      setItems((prev) => prev.filter((x) => x.id !== n.id));
      toast.success("Notification removed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const unreadCount = items.filter((n) => !n.isRead).length;
  const visible = useMemo(
    () => (filter === "unread" ? items.filter((n) => !n.isRead) : items),
    [items, filter]
  );

  return (
    <RequirePermission permission="notifications:read">
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
            <p className="text-muted-foreground">
              Assignments, assessments, SOP revisions & certificates
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={filter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("all")}
            >
              All ({items.length})
            </Button>
            <Button
              variant={filter === "unread" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("unread")}
            >
              Unread ({unreadCount})
            </Button>
            {unreadCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                disabled={markingAll}
                onClick={() => void handleMarkAll()}
              >
                {markingAll ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCheck className="mr-2 h-4 w-4" />
                )}
                Mark all as read
              </Button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : error ? (
          <Card>
            <CardContent className="space-y-3 py-10 text-center">
              <p className="text-sm text-destructive">{error}</p>
              <Button variant="outline" size="sm" onClick={() => void refresh()}>
                Retry
              </Button>
            </CardContent>
          </Card>
        ) : visible.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              {filter === "unread"
                ? "No unread notifications."
                : "No notifications yet."}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {visible.map((n) => (
              <Card
                key={n.id}
                className={cn(
                  "transition-colors",
                  !n.isRead && "border-primary/40 bg-primary/5"
                )}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{n.title}</CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">
                        {TYPE_LABEL[n.type] || n.type}
                      </Badge>
                      {!n.isRead && <Badge>New</Badge>}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{n.message}</p>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>{formatDateTime(n.createdAt)}</span>
                    <div className="flex items-center gap-2">
                      {!n.isRead && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => void markRead(n)}
                        >
                          Mark read
                        </Button>
                      )}
                      {n.link && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-primary"
                          onClick={() => void handleOpen(n)}
                        >
                          Open →
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        aria-label="Delete notification"
                        onClick={() => void handleDelete(n)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </RequirePermission>
  );
}

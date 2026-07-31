"use client";

import { DEMO_NOTIFICATIONS } from "@/lib/demo/data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";
import Link from "next/link";

export default function NotificationsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
        <p className="text-muted-foreground">Assignments, assessments, SOP revisions & certificates</p>
      </div>
      <div className="space-y-3">
        {DEMO_NOTIFICATIONS.map((n) => (
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
                  <Link href={n.link} className="text-primary hover:underline">
                    Open →
                  </Link>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

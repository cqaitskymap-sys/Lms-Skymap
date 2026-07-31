"use client";

import { useEffect, useMemo, useState } from "react";
import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { GlassCard, GlassCardHeader } from "@/components/dashboard/glass-card";
import { MotionItem } from "@/components/dashboard/motion";
import { listTrainingSessions } from "@/lib/services/training";
import { cn } from "@/lib/utils";

export function MiniCalendar({ month }: { month?: Date }) {
  const [now] = useState(() => new Date());
  const viewMonth = month || now;
  const [events, setEvents] = useState<{ date: string; tone: string }[]>([]);

  useEffect(() => {
    const load = () => {
      void listTrainingSessions()
        .then((sessions) => {
          setEvents(
            sessions.map((s) => ({
              date: s.scheduledAt.slice(0, 10),
              tone:
                s.status === "completed"
                  ? "accent"
                  : s.status === "cancelled"
                    ? "danger"
                    : "primary",
            }))
          );
        })
        .catch(() => setEvents([]));
    };
    load();
    window.addEventListener("pharma-training-updated", load);
    return () => window.removeEventListener("pharma-training-updated", load);
  }, []);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(viewMonth));
    const end = endOfWeek(endOfMonth(viewMonth));
    return eachDayOfInterval({ start, end });
  }, [viewMonth]);

  const eventMap = new Map(events.map((e) => [e.date, e]));

  const toneClass: Record<string, string> = {
    primary: "bg-primary text-primary-foreground",
    accent: "bg-sky-500/20 text-sky-800 ring-1 ring-sky-500/40 dark:text-sky-200",
    warning: "bg-amber-500/20 text-amber-900 ring-1 ring-amber-500/40 dark:text-amber-200",
    danger: "bg-red-500/20 text-red-900 ring-1 ring-red-500/40 dark:text-red-200",
  };

  return (
    <MotionItem className="h-full">
      <GlassCard className="h-full">
        <GlassCardHeader
          title={format(viewMonth, "MMMM yyyy")}
          description="Training sessions"
        />
        <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-muted-foreground">
          {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
            <div key={d} className="py-1 font-medium">
              {d}
            </div>
          ))}
          {days.map((day) => {
            const key = format(day, "yyyy-MM-dd");
            const event = eventMap.get(key);
            const inMonth = isSameMonth(day, viewMonth);
            const isToday = isSameDay(day, now);
            return (
              <div
                key={key}
                className={cn(
                  "relative flex h-8 items-center justify-center rounded-md text-xs",
                  !inMonth && "text-muted-foreground/40",
                  isToday && "ring-1 ring-primary",
                  event && toneClass[event.tone]
                )}
              >
                {format(day, "d")}
              </div>
            );
          })}
        </div>
      </GlassCard>
    </MotionItem>
  );
}

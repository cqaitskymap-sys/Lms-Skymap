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
import { calendarDayKey, cn } from "@/lib/utils";

export function MiniCalendar({ month }: { month?: Date }) {
  const [now, setNow] = useState<Date | null>(null);
  const [events, setEvents] = useState<{ date: string; tone: string }[]>([]);

  useEffect(() => {
    setNow(month ?? new Date());
  }, [month]);

  useEffect(() => {
    const load = () => {
      void listTrainingSessions()
        .then((sessions) => {
          setEvents(
            sessions.flatMap((s) => {
              const date = calendarDayKey(s.scheduledAt);
              if (!date) return [];
              return [
                {
                  date,
                  tone:
                    s.status === "completed"
                      ? "accent"
                      : s.status === "cancelled"
                        ? "danger"
                        : "primary",
                },
              ];
            })
          );
        })
        .catch(() => setEvents([]));
    };
    load();
    window.addEventListener("pharma-training-updated", load);
    return () => window.removeEventListener("pharma-training-updated", load);
  }, []);

  const days = useMemo(() => {
    if (!now) return [];
    const start = startOfWeek(startOfMonth(now));
    const end = endOfWeek(endOfMonth(now));
    return eachDayOfInterval({ start, end });
  }, [now]);

  const eventMap = new Map<string, { tone: string; count: number }>();
  for (const event of events) {
    const prev = eventMap.get(event.date);
    if (!prev) {
      eventMap.set(event.date, { tone: event.tone, count: 1 });
      continue;
    }
    const tone =
      prev.tone === "danger" || event.tone === "danger"
        ? "danger"
        : prev.tone === "primary" || event.tone === "primary"
          ? "primary"
          : "accent";
    eventMap.set(event.date, { tone, count: prev.count + 1 });
  }

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
          title={now ? format(now, "MMMM yyyy") : "Training calendar"}
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
            const inMonth = now ? isSameMonth(day, now) : false;
            const isToday = now ? isSameDay(day, now) : false;
            return (
              <div
                key={key}
                title={event ? `${event.count} session${event.count === 1 ? "" : "s"}` : undefined}
                className={cn(
                  "relative flex h-8 items-center justify-center rounded-md text-xs",
                  !inMonth && "text-muted-foreground/40",
                  isToday && "ring-1 ring-primary",
                  event && toneClass[event.tone]
                )}
              >
                {format(day, "d")}
                {event && event.count > 1 && (
                  <span className="absolute right-0.5 top-0.5 text-[9px] font-semibold leading-none">
                    {event.count}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </GlassCard>
    </MotionItem>
  );
}

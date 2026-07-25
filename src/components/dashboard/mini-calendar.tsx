"use client";

import { useMemo } from "react";
import {
  addDays,
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
import { CALENDAR_EVENTS } from "@/lib/dashboard/data";
import { cn } from "@/lib/utils";

export function MiniCalendar({ month = new Date(2026, 6, 23) }: { month?: Date }) {
  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month));
    const end = endOfWeek(endOfMonth(month));
    return eachDayOfInterval({ start, end });
  }, [month]);

  const today = new Date(2026, 6, 23);
  const eventMap = new Map(CALENDAR_EVENTS.map((e) => [e.date, e]));

  const toneClass = {
    primary: "bg-primary text-primary-foreground",
    accent: "bg-sky-500/20 text-sky-800 ring-1 ring-sky-500/40 dark:text-sky-200",
    warning: "bg-amber-500/20 text-amber-900 ring-1 ring-amber-500/40 dark:text-amber-200",
    danger: "bg-red-500/20 text-red-900 ring-1 ring-red-500/40 dark:text-red-200",
  };

  return (
    <MotionItem className="h-full">
      <GlassCard className="h-full">
        <GlassCardHeader
          title="Calendar"
          description={format(month, "MMMM yyyy")}
        />
        <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((day) => {
            const inMonth = isSameMonth(day, month);
            const event = inMonth ? eventMap.get(day.getDate()) : undefined;
            const isToday = isSameDay(day, today);
            return (
              <div
                key={day.toISOString()}
                title={event?.label}
                className={cn(
                  "flex aspect-square items-center justify-center rounded-md text-xs transition-colors",
                  !inMonth && "text-muted-foreground/40",
                  inMonth && !event && "hover:bg-white/40 dark:hover:bg-white/10",
                  isToday && !event && "bg-primary/15 font-semibold text-primary",
                  event && toneClass[event.tone]
                )}
              >
                {format(day, "d")}
              </div>
            );
          })}
        </div>
        <div className="mt-4 space-y-1.5 border-t border-border/50 pt-3">
          {CALENDAR_EVENTS.filter((e) => e.date >= 23).slice(0, 3).map((e) => (
            <div key={e.date} className="flex items-center gap-2 text-xs">
              <span className="font-medium tabular-nums text-muted-foreground">
                {format(addDays(startOfMonth(month), e.date - 1), "MMM d")}
              </span>
              <span className="truncate">{e.label}</span>
            </div>
          ))}
        </div>
      </GlassCard>
    </MotionItem>
  );
}

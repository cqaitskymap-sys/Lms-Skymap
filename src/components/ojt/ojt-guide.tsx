"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types";
import { hasPermission } from "@/lib/rbac/permissions";

const PLANNER_STEPS = [
  {
    n: "1",
    title: "Add topics",
    body: "List the practical activities / SOPs people must be trained on.",
    href: "/dashboard/ojt/topics",
  },
  {
    n: "2",
    title: "Plan months",
    body: "Mark S (select people this month) and E (train this month).",
    href: "/dashboard/ojt/planner",
  },
  {
    n: "3",
    title: "Select employees",
    body: "On the matrix, click a cell: ✓ means this person needs that OJT.",
    href: "/dashboard/ojt/matrix",
  },
  {
    n: "4",
    title: "Book a date",
    body: "Assign a trainer, date, time and shop-floor location.",
    href: "/dashboard/ojt/schedule",
  },
  {
    n: "5",
    title: "Train & score",
    body: "Trainer demonstrates, records notes, then scores competency.",
    href: "/dashboard/ojt/execution",
  },
  {
    n: "6",
    title: "Sign off",
    body: "Employee acknowledges → HOD verifies → QA approves. Done.",
    href: "/dashboard/ojt/assignments",
  },
];

const EMPLOYEE_STEPS = [
  { n: "1", title: "Get assigned", body: "Your department selects you for a practical topic.", href: "/dashboard/ojt/assignments" },
  { n: "2", title: "Attend OJT", body: "Trainer shows the activity on the job — this is not an MCQ exam.", href: "/dashboard/ojt/execution" },
  { n: "3", title: "Acknowledge", body: "Confirm you understood and can perform the activity.", href: "/dashboard/ojt/assignments" },
];

const TRAINER_STEPS = [
  { n: "1", title: "Open your queue", body: "See OJTs scheduled for you.", href: "/dashboard/ojt/execution" },
  { n: "2", title: "Demonstrate", body: "Show the practical activity and write observations.", href: "/dashboard/ojt/execution" },
  { n: "3", title: "Evaluate", body: "Score the trainee and sign off. Failures go to retraining.", href: "/dashboard/ojt/execution" },
];

export function OjtGuide({
  role,
  compact = false,
}: {
  role?: UserRole | null;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(!compact);
  const canPlan = !!role && hasPermission(role, "ojt:write");
  const steps =
    role === "employee" ? EMPLOYEE_STEPS : role === "trainer" ? TRAINER_STEPS : PLANNER_STEPS;

  return (
    <section className="rounded-xl border bg-card">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <div>
          <p className="text-sm font-semibold">How On Job Training works</p>
          <p className="text-xs text-muted-foreground">
            {canPlan
              ? "Practical competency on the shop floor — separate from classroom SOP exams."
              : "Follow these steps for your role."}
          </p>
        </div>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition", open && "rotate-180")} />
      </button>
      {open ? (
        <ol className="grid gap-2 border-t p-4 sm:grid-cols-2 xl:grid-cols-3">
          {steps.map((step) => (
            <li key={step.n}>
              <Link
                href={step.href}
                className="flex h-full gap-3 rounded-lg border bg-muted/20 p-3 transition-colors hover:border-primary/40 hover:bg-primary/5"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  {step.n}
                </span>
                <span>
                  <span className="block text-sm font-medium">{step.title}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{step.body}</span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}

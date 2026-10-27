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
    body: "Write the jobs people must learn. Example: how to dispense raw material.",
    href: "/dashboard/ojt/topics",
  },
  {
    n: "2",
    title: "Plan months",
    body: "For each topic, tick S = month you will choose people. Tick E = month you will train them.",
    href: "/dashboard/ojt/planner",
  },
  {
    n: "3",
    title: "Select people",
    body: "Click under a name. ✓ means this person needs that training. NA means not needed.",
    href: "/dashboard/ojt/matrix",
  },
  {
    n: "4",
    title: "Self study",
    body: "There is no trainer. The employee logs in, reads the SOP, then takes the exam. This does not issue a certificate.",
    href: "/dashboard/ojt/schedule",
  },
  {
    n: "5",
    title: "Exam result",
    body: "A pass closes the OJT record. A certificate is not generated for this path.",
    href: "/dashboard/ojt/assignments",
  },
  {
    n: "6",
    title: "Sign off",
    body: "Employee confirms → HOD checks → QA approves. Then it is done.",
    href: "/dashboard/ojt/assignments",
  },
];

const EMPLOYEE_STEPS = [
  {
    n: "1",
    title: "See your list",
    body: "When your department picks you for a job, it appears here.",
    href: "/dashboard/ojt/assignments",
  },
  {
    n: "2",
    title: "Read the SOP",
    body: "Log in with your employee ID and study the SOP on your own. There is no trainer.",
    href: "/dashboard/sops",
  },
  {
    n: "3",
    title: "Take the exam",
    body: "After you finish the SOP, take its exam. Passing does not issue a certificate.",
    href: "/dashboard/exams",
  },
];

const TRAINER_STEPS = [
  {
    n: "1",
    title: "Open your sessions",
    body: "See people booked with you as trainer.",
    href: "/dashboard/ojt/execution",
  },
  {
    n: "2",
    title: "Show the job",
    body: "Demonstrate the activity and write a short note.",
    href: "/dashboard/ojt/execution",
  },
  {
    n: "3",
    title: "Mark pass or fail",
    body: "Score each skill. Fail goes to retraining.",
    href: "/dashboard/ojt/execution",
  },
];

export function ojtRoleIntro(role?: UserRole | null): { title: string; body: string } {
  if (role === "employee") {
    return {
      title: "Your on-job training",
      body: "Log in with your employee ID, read the assigned SOP, then take the exam. OJT does not issue a certificate.",
    };
  }
  if (role === "trainer") {
    return {
      title: "Your OJT sessions",
      body: "Open a booked session, show the job, then mark pass or fail.",
    };
  }
  if (role === "hr") {
    return {
      title: "On-job training",
      body: "View records and reports. Department heads plan months and select people.",
    };
  }
  return {
    title: "On-job training",
    body: "Assign people, then they log in and self-study the SOP before the exam. There is no trainer and no certificate.",
  };
}

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
          <p className="text-sm font-semibold">
            {canPlan ? "How to run OJT — 6 simple steps" : "What you need to do"}
          </p>
          <p className="text-xs text-muted-foreground">
            {canPlan
              ? "New here? Start at step 1. Click a card to open that page."
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

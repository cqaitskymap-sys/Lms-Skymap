"use client";

import {
  Users,
  ShieldCheck,
  GraduationCap,
  UserCheck,
  BookOpen,
  Award,
} from "lucide-react";
import { StatCard } from "@/components/shared/stat-card";
import { lifecycleDashboardStats } from "@/lib/services/lifecycle";
import type { Employee } from "@/types";

interface LifecycleDashboardCardsProps {
  employees: Employee[];
}

export function LifecycleDashboardCards({ employees }: LifecycleDashboardCardsProps) {
  const stats = lifecycleDashboardStats(employees);

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      <StatCard title="Total employees" value={stats.total} icon={Users} />
      <StatCard title="Pending verification" value={stats.pendingVerification} icon={ShieldCheck} />
      <StatCard title="Induction in progress" value={stats.inductionInProgress} icon={GraduationCap} />
      <StatCard title="Ready for handover" value={stats.readyForHandover} icon={UserCheck} />
      <StatCard title="In training pipeline" value={stats.inTraining} icon={BookOpen} />
      <StatCard title="Qualified" value={stats.qualified} icon={Award} />
    </div>
  );
}

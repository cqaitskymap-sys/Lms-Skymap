"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { GlassCard, GlassCardHeader } from "@/components/dashboard/glass-card";
import { MotionItem } from "@/components/dashboard/motion";

const tooltipStyle = {
  borderRadius: 10,
  border: "1px solid hsl(var(--border))",
  background: "hsl(var(--card) / 0.95)",
  backdropFilter: "blur(8px)",
  fontSize: 12,
};

export function ComplianceTrendChart({
  data = [],
}: {
  data?: { month: string; rate: number }[];
}) {
  return (
    <MotionItem className="h-full">
      <GlassCard className="flex h-full flex-col">
        <GlassCardHeader
          title="Compliance trend"
          description="Organization pass rate · last 6 months"
        />
        <div className="h-56 w-full min-h-[14rem] flex-1 sm:h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id="complianceFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(199, 89%, 40%)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="hsl(199, 89%, 40%)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip contentStyle={tooltipStyle} />
              <Area
                type="monotone"
                dataKey="rate"
                name="Compliance %"
                stroke="hsl(199, 89%, 40%)"
                fill="url(#complianceFill)"
                strokeWidth={2.5}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </GlassCard>
    </MotionItem>
  );
}

export function TrainingProgressChart({
  data = [],
}: {
  data?: { name: string; completed: number; inProgress: number; overdue: number }[];
}) {
  return (
    <MotionItem className="h-full">
      <GlassCard className="flex h-full flex-col">
        <GlassCardHeader
          title="Training progress"
          description="Completed vs in-progress vs overdue"
        />
        <div className="h-56 w-full min-h-[14rem] flex-1 sm:h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="completed" name="Completed" fill="hsl(152, 61%, 40%)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="inProgress" name="In progress" fill="hsl(199, 89%, 45%)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="overdue" name="Overdue" fill="hsl(0, 72%, 55%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </GlassCard>
    </MotionItem>
  );
}

export function DepartmentComplianceChart({
  data = [],
}: {
  data?: { name: string; rate: number }[];
}) {
  return (
    <MotionItem className="h-full">
      <GlassCard className="flex h-full flex-col">
        <GlassCardHeader title="Compliance by department" description="Current pass rate" />
        <div className="h-56 w-full min-h-[14rem] flex-1 sm:h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 8, right: 16, left: 8, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="rate" name="Compliance %" fill="hsl(199, 89%, 40%)" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </GlassCard>
    </MotionItem>
  );
}

export function StatusDonutChart({
  data = [],
}: {
  data?: { name: string; value: number; color: string }[];
}) {
  return (
    <MotionItem className="h-full">
      <GlassCard className="flex h-full flex-col">
        <GlassCardHeader title="Training status mix" description="Assignment distribution" />
        <div className="h-56 w-full min-h-[14rem] flex-1 sm:h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={52}
                outerRadius={78}
                paddingAngle={3}
              >
                {data.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </GlassCard>
    </MotionItem>
  );
}

export function ComplianceRing({ value = 0 }: { value?: number }) {
  const data = [
    { name: "Compliant", value },
    { name: "Gap", value: Math.max(0, 100 - value) },
  ];
  const fill =
    value >= 90
      ? "hsl(152, 61%, 40%)"
      : value >= 60
        ? "hsl(38, 92%, 50%)"
        : "hsl(0, 72%, 51%)";
  return (
    <MotionItem>
      <GlassCard className="flex flex-col items-center justify-center text-center">
        <GlassCardHeader title="Compliance %" description="Organization score" />
        <div className="relative h-40 w-40">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                cx="50%"
                cy="50%"
                innerRadius={52}
                outerRadius={68}
                startAngle={90}
                endAngle={-270}
                strokeWidth={0}
              >
                <Cell fill={fill} />
                <Cell fill="hsl(var(--muted))" />
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold tracking-tight">{value}%</span>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Target 90%
            </span>
          </div>
        </div>
      </GlassCard>
    </MotionItem>
  );
}

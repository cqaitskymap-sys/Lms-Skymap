"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { AssessmentAnalytics } from "@/types";

interface AssessmentAnalyticsPanelProps {
  analytics: AssessmentAnalytics;
}

export function AssessmentAnalyticsPanel({ analytics }: AssessmentAnalyticsPanelProps) {
  const difficultyData = Object.entries(analytics.difficultyAccuracy).map(([name, value]) => ({
    name,
    accuracy: value,
  }));
  const typeData = Object.entries(analytics.typeAccuracy).map(([name, value]) => ({
    name: name.replace("_", " "),
    accuracy: value ?? 0,
  }));

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Attempts" value={String(analytics.attemptCount)} />
        <Stat label="Pass rate" value={`${analytics.passRate}%`} />
        <Stat label="Avg score" value={`${analytics.averagePercentage}%`} />
        <Stat
          label="Cert eligible"
          value={String(analytics.certificateEligibleCount)}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Score distribution</CardTitle>
            <CardDescription>{analytics.examTitle}</CardDescription>
          </CardHeader>
          <CardContent className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.scoreDistribution}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="bucket" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Accuracy by difficulty</CardTitle>
          </CardHeader>
          <CardContent className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={difficultyData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="accuracy" fill="hsl(var(--chart-2, 173 58% 39%))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {typeData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Accuracy by question type</CardTitle>
          </CardHeader>
          <CardContent className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={typeData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="accuracy" fill="hsl(var(--chart-3, 197 37% 24%))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {analytics.topMissedQuestionIds.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Most missed questions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {analytics.topMissedQuestionIds.map((q) => (
              <div
                key={q.questionId}
                className="flex items-start justify-between gap-3 rounded-md border px-3 py-2 text-sm"
              >
                <p className="line-clamp-2">{q.text}</p>
                <span className="shrink-0 font-mono text-destructive">{q.missRate}% miss</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        Avg time spent: {Math.round(analytics.averageTimeSeconds / 60)} min · Failures:{" "}
        {analytics.failCount}
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-2xl font-bold tracking-tight">{value}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}

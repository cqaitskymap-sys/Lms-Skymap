"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ReportFilters } from "@/lib/reports/types";
import { DEMO_DEPARTMENTS } from "@/lib/demo/data";

interface ReportFiltersBarProps {
  filters: ReportFilters;
  onChange: (next: ReportFilters) => void;
}

export function ReportFiltersBar({ filters, onChange }: ReportFiltersBarProps) {
  const set = (patch: Partial<ReportFilters>) => onChange({ ...filters, ...patch });

  return (
    <div className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
        <Label>Search</Label>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Name, SOP, status…"
            value={filters.search}
            onChange={(e) => set({ search: e.target.value })}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Department</Label>
        <Select
          value={filters.departmentId}
          onValueChange={(v) => set({ departmentId: v })}
        >
          <SelectTrigger>
            <SelectValue placeholder="All departments" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All departments</SelectItem>
            {DEMO_DEPARTMENTS.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.code} — {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>From</Label>
        <Input
          type="date"
          value={filters.dateFrom}
          onChange={(e) => set({ dateFrom: e.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label>To</Label>
        <Input
          type="date"
          value={filters.dateTo}
          onChange={(e) => set({ dateTo: e.target.value })}
        />
      </div>
    </div>
  );
}

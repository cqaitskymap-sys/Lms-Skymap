"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface FilterOption {
  label: string;
  value: string;
}

interface DataToolbarProps {
  searchPlaceholder?: string;
  onSearch: (value: string) => void;
  filters?: { key: string; label: string; options: FilterOption[]; value?: string }[];
  onFilterChange?: (key: string, value: string) => void;
  actions?: React.ReactNode;
}

export function DataToolbar({
  searchPlaceholder = "Search…",
  onSearch,
  filters,
  onFilterChange,
  actions,
}: DataToolbarProps) {
  const [search, setSearch] = useState("");

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-1 flex-wrap items-center gap-2">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder}
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onSearch(search)}
          />
        </div>
        <Button variant="secondary" size="sm" onClick={() => onSearch(search)}>
          Search
        </Button>
        {filters?.map((f) => (
          <Select
            key={f.key}
            value={f.value || "all"}
            onValueChange={(v) => onFilterChange?.(f.key, v === "all" ? "" : v)}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder={f.label} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All {f.label}</SelectItem>
              {f.options.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ))}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

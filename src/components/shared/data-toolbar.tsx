"use client";

import { useState } from "react";
import { Search, X } from "lucide-react";
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
  /** When set, the field stays in sync with the parent filter. */
  searchValue?: string;
  onSearch: (value: string) => void;
  filters?: { key: string; label: string; options: FilterOption[]; value?: string }[];
  onFilterChange?: (key: string, value: string) => void;
  actions?: React.ReactNode;
}

export function DataToolbar({
  searchPlaceholder = "Search…",
  searchValue,
  onSearch,
  filters,
  onFilterChange,
  actions,
}: DataToolbarProps) {
  const [innerSearch, setInnerSearch] = useState("");
  const search = searchValue !== undefined ? searchValue : innerSearch;

  const applySearch = (value: string) => {
    if (searchValue === undefined) setInnerSearch(value);
    onSearch(value);
  };

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-1 flex-wrap items-center gap-2">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder}
            className={search ? "pl-8 pr-8" : "pl-8"}
            value={search}
            onChange={(e) => applySearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onSearch(search)}
          />
          {search ? (
            <button
              type="button"
              aria-label="Clear search"
              className="absolute right-2 top-2.5 rounded-sm text-muted-foreground hover:text-foreground"
              onClick={() => applySearch("")}
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
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

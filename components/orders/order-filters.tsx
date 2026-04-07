"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { STATUS_LABELS } from "@/lib/constants/order-status";
import type { OrderStatus } from "@/lib/types";
import { Search, X } from "lucide-react";

const ALL_STATUSES: OrderStatus[] = [
  "submitted",
  "approved",
  "declined",
  "fulfilled",
];

interface OrderFiltersProps {
  role: "admin" | "commissary" | "store";
  stores: { id: string; name: string }[];
}

export function OrderFilters({ role, stores }: OrderFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const currentStatus = searchParams.get("status") ?? "";
  const currentFrom = searchParams.get("from") ?? "";
  const currentTo = searchParams.get("to") ?? "";
  const currentQ = searchParams.get("q") ?? "";
  const currentStoreId = searchParams.get("store_id") ?? "";

  const [searchText, setSearchText] = useState(currentQ);
  const [fromDate, setFromDate] = useState(currentFrom);
  const [toDate, setToDate] = useState(currentTo);

  const hasFilters = !!(
    currentStatus ||
    currentFrom ||
    currentTo ||
    currentQ ||
    currentStoreId
  );

  function updateParams(updates: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    }
    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `/orders?${qs}` : "/orders");
    });
  }

  function clearAll() {
    setSearchText("");
    setFromDate("");
    setToDate("");
    startTransition(() => {
      router.push("/orders");
    });
  }

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      updateParams({ q: searchText.trim() });
    }
  }

  return (
    <div
      className={`flex flex-wrap items-end gap-3 ${isPending ? "opacity-60" : ""}`}
    >
      <div className="w-[calc(50%-6px)] sm:w-auto sm:min-w-[120px]">
        <label className="text-xs font-medium text-muted-foreground mb-1 block">
          Status
        </label>
        <Select
          value={currentStatus || "all"}
          onValueChange={(v) => updateParams({ status: v === "all" ? "" : v })}
        >
          <SelectTrigger className="rounded-xl h-10">
            <SelectValue placeholder="All" />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="all">All</SelectItem>
            {ALL_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="w-[calc(50%-6px)] sm:w-auto sm:min-w-[140px]">
        <label className="text-xs font-medium text-muted-foreground mb-1 block">
          From
        </label>
        <input
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          onBlur={() => { if (fromDate !== currentFrom) updateParams({ from: fromDate }); }}
          className="flex h-10 w-full rounded-xl border border-input bg-muted/50 px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary"
        />
      </div>

      <div className="w-[calc(50%-6px)] sm:w-auto sm:min-w-[140px]">
        <label className="text-xs font-medium text-muted-foreground mb-1 block">
          To
        </label>
        <input
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          onBlur={() => { if (toDate !== currentTo) updateParams({ to: toDate }); }}
          className="flex h-10 w-full rounded-xl border border-input bg-muted/50 px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary"
        />
      </div>

      {role !== "store" && stores.length > 0 && (
        <div className="w-[calc(50%-6px)] sm:w-auto sm:min-w-[140px]">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">
            Store
          </label>
          <Select
            value={currentStoreId || "all"}
            onValueChange={(v) =>
              updateParams({ store_id: v === "all" ? "" : v })
            }
          >
            <SelectTrigger className="rounded-xl h-10">
              <SelectValue placeholder="All stores" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all">All stores</SelectItem>
              {stores.map((store) => (
                <SelectItem key={store.id} value={store.id}>
                  {store.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="w-full sm:w-auto sm:flex-1 sm:min-w-[180px]">
        <label className="text-xs font-medium text-muted-foreground mb-1 block">
          Search
        </label>
        <Input
          className="h-10"
          placeholder="Order ID or store name..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          onKeyDown={handleSearchKeyDown}
          onBlur={() => {
            if (searchText.trim() !== currentQ) {
              updateParams({ q: searchText.trim() });
            }
          }}
          leftIcon={<Search className="size-4" />}
        />
      </div>

      {hasFilters && (
        <Button variant="outline" size="sm" onClick={clearAll}>
          <X className="size-4 mr-1" />
          Clear
        </Button>
      )}
    </div>
  );
}

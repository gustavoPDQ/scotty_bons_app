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
import { Search, X } from "lucide-react";

interface InvoiceFiltersProps {
  role: "admin" | "commissary" | "store";
  stores: { id: string; name: string }[];
}

export function InvoiceFilters({ role, stores }: InvoiceFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const currentFrom = searchParams.get("from") ?? "";
  const currentTo = searchParams.get("to") ?? "";
  const currentQ = searchParams.get("q") ?? "";
  const currentStoreId = searchParams.get("store_id") ?? "";

  const [searchText, setSearchText] = useState(currentQ);

  const hasFilters = !!(currentFrom || currentTo || currentQ || currentStoreId);

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
      router.push(qs ? `/invoices?${qs}` : "/invoices");
    });
  }

  function clearAll() {
    setSearchText("");
    startTransition(() => {
      router.push("/invoices");
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
      <div className="w-[calc(50%-6px)] sm:w-auto sm:min-w-[140px]">
        <label className="text-xs font-medium text-muted-foreground mb-1 block">
          From
        </label>
        <input
          type="date"
          value={currentFrom}
          onChange={(e) => updateParams({ from: e.target.value })}
          className="flex h-10 w-full rounded-xl border border-input bg-muted/50 px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary"
        />
      </div>

      <div className="w-[calc(50%-6px)] sm:w-auto sm:min-w-[140px]">
        <label className="text-xs font-medium text-muted-foreground mb-1 block">
          To
        </label>
        <input
          type="date"
          value={currentTo}
          onChange={(e) => updateParams({ to: e.target.value })}
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
          placeholder="Invoice number..."
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

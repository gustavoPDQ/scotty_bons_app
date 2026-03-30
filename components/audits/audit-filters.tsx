"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface AuditFiltersProps {
  role: "admin" | "commissary" | "store";
  stores: { id: string; name: string }[];
}

export function AuditFilters({ role, stores }: AuditFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const currentStatus = searchParams.get("status") ?? "";
  const currentStoreId = searchParams.get("store_id") ?? "";

  const hasFilters = !!(currentStatus || currentStoreId);

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
      router.push(qs ? `/audits?${qs}` : "/audits");
    });
  }

  function clearAll() {
    startTransition(() => {
      router.push("/audits");
    });
  }

  return (
    <div
      className={`flex flex-wrap items-end gap-3 ${isPending ? "opacity-60" : ""}`}
    >
      <div className="w-[calc(50%-6px)] sm:w-auto sm:min-w-[140px] sm:max-w-[200px]">
        <label className="text-xs font-medium text-muted-foreground mb-1 block">
          Status
        </label>
        <Select
          value={currentStatus || "all"}
          onValueChange={(v) => updateParams({ status: v === "all" ? "" : v })}
        >
          <SelectTrigger className="rounded-xl h-10 w-full">
            <SelectValue placeholder="All" />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {role !== "store" && stores.length > 0 && (
        <div className="w-[calc(50%-6px)] sm:w-auto sm:min-w-[140px] sm:max-w-[200px]">
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

      {hasFilters && (
        <Button variant="outline" size="sm" onClick={clearAll}>
          <X className="size-4 mr-1" />
          Clear
        </Button>
      )}
    </div>
  );
}

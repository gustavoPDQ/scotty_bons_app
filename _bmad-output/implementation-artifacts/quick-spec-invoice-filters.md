# Quick Tech Spec: Add Filters to Invoices Page

Status: ready-for-dev

## Change Summary

Add a client-side filter bar to the invoices list page (`/invoices`), matching the pattern already used in Orders and Audits. Filters: **Store** (admin/commissary only), **From date**, **To date**, and a **Search** field (invoice number or store name). All filters use URL search params — the server-side query already supports `store_id`, `from`, and `to`.

## Motivation

The invoices page currently has no visible filter UI, even though the server page already accepts `store_id`, `from`, and `to` query params. Users with many invoices have no way to narrow results without manually editing the URL. Orders and Audits already have filter bars — invoices should be consistent.

## Scope

### In Scope
- New `InvoiceFilters` client component (follows `OrderFilters` pattern)
- Filters: Store selector (admin/commissary only), From date, To date, Search text (invoice number)
- Add `q` (search) query param support to the server page
- Pass stores list and role to the filter component
- "Clear" button to reset all filters

### Out of Scope
- Pagination (separate concern)
- Export/download invoices
- Any database or RLS changes
- Any schema/migration changes

## Changes Required

### 1. New File: `components/invoices/invoice-filters.tsx`

Client component following the `OrderFilters` pattern exactly:

```tsx
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
    <div className={`flex flex-wrap items-end gap-3 ${isPending ? "opacity-60" : ""}`}>
      <div className="w-[160px]">
        <label className="text-xs font-medium text-muted-foreground mb-1 block">
          From
        </label>
        <input
          type="date"
          value={currentFrom}
          onChange={(e) => updateParams({ from: e.target.value })}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>

      <div className="w-[160px]">
        <label className="text-xs font-medium text-muted-foreground mb-1 block">
          To
        </label>
        <input
          type="date"
          value={currentTo}
          onChange={(e) => updateParams({ to: e.target.value })}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>

      {role !== "store" && stores.length > 0 && (
        <div className="w-[180px]">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">
            Store
          </label>
          <Select
            value={currentStoreId || "all"}
            onValueChange={(v) =>
              updateParams({ store_id: v === "all" ? "" : v })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="All stores" />
            </SelectTrigger>
            <SelectContent>
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

      <div className="flex-1 min-w-[200px]">
        <label className="text-xs font-medium text-muted-foreground mb-1 block">
          Search
        </label>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Invoice number..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            onBlur={() => {
              if (searchText.trim() !== currentQ) {
                updateParams({ q: searchText.trim() });
              }
            }}
          />
        </div>
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
```

### 2. Modify: `app/(dashboard)/invoices/page.tsx`

**Add `q` search param** to the type and server query:

```diff
  searchParams: Promise<{
    store_id?: string;
    from?: string;
    to?: string;
+   q?: string;
  }>;
```

**Add `q` filter** — after the existing date filters, add text search on `invoice_number`:

```diff
  if (params.to && isValidDate(params.to)) {
    query = query.lte("created_at", params.to + "T23:59:59.999Z");
  }
+ if (params.q && params.q.length <= 100) {
+   query = query.ilike("invoice_number", `%${params.q}%`);
+ }
```

**Fetch all stores for the filter dropdown** (admin/commissary only) — add before the main query:

```diff
+ // Fetch stores for filter dropdown (admin/commissary only)
+ let allStores: { id: string; name: string }[] = [];
+ if (!isStore) {
+   const { data: storesData } = await supabase
+     .from("stores")
+     .select("id, name")
+     .order("name");
+   allStores = storesData ?? [];
+ }
```

**Render `InvoiceFilters`** — add between the `<h1>` and the invoice list:

```diff
  <h1 className="text-2xl font-bold">Invoices</h1>
+
+ <InvoiceFilters role={role} stores={allStores} />
```

**Add import** at top of file:

```diff
+ import { InvoiceFilters } from "@/components/invoices/invoice-filters";
```

## Validation Criteria

- [ ] Admin/commissary see: From, To, Store selector, Search field, Clear button
- [ ] Store users see: From, To, Search field (no Store selector)
- [ ] Date filters narrow results by `created_at`
- [ ] Store filter narrows results by `store_id`
- [ ] Search filters by invoice number (case-insensitive partial match)
- [ ] "Clear" button resets all filters and navigates to `/invoices`
- [ ] Filters persist in URL search params (shareable/bookmarkable)
- [ ] No regressions on existing invoice list or detail pages

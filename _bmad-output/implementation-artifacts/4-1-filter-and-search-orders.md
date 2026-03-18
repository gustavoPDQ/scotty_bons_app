# Story 4.1: Filter and Search Orders

Status: ready-for-dev

## Story

As an Admin, Factory User, or Store User,
I want to filter and search orders by status, date range, text, and store,
so that I can quickly find specific orders without scrolling through the entire list.

## Acceptance Criteria

1. **Given** a user navigates to the Orders page,
   **When** the page loads,
   **Then** a filter toolbar is displayed above the order list with: status dropdown, date range inputs (from/to), and a text search field.

2. **Given** a user selects a status from the status dropdown,
   **When** the filter is applied,
   **Then** only orders matching that status are displayed, and the URL search params update to reflect the filter (e.g., `?status=approved`).

3. **Given** a user enters a date range (from and/or to),
   **When** the filter is applied,
   **Then** only orders with `created_at` within the specified range are displayed, and the URL search params update accordingly (e.g., `?from=2026-03-01&to=2026-03-15`).

4. **Given** a user types text into the search field,
   **When** the search is applied (on Enter or after debounce),
   **Then** orders matching the text against order ID prefix or store name are displayed, and the URL search params update (e.g., `?q=abc123`).

5. **Given** an Admin or Factory User views the Orders page,
   **When** the filter toolbar renders,
   **Then** an additional "Store" dropdown is visible, allowing filtering by specific store name. This dropdown is NOT shown to Store Users (they only see their own store's orders via RLS).

6. **Given** one or more filters are active,
   **When** the user clicks "Clear filters",
   **Then** all filters are reset, the URL returns to `/orders`, and the full unfiltered list is shown.

7. **Given** filters are set via URL search params (e.g., user shares a link),
   **When** the page loads,
   **Then** the filter controls are pre-populated from the URL params and the filtered results are displayed.

8. **Given** filters are applied that match no orders,
   **When** the page renders,
   **Then** an empty state is shown with a message like "No orders match your filters" and a "Clear filters" button.

## Tasks / Subtasks

- [ ] Task 1 — Create `OrderFilters` Client Component (AC: #1, #2, #3, #4, #5, #6, #7)
  - [ ] Create `components/orders/order-filters.tsx` with `"use client"` directive
  - [ ] Props: `role: "admin" | "factory" | "store"`, `stores: { id: string; name: string }[]` (empty array for store role)
  - [ ] Render status dropdown using shadcn `Select` with options: All, Submitted, Under Review, Approved, Declined, Fulfilled
  - [ ] Render text search using shadcn `Input` with placeholder "Search by order ID or store..."
  - [ ] Render date range using two native `<input type="date">` styled with the Input component's classes (no calendar/date-picker dependency needed)
  - [ ] Render store dropdown (shadcn `Select`) only when `role !== "store"` — options from `stores` prop
  - [ ] Render "Clear filters" `Button` (variant `outline`, size `sm`) — visible only when any filter is active
  - [ ] Read initial values from `useSearchParams()` on mount to pre-populate controls
  - [ ] On any filter change, update URL search params via `useRouter().push()` with the new params — this triggers a server re-render with filtered data
  - [ ] Use `useTransition` to show a loading indicator while the server re-renders

- [ ] Task 2 — Update orders list page to accept and apply search params (AC: #2, #3, #4, #5, #7, #8)
  - [ ] Modify `app/(dashboard)/orders/page.tsx` to accept `searchParams` prop: `Promise<{ status?: string; from?: string; to?: string; q?: string; store_id?: string }>`
  - [ ] Parse and validate each search param (sanitize inputs, ignore invalid values)
  - [ ] Apply status filter: add `.eq("status", status)` to the Supabase query when `status` param is present and valid
  - [ ] Apply date range filter: add `.gte("created_at", from)` and/or `.lte("created_at", to + "T23:59:59")` when date params are present
  - [ ] Apply store filter (admin/factory only): add `.eq("store_id", storeId)` when `store_id` param is present
  - [ ] Apply text search: filter results in JS after fetch — match `order.id.startsWith(q)` or `storeName.toLowerCase().includes(q.toLowerCase())` (Supabase does not support OR across joined tables easily; client-side post-filter is simpler at current scale)
  - [ ] Fetch stores list for admin/factory to pass to `OrderFilters` component
  - [ ] Pass `role` and `stores` to `<OrderFilters>` component
  - [ ] Update empty state: when filters are active and no results, show "No orders match your filters" with clear button instead of the generic "No orders yet" empty state

- [ ] Task 3 — Build and lint verification (AC: all)
  - [ ] Run `npm run build` — zero errors
  - [ ] Run `npm run lint` — zero warnings/errors
  - [ ] Verify TypeScript compilation passes

## Quick Reference — Existing Code to Reuse

```
Supabase server client:  import { createClient } from "@/lib/supabase/server"
Types:                   import type { OrderStatus, OrderRow } from "@/lib/types"
Status constants:        import { STATUS_COLORS, STATUS_LABELS } from "@/lib/constants/order-status"
Price formatting:        import { formatPrice } from "@/lib/utils"
CN utility:              import { cn } from "@/lib/utils"
UI components:           Select, SelectTrigger, SelectValue, SelectContent, SelectItem from @/components/ui/select
                         Input from @/components/ui/input
                         Button from @/components/ui/button
                         Badge, Card, CardContent from @/components/ui/*
Icons:                   Search, X, Filter, Package, Plus from lucide-react
Realtime wrapper:        import { RealtimeOrderList } from "@/components/orders/realtime-order-list"
```

## Dev Notes

### OrderFilters — Client Component Architecture

The `OrderFilters` component is a `"use client"` component that manages filter state via URL search params. It does NOT manage local React state for the filter values — instead it reads from `useSearchParams()` and writes via `router.push()`. This ensures:

1. Filters are always in sync with the URL (bookmarkable, shareable)
2. The Server Component re-fetches data on every filter change (SSR pattern)
3. Browser back/forward navigation works correctly with filters

**Component pattern:**

```tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { STATUS_LABELS } from "@/lib/constants/order-status";
import type { OrderStatus } from "@/lib/types";
import { Search, X } from "lucide-react";

const ALL_STATUSES: OrderStatus[] = [
  "submitted", "under_review", "approved", "declined", "fulfilled"
];

interface OrderFiltersProps {
  role: "admin" | "factory" | "store";
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

  const hasFilters = !!(currentStatus || currentFrom || currentTo || currentQ || currentStoreId);

  function updateParams(updates: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    }
    startTransition(() => {
      router.push(`/orders?${params.toString()}`);
    });
  }

  function clearAll() {
    startTransition(() => {
      router.push("/orders");
    });
  }

  // ... render Select for status, Input for search, date inputs, store Select, clear button
}
```

**Key implementation details:**

- Use `useTransition` so the UI remains responsive while the server re-renders. Optionally show `isPending` as reduced opacity on the order list.
- For the text search input, update on Enter key press (not on every keystroke) to avoid excessive server re-renders. Alternatively, use a local state for the input value and sync to URL on blur/Enter.
- The date inputs use native `<input type="date">` — no additional dependencies needed. Style them with the same classes as the shadcn `Input` component for visual consistency.

### Updating the Orders Page Server Component

The `app/(dashboard)/orders/page.tsx` Server Component needs these changes:

**1. Accept `searchParams` prop:**

```tsx
export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    from?: string;
    to?: string;
    q?: string;
    store_id?: string;
  }>;
}) {
  const params = await searchParams;
  // ...
}
```

**2. Build the Supabase query with filters:**

```tsx
let query = supabase
  .from("orders")
  .select("id, store_id, submitted_by, status, created_at, updated_at")
  .order("created_at", { ascending: false });

// Status filter
const validStatuses: OrderStatus[] = ["submitted", "under_review", "approved", "declined", "fulfilled"];
if (params.status && validStatuses.includes(params.status as OrderStatus)) {
  query = query.eq("status", params.status);
}

// Date range filter
if (params.from) {
  query = query.gte("created_at", params.from);
}
if (params.to) {
  query = query.lte("created_at", params.to + "T23:59:59.999Z");
}

// Store filter (admin/factory only)
if (!isStore && params.store_id) {
  query = query.eq("store_id", params.store_id);
}

const { data: ordersRaw } = await query;
```

**3. Text search (post-filter in JS):**

Text search across order ID prefix and store name cannot be done cleanly in a single Supabase query (would need an OR across the orders table and a joined stores table). At current scale, post-filtering in JS is acceptable:

```tsx
let orders = ordersRaw ?? [];

if (params.q) {
  const q = params.q.toLowerCase();
  orders = orders.filter((o) =>
    o.id.toLowerCase().startsWith(q) ||
    (storeNames[o.store_id] ?? "").toLowerCase().includes(q)
  );
}
```

**Important:** The text search filter must be applied AFTER `storeNames` is populated (for admin/factory), so the query order matters. For store users, text search only matches on order ID prefix (they don't see other store names).

**4. Fetch stores for the store dropdown (admin/factory only):**

```tsx
// Fetch all stores for the filter dropdown (admin/factory only)
let allStores: { id: string; name: string }[] = [];
if (!isStore) {
  const { data: storesData } = await supabase
    .from("stores")
    .select("id, name")
    .order("name");
  allStores = storesData ?? [];
}
```

**5. Render the filter toolbar:**

```tsx
<OrderFilters role={role} stores={allStores} />
```

Place this between the page header and the order list.

### Date Input Styling

Since no Popover/Calendar components exist and `react-day-picker` / `date-fns` are not installed, use native `<input type="date">` elements. Style them to match the shadcn Input look:

```tsx
<input
  type="date"
  value={currentFrom}
  onChange={(e) => updateParams({ from: e.target.value })}
  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
/>
```

Native date inputs render a browser-native date picker (calendar popup) on click — good enough for this use case and avoids adding dependencies.

### Empty State with Active Filters

When filters are active but return no results, show a different empty state than the default "No orders yet":

```tsx
const hasActiveFilters = !!(params.status || params.from || params.to || params.q || params.store_id);

// In the render:
{orders.length === 0 && hasActiveFilters ? (
  <Card>
    <CardContent className="p-8 text-center">
      <Search className="mx-auto size-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold mb-2">No orders match your filters</h3>
      <p className="text-sm text-muted-foreground mb-4">
        Try adjusting your filters or clear them to see all orders.
      </p>
      <Button variant="outline" asChild>
        <Link href="/orders">Clear filters</Link>
      </Button>
    </CardContent>
  </Card>
) : orders.length === 0 ? (
  // existing empty state...
) : (
  // order list...
)}
```

### URL Search Params — Validation and Sanitization

Always validate search params on the server side:

- **status**: Must be one of the 5 valid `OrderStatus` values. Ignore if invalid.
- **from / to**: Must be valid ISO date strings (YYYY-MM-DD format). Use a simple regex check: `/^\d{4}-\d{2}-\d{2}$/`. Ignore if invalid.
- **q**: Trim whitespace. Limit to 100 characters. No SQL injection risk since it's used for JS filtering, not in the query.
- **store_id**: Must be a valid UUID format. Ignore if invalid. Only applied for admin/factory roles.

```tsx
const isValidDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !isNaN(Date.parse(d));
const isValidUUID = (u: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(u);

const statusFilter = validStatuses.includes(params.status as OrderStatus) ? params.status : undefined;
const fromFilter = params.from && isValidDate(params.from) ? params.from : undefined;
const toFilter = params.to && isValidDate(params.to) ? params.to : undefined;
const storeFilter = !isStore && params.store_id && isValidUUID(params.store_id) ? params.store_id : undefined;
const textFilter = params.q?.trim().slice(0, 100) || undefined;
```

### Responsive Layout for Filters

The filter toolbar should wrap on smaller screens. Use a flex-wrap layout:

```tsx
<div className="flex flex-wrap items-end gap-3">
  {/* Status select — fixed width */}
  <div className="w-[160px]">
    <label className="text-xs font-medium text-muted-foreground mb-1 block">Status</label>
    <Select ...>...</Select>
  </div>

  {/* Date from */}
  <div className="w-[160px]">
    <label className="text-xs font-medium text-muted-foreground mb-1 block">From</label>
    <input type="date" ... />
  </div>

  {/* Date to */}
  <div className="w-[160px]">
    <label className="text-xs font-medium text-muted-foreground mb-1 block">To</label>
    <input type="date" ... />
  </div>

  {/* Store select (admin/factory only) */}
  {role !== "store" && (
    <div className="w-[180px]">
      <label className="text-xs font-medium text-muted-foreground mb-1 block">Store</label>
      <Select ...>...</Select>
    </div>
  )}

  {/* Text search — grows to fill */}
  <div className="flex-1 min-w-[200px]">
    <label className="text-xs font-medium text-muted-foreground mb-1 block">Search</label>
    <div className="relative">
      <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
      <Input className="pl-9" placeholder="Order ID or store name..." ... />
    </div>
  </div>

  {/* Clear button */}
  {hasFilters && (
    <Button variant="outline" size="sm" onClick={clearAll}>
      <X className="size-4 mr-1" />
      Clear
    </Button>
  )}
</div>
```

### Interaction with RealtimeOrderList

The `RealtimeOrderList` wrapper calls `router.refresh()` on Realtime events, which re-executes the Server Component with the CURRENT URL search params. This means filters are preserved during real-time updates — no special handling needed.

### Project Structure Notes

**Files to CREATE:**

```
components/orders/order-filters.tsx  — Client Component for filter controls
```

**Files to MODIFY:**

```
app/(dashboard)/orders/page.tsx     — Accept searchParams, apply filters to query, render OrderFilters, update empty state
```

**Files NOT to touch:**
- `app/(dashboard)/orders/[order-id]/page.tsx` — detail page, unrelated
- `app/(dashboard)/orders/actions.ts` — no new actions needed (filtering is read-only)
- `app/(dashboard)/orders/new/page.tsx` — order creation, unrelated
- `components/orders/realtime-order-list.tsx` — works as-is with filtered pages
- `components/orders/new-order-cart.tsx` — unrelated
- `lib/types/index.ts` — types already sufficient
- `lib/constants/order-status.ts` — already has all needed constants
- `lib/utils.ts` — no changes needed
- `supabase/migrations/` — no new migrations needed

### Architecture Compliance

**D7 — Server Actions:** Not applicable — this story is read-only. Filters work via URL search params and server re-renders, not Server Actions.

**D8 — SSR:** The orders page remains a Server Component. Filter parameters are read from `searchParams` on the server side, and the Supabase query is built accordingly. The `OrderFilters` Client Component only manages URL navigation — it never fetches data directly.

**D5 — RLS:** All existing RLS policies remain in effect. The store filter dropdown is only shown to admin/factory roles, but even if a store user somehow injects a `store_id` param, RLS will still restrict results to their own store. Defense in depth.

**D10 — State Management:** No client-side state for order data. Filters live in URL search params. The only client state is the text input value (synced to URL on Enter/blur).

**Anti-Patterns — NEVER DO:**
- `supabase.from('orders').select('*')` — always select specific columns
- Use `date-fns` — not installed, use `Intl.DateTimeFormat("en-CA", ...)` or native date inputs
- Install `react-day-picker` or any calendar library — use native `<input type="date">`
- Create a REST API route for filtered queries — SSR handles this directly
- Store filter state in React state that's disconnected from URL — always use search params as source of truth
- Apply store filter for store role users — RLS already handles this; the store dropdown should not render for store users
- Use `router.replace()` for filter changes — use `router.push()` so browser history works correctly
- `new Date().toLocaleDateString()` — use `Intl.DateTimeFormat("en-CA", ...)`
- Use `.ilike()` or `.textSearch()` for order ID search — simple JS post-filter is cleaner at current scale

### Testing Requirements

- Run `npm run build` — zero errors
- Run `npm run lint` — zero warnings/errors
- Manual verification: Filter toolbar renders with status dropdown, date inputs, and search field
- Manual verification: Admin/factory see the store dropdown; store users do not
- Manual verification: Selecting a status filters the list and updates the URL
- Manual verification: Setting a date range filters orders to that range
- Manual verification: Typing a search term and pressing Enter filters by order ID prefix or store name
- Manual verification: Clicking "Clear filters" resets all filters and returns to `/orders`
- Manual verification: Loading a URL with filter params (e.g., `/orders?status=approved`) pre-populates the controls and shows filtered results
- Manual verification: Empty state shows "No orders match your filters" when filters return no results
- Manual verification: Realtime updates still work with active filters (admin/factory)
- Manual verification: Browser back/forward navigates between filter states correctly

### Previous Story Intelligence

**Key learnings from Stories 3-1 through 3-5 that MUST inform this implementation:**

1. **`date-fns` is NOT installed** — All date handling uses `Intl.DateTimeFormat("en-CA", ...)`. For date filter inputs, use native `<input type="date">` which produces `YYYY-MM-DD` strings natively.

2. **`formatPrice` exists in `lib/utils.ts`** — Use for all price display. Do NOT create a new formatter.

3. **Status constants in `lib/constants/order-status.ts`** — `STATUS_LABELS` provides the display names for the status dropdown options. Import from there.

4. **RLS is the enforcement layer** — Even though the store dropdown is hidden from store users in the UI, RLS will still enforce store-level isolation. No application-layer checks needed for data access.

5. **Next.js 16 async searchParams** — Search params must be awaited: `const params = await searchParams;` (same pattern as `app/(dashboard)/users/page.tsx`).

6. **UI Language is English** — All labels ("Status", "From", "To", "Search", "Store", "Clear filters", "No orders match your filters") must be in English.

7. **shadcn Select component uses Radix UI** — Already installed (`radix-ui` v1.4.3). The Select component is at `@/components/ui/select`.

8. **Store name query pattern** — The current page already fetches store names for admin/factory by collecting unique `store_id` values. For the store dropdown, fetch ALL stores separately (not just those with existing orders).

9. **`searchParams` pattern established** — `app/(dashboard)/users/page.tsx` already uses `searchParams: Promise<{ page?: string }>` — follow the same pattern.

10. **Soft-deleted orders excluded by RLS** — The `deleted_at IS NULL` condition is enforced by RLS policies, so no additional filter needed in application code.

### Git Intelligence

**Recent commits:**
- `6eaa5c3` feat: stories 3-4 and 3-5 — admin order actions and soft delete
- `35b6652` feat: story 3-2 updates, story 3-3 artifacts, and order page enhancements

**Recommended commit message:**
- `feat: add order filtering and search with URL params (story 4-1)`

### References

- [Source: orders/page.tsx] Current orders list page — to be modified with filter support
- [Source: users/page.tsx] Existing searchParams pattern for Server Components
- [Source: lib/constants/order-status.ts] STATUS_LABELS for dropdown options
- [Source: lib/types/index.ts] OrderStatus type for validation
- [Source: components/ui/select.tsx] shadcn Select component (Radix-based)
- [Source: components/ui/input.tsx] shadcn Input component
- [Source: components/orders/realtime-order-list.tsx] RealtimeOrderList — compatible with filtered pages
- [Source: memory/feedback_ui_language.md] UI must be in English

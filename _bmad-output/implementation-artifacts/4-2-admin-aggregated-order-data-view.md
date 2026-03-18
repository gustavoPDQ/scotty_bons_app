# Story 4.2: Admin — Aggregated Order Data View

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an Admin,
I want to see an aggregated overview of order data on the Dashboard page,
so that I can quickly assess the state of supply operations across all stores without drilling into individual orders.

## Acceptance Criteria

1. **Given** an Admin navigates to the Dashboard (`/dashboard`),
   **When** the page loads,
   **Then** the "Coming soon" placeholder is replaced with summary cards showing: Total Orders, Pending Orders (submitted + under_review), Approved Orders, and Total Revenue (sum of approved + fulfilled order totals).

2. **Given** an Admin views the Dashboard,
   **When** orders exist in various statuses,
   **Then** an "Orders by Status" section shows the count for each status (submitted, under_review, approved, declined, fulfilled) with the corresponding status label and color.

3. **Given** an Admin views the Dashboard,
   **When** orders exist across multiple stores,
   **Then** an "Orders by Store" section shows each store name with its order count and order total.

4. **Given** an Admin views the Dashboard,
   **When** recent orders exist,
   **Then** a "Recent Orders" section shows the last 5 orders with order ID (truncated), store name, status badge, total, and submission date — each linking to the order detail page.

5. **Given** an Admin views the Dashboard,
   **When** no orders exist at all,
   **Then** the summary cards show zeros/`$0.00` and the "Recent Orders" section shows an empty state message.

6. **Given** a non-admin user,
   **When** they attempt to access `/dashboard`,
   **Then** they are redirected away (existing middleware/nav behavior — dashboard is admin-only per `nav-items.ts`).

## Tasks / Subtasks

- [ ] Task 1 — Replace dashboard placeholder with server-rendered aggregated data (AC: #1, #2, #3, #4, #5)
  - [ ] Rewrite `app/(dashboard)/dashboard/page.tsx` as an async Server Component
  - [ ] Authenticate user and verify admin role; redirect to `/login` if unauthenticated or to `/orders` if non-admin
  - [ ] Fetch all orders: `supabase.from("orders").select("id, store_id, status, created_at")`
  - [ ] Fetch all order items for totals: `supabase.from("order_items").select("order_id, unit_price, quantity")`
  - [ ] Fetch all stores for name mapping: `supabase.from("stores").select("id, name")`
  - [ ] Compute aggregates in the Server Component (no separate API routes):
    - Total orders count
    - Pending orders count (status `submitted` or `under_review`)
    - Approved orders count (status `approved`)
    - Total revenue (sum of item totals for orders with status `approved` or `fulfilled`)
    - Per-status counts
    - Per-store counts and totals
  - [ ] Render 4 summary cards at top using shadcn `Card` components
  - [ ] Render "Orders by Status" section as a grid of stat items with status colors
  - [ ] Render "Orders by Store" section as a list/table showing store name, order count, and total
  - [ ] Render "Recent Orders" section with last 5 orders, each as a link to `/orders/[id]`
  - [ ] Handle empty state: zero counts and `$0.00` when no orders exist

- [ ] Task 2 — Build and lint verification (AC: all)
  - [ ] Run `npm run build` — zero errors
  - [ ] Run `npm run lint` — zero warnings/errors
  - [ ] Verify TypeScript compilation passes

## Quick Reference — Existing Code to Reuse

```
Supabase server client:  import { createClient } from "@/lib/supabase/server"
Types:                   import type { OrderStatus } from "@/lib/types"
Status constants:        import { STATUS_COLORS, STATUS_LABELS } from "@/lib/constants/order-status"
Price formatting:        import { formatPrice } from "@/lib/utils"
CN utility:              import { cn } from "@/lib/utils"
UI components:           Card, CardContent, CardHeader, CardTitle from @/components/ui/card
                         Badge from @/components/ui/badge
Icons:                   Package, ShoppingCart, Clock, CheckCircle, DollarSign, TrendingUp from lucide-react
Nav items:               Dashboard is admin-only per lib/nav-items.ts
```

## Dev Notes

### This is a Pure Server Component — No Client Components Needed

The dashboard shows static aggregated data computed at request time. There is no interactivity that requires `"use client"`. Do NOT add client components, state, or effects. The page is a straightforward async Server Component.

### Implementation Guidance

**File to modify:** `app/(dashboard)/dashboard/page.tsx` — this is the ONLY file that changes.

**Authentication and authorization pattern** (same as orders page):
```typescript
const supabase = await createClient();
const { data: { user } } = await supabase.auth.getUser();
if (!user) redirect("/login");

const { data: profile } = await supabase
  .from("profiles")
  .select("role, store_id")
  .eq("user_id", user.id)
  .single();

if (!profile || profile.role !== "admin") redirect("/orders");
```

**Data fetching strategy — three parallel queries:**
```typescript
const [ordersResult, itemsResult, storesResult] = await Promise.all([
  supabase.from("orders").select("id, store_id, status, created_at"),
  supabase.from("order_items").select("order_id, unit_price, quantity"),
  supabase.from("stores").select("id, name"),
]);
```

RLS ensures admin sees all non-deleted orders (soft-deleted orders are excluded by the `orders_select_admin` policy which includes `deleted_at IS NULL`).

**Aggregate computation — all in-memory, no custom SQL needed:**

1. **Summary cards:**
   - Total Orders = `orders.length`
   - Pending Orders = orders where `status === "submitted" || status === "under_review"`
   - Approved Orders = orders where `status === "approved"`
   - Total Revenue = sum of `unit_price * quantity` for items belonging to orders with status `approved` or `fulfilled`

2. **Orders by Status:** Group orders by status, count each group. Iterate `STATUS_LABELS` keys to ensure all statuses appear (even with 0 count).

3. **Orders by Store:** Group orders by `store_id`, count and sum totals per store. Map `store_id` to store name via the stores query.

4. **Recent Orders:** Sort orders by `created_at` descending (already default from Supabase), take first 5. Include store name and total from the computed maps.

**Building the order totals map:**
```typescript
const orderTotals: Record<string, number> = {};
for (const item of items) {
  orderTotals[item.order_id] = (orderTotals[item.order_id] ?? 0)
    + Number(item.unit_price) * item.quantity;
}
```

**Summary cards layout — responsive grid:**
```tsx
<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
  <Card>
    <CardHeader className="flex flex-row items-center justify-between pb-2">
      <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
      <Package className="size-4 text-muted-foreground" />
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{totalOrders}</div>
    </CardContent>
  </Card>
  {/* ... Pending Orders, Approved Orders, Total Revenue cards */}
</div>
```

**Date formatting — no date-fns:**
```typescript
new Intl.DateTimeFormat("en-CA", { dateStyle: "medium" }).format(new Date(order.created_at))
```

**Price formatting:**
```typescript
import { formatPrice } from "@/lib/utils";
// formatPrice(12345.67) → "CA$12,345.67"
```

### Anti-Patterns — NEVER DO

- `"use client"` — this page has no interactivity requiring client components
- `supabase.from("orders").select("*")` — always select specific columns
- `new Date().toLocaleDateString()` — use `Intl.DateTimeFormat("en-CA", ...)`
- Create a REST API route for fetching dashboard data — SSR does this directly
- Use `service_role` key — authenticated client with RLS only
- Create new database views or functions — aggregate in application code
- Install `date-fns` or any new packages — use built-in `Intl` APIs
- Use `Math.round` or manual rounding for currency — use `formatPrice()` from `lib/utils.ts`
- Hard-code status strings — import `STATUS_LABELS` and `STATUS_COLORS` from `lib/constants/order-status.ts`
- Put UI text in Portuguese — all labels must be in English

### Performance Notes

At current scale (low hundreds of orders), fetching all orders and items and computing aggregates in-memory is perfectly acceptable. If scale grows significantly, this can be replaced with Supabase RPC (database-level aggregation) later without changing the UI.

### Testing Requirements

- Run `npm run build` — zero errors
- Run `npm run lint` — zero warnings/errors
- Manual verification: Admin sees 4 summary cards with correct counts and revenue
- Manual verification: "Orders by Status" shows counts for all 5 statuses (including 0 for unused statuses)
- Manual verification: "Orders by Store" shows each store with order count and total
- Manual verification: "Recent Orders" shows last 5 orders with correct store name, status badge, total, and date
- Manual verification: Clicking a recent order navigates to `/orders/[order-id]`
- Manual verification: Dashboard shows zeros and `$0.00` when no orders exist
- Manual verification: Non-admin users cannot access `/dashboard` (redirected)

### Project Structure Notes

**Files to MODIFY:**

```
app/(dashboard)/dashboard/page.tsx — Replace placeholder with aggregated data dashboard
```

**Files NOT to touch:**
- `lib/nav-items.ts` — dashboard already admin-only
- `lib/types/index.ts` — existing types are sufficient
- `lib/constants/order-status.ts` — already has all status constants
- `lib/utils.ts` — `formatPrice` already exists
- `supabase/migrations/*` — no new tables, columns, or functions needed
- `components/orders/*` — this is the dashboard, not the orders page
- `middleware.ts` / `proxy.ts` — no routing changes needed

**No new packages to install.** Everything needed is already in the project.

### References

- [Source: epics.md — Epic 4, Story 4.2] Admin aggregated order data view
- [Source: architecture.md — D5] RLS: admin sees all non-deleted orders
- [Source: Story 3-3 — Dev Notes] Parallel query pattern with Promise.all, store name mapping
- [Source: Story 3-2 — Dev Notes] Order item aggregation pattern, formatPrice usage
- [Source: memory/feedback_ui_language.md] UI must be in English

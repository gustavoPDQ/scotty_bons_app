# Story 5.3: View Invoice History

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an Admin, Store, or Factory user,
I want to view a list of invoices from the navigation sidebar,
so that I can quickly find and review past invoices without navigating through individual orders.

## Acceptance Criteria

1. **Given** any authenticated user (Admin, Store, or Factory) views the sidebar navigation,
   **When** the sidebar renders,
   **Then** an "Invoices" menu item with a FileText icon is visible, linking to `/invoices`.

2. **Given** an Admin navigates to the Invoices page,
   **When** the page loads,
   **Then** all invoices across all stores are listed, sorted by creation date descending.

3. **Given** a Store user navigates to the Invoices page,
   **When** the page loads,
   **Then** only invoices belonging to their store are listed (RLS enforced), sorted by creation date descending.

4. **Given** a Factory user navigates to the Invoices page,
   **When** the page loads,
   **Then** all invoices across all stores are listed (read-only, RLS enforced), sorted by creation date descending.

5. **Given** any user views the invoice list,
   **When** invoices are displayed,
   **Then** each row shows: Invoice # (`invoice_number`), Store name, Order Date (from the linked order's `created_at`), Grand Total (formatted with `formatPrice`), and Invoice Date (`created_at`).

6. **Given** a user clicks on an invoice in the list,
   **When** the click is registered,
   **Then** the user navigates to the invoice detail page at `/invoices/[invoice-id]` (created in Story 5-2).

7. **Given** the invoice list is empty,
   **When** the page renders,
   **Then** an informative empty state is displayed ("No invoices yet").

8. **Given** an Admin views the Invoices page,
   **When** the page provides optional filters,
   **Then** the Admin can filter invoices by date range and/or by store.

## Tasks / Subtasks

- [ ] Task 1 -- Add "Invoices" to sidebar navigation (AC: #1)
  - [ ] Update `lib/nav-items.ts`: add `{ href: "/invoices", label: "Invoices", icon: FileText, roles: ["admin", "factory", "store"] }`
  - [ ] Import `FileText` from `lucide-react` in `lib/nav-items.ts`
  - [ ] Verify the new nav item appears for all three roles in the sidebar

- [ ] Task 2 -- Create Invoices list page (AC: #2, #3, #4, #5, #6, #7)
  - [ ] Create `app/(dashboard)/invoices/page.tsx` as a Server Component
  - [ ] Authenticate user and fetch profile (role, store_id) -- redirect to `/login` if missing
  - [ ] Query `invoices` table: `select("id, invoice_number, order_id, store_id, grand_total, created_at")` ordered by `created_at` descending
  - [ ] RLS handles filtering: admin/factory see all, store sees own `store_id` only
  - [ ] Fetch store names for admin/factory roles (collect unique `store_id` values, query `stores` table) -- same pattern as orders page
  - [ ] For store role, fetch the user's own store name once
  - [ ] Fetch linked order dates: collect unique `order_id` values, query `orders` table for `id, created_at`
  - [ ] Render each invoice as a clickable row/card linking to `/invoices/${invoice.id}`
  - [ ] Display: Invoice #, Store name, Order Date, Grand Total (`formatPrice`), Invoice Date
  - [ ] Render empty state when no invoices exist

- [ ] Task 3 -- Optional: Admin filters (AC: #8)
  - [ ] Add date range filter (start date, end date) using native `<input type="date">` or shadcn DatePicker if available
  - [ ] Add store filter dropdown for admin role (populated from `stores` table)
  - [ ] Filters use URL search params (`?store=<id>&from=<date>&to=<date>`) so they work with Server Components
  - [ ] Apply filters to the Supabase query: `.gte("created_at", from)`, `.lte("created_at", to)`, `.eq("store_id", storeFilter)`

- [ ] Task 4 -- Build and lint verification (AC: all)
  - [ ] Run `npm run build` -- zero errors
  - [ ] Run `npm run lint` -- zero warnings/errors
  - [ ] Verify TypeScript compilation passes

## Quick Reference -- Existing Code to Reuse

```
Supabase server client:  import { createClient } from "@/lib/supabase/server"
Types:                   import type { OrderStatus } from "@/lib/types"
Price formatting:        import { formatPrice } from "@/lib/utils"
CN utility:              import { cn } from "@/lib/utils"
UI components:           Card, CardContent, Badge from @/components/ui/*
Icons:                   FileText from lucide-react
Nav items:               lib/nav-items.ts
Orders list pattern:     app/(dashboard)/orders/page.tsx (reference for layout, store name fetching, empty state)
Invoice detail page:     app/(dashboard)/invoices/[invoice-id]/page.tsx (created in Story 5-2, link target)
```

## Dev Notes

### This Story Depends on Story 5-2

Story 5-2 creates the `invoices` and `invoice_items` tables, the invoice detail page at `/invoices/[invoice-id]`, and the RLS policies for invoice access. This story assumes those artifacts exist.

**Expected tables from Story 5-2:**
- `invoices`: `id`, `invoice_number`, `order_id`, `store_id`, `subtotal`, `tax_rate`, `tax_amount`, `grand_total`, `company_details` (JSONB snapshot), `created_at`
- `invoice_items`: `id`, `invoice_id`, `product_name`, `unit_of_measure`, `unit_price`, `quantity`, `line_total`

**Expected RLS from Story 5-2:**
- Admin: SELECT on all invoices
- Factory: SELECT on all invoices (read-only)
- Store: SELECT on invoices WHERE `store_id = auth_store_id()`

### Page Structure -- Follow Orders List Pattern

The invoices list page follows the same Server Component pattern as `app/(dashboard)/orders/page.tsx`:

```typescript
// app/(dashboard)/invoices/page.tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { formatPrice } from "@/lib/utils";

export default async function InvoicesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, store_id")
    .eq("user_id", user.id)
    .single();
  if (!profile) redirect("/login");

  const role = profile.role;

  // RLS handles store_id filtering for store users
  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, invoice_number, order_id, store_id, grand_total, created_at")
    .order("created_at", { ascending: false });

  // ... fetch store names for admin/factory, fetch order dates
}
```

### Store Name Fetching Pattern

Reuse the exact pattern from the orders page:

```typescript
const storeNames: Record<string, string> = {};
if (role !== "store" && invoices && invoices.length > 0) {
  const storeIds = [...new Set(invoices.map((inv) => inv.store_id))];
  const { data: stores } = await supabase
    .from("stores")
    .select("id, name")
    .in("id", storeIds);
  if (stores) {
    for (const store of stores) {
      storeNames[store.id] = store.name;
    }
  }
}
```

For store users, fetch their own store name:

```typescript
if (role === "store" && profile.store_id) {
  const { data: store } = await supabase
    .from("stores")
    .select("name")
    .eq("id", profile.store_id)
    .single();
  if (store) storeNames[profile.store_id] = store.name;
}
```

### Order Date Fetching

Invoices reference an `order_id`. To display the original order date:

```typescript
const orderDates: Record<string, string> = {};
if (invoices && invoices.length > 0) {
  const orderIds = [...new Set(invoices.map((inv) => inv.order_id))];
  const { data: orders } = await supabase
    .from("orders")
    .select("id, created_at")
    .in("id", orderIds);
  if (orders) {
    for (const order of orders) {
      orderDates[order.id] = order.created_at;
    }
  }
}
```

### Nav Items Update

Add `FileText` import and the invoices entry to `lib/nav-items.ts`:

```typescript
import { FileText, LayoutDashboard, Package, Settings, ShoppingBasket, Users } from "lucide-react";

// Add after the Orders entry:
{ href: "/invoices", label: "Invoices", icon: FileText, roles: ["admin", "factory", "store"] },
```

### Date Formatting

Use the established project pattern -- no `date-fns`:

```typescript
new Intl.DateTimeFormat("en-CA", { dateStyle: "medium" }).format(new Date(invoice.created_at))
```

### Optional Filters (Task 3)

Filters use URL search params so they work with Server Components (no client state needed):

```typescript
// In the page component, read searchParams
export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ store?: string; from?: string; to?: string }>;
}) {
  const params = await searchParams;
  // Build query with optional filters
  let query = supabase
    .from("invoices")
    .select("id, invoice_number, order_id, store_id, grand_total, created_at")
    .order("created_at", { ascending: false });

  if (params.store) query = query.eq("store_id", params.store);
  if (params.from) query = query.gte("created_at", params.from);
  if (params.to) query = query.lte("created_at", params.to + "T23:59:59");

  const { data: invoices } = await query;
}
```

The filter UI can be a simple form that submits via GET (native HTML form behavior), or use `useRouter().push()` with updated search params from a client component.

### Invoice List Row Layout

Each invoice row should display in a consistent format:

```
| INV-2026-0001 | Store Alpha | Mar 15, 2026 | $1,234.56 | Mar 16, 2026 |
| Invoice #     | Store       | Order Date   | Total     | Invoice Date |
```

Use the same bordered list style as the orders page (`.rounded-md .border .divide-y` with hover state).

### Architecture Compliance

**D5 -- RLS:** RLS is the enforcement layer. Admin/factory see all invoices, store sees own. No application-layer filtering needed beyond what RLS provides.

**D7 -- Server Components:** The invoices list page is a Server Component. No client-side data fetching. Filters use URL search params.

**Anti-Patterns -- NEVER DO:**
- `supabase.from('invoices').select('*')` -- always select specific columns
- Application-layer role-based filtering (`.eq("store_id", ...)`) -- RLS handles this
- `new Date().toLocaleDateString()` -- use `Intl.DateTimeFormat("en-CA", ...)`
- Client-side data fetching for the list -- use Server Components
- Hardcode store names -- always fetch from the `stores` table
- Use `service_role` key -- authenticated client with RLS only

### Project Structure Notes

**Files to CREATE:**

```
app/(dashboard)/invoices/page.tsx  -- Invoice list page (Server Component)
```

**Files to MODIFY:**

```
lib/nav-items.ts  -- Add Invoices nav entry with FileText icon
```

**Files NOT to touch:**
- `app/(dashboard)/invoices/[invoice-id]/page.tsx` -- created in Story 5-2, do not modify
- `lib/types/index.ts` -- invoice types should already exist from Story 5-2
- `supabase/migrations/*` -- no new migrations; tables and RLS from Story 5-2
- `lib/supabase/server.ts` -- no changes needed
- `middleware.ts` -- no changes needed

### Library & Framework Requirements

**No new packages needed.** All dependencies (shadcn/ui Card, lucide-react FileText, Next.js navigation) are already installed.

### Testing Requirements

- Run `npm run build` -- zero errors
- Run `npm run lint` -- zero warnings/errors
- Manual: Admin sees "Invoices" in sidebar navigation
- Manual: Store user sees "Invoices" in sidebar navigation
- Manual: Factory user sees "Invoices" in sidebar navigation
- Manual: Admin views invoices page -- sees all invoices from all stores with store names
- Manual: Store user views invoices page -- sees only their store's invoices
- Manual: Factory user views invoices page -- sees all invoices (read-only)
- Manual: Each invoice row shows Invoice #, Store name, Order Date, Grand Total, Invoice Date
- Manual: Clicking an invoice navigates to `/invoices/[invoice-id]` detail page
- Manual: Empty state displays correctly when no invoices exist
- Manual: (Optional) Admin can filter by date range and store
- Manual: Grand Total displays correctly formatted as CAD currency (e.g., "$1,234.56")
- Manual: Dates display in "en-CA" medium format (e.g., "Mar 15, 2026")

### Previous Story Intelligence (from Stories 3-1 through 5-2)

1. **`date-fns` is NOT installed** -- use `Intl.DateTimeFormat("en-CA", ...)` for all date formatting.
2. **`formatPrice` exists in `lib/utils.ts`** -- use for all currency display. Format: CAD with `Intl.NumberFormat`.
3. **RLS is the enforcement layer** -- no application-layer role-based data filtering.
4. **Next.js 16 async params** -- `searchParams` must be awaited: `const params = await searchParams;`
5. **Store name query pattern** -- collect unique IDs, batch query. Established in Story 3-2 and orders page.
6. **UI Language is English** -- all labels, buttons, empty states must be in English.
7. **Server Component pattern** -- authenticate, fetch profile, query data, render. No `"use client"` needed for the list page.
8. **Nav items pattern** -- single array in `lib/nav-items.ts` with role-based filtering.

### Git Intelligence

**Recent commits:**
- `6eaa5c3` feat: stories 3-4 and 3-5 -- admin order actions and soft delete

**Recommended commit message:**
`feat: add invoice history list page with navigation (story 5-3)`

### References

- [Source: sprint-status.yaml] Story 5-3: `view-invoice-history` (Epic 5: Financial Management)
- [Source: Story 5-2] `invoices` and `invoice_items` tables, RLS policies, invoice detail page
- [Source: Story 3-2 / 3-3] Orders list page pattern, store name fetching, empty state
- [Source: lib/nav-items.ts] Navigation sidebar items with role-based visibility
- [Source: lib/utils.ts] `formatPrice()` -- CAD currency formatting
- [Source: app/(dashboard)/orders/page.tsx] Reference implementation for list page layout
- [Source: memory/feedback_ui_language.md] UI must be in English

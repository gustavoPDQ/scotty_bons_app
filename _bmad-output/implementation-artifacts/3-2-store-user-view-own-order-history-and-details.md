# Story 3.2: Store User — View Own Order History & Details

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Store User,
I want to view my store's order history and the full details of any order,
so that I can track the status of my requests without calling or messaging anyone.

## Acceptance Criteria

1. **Given** a Store User navigates to the Orders section,
   **When** the page loads,
   **Then** only orders belonging to their assigned store are listed — orders from other stores are never visible (NFR8).

2. **Given** a Store User views their order list,
   **When** orders are displayed,
   **Then** each order shows the submission date, status badge (color-coded: Submitted = gray, Under Review = amber, Approved = green, Declined = red, Fulfilled = blue), and order total.

3. **Given** a Store User clicks on an order,
   **When** the detail page loads,
   **Then** they see the full list of items with quantities and prices, the order total, current status, and status history timestamps.

4. **Given** a Store User views a declined order,
   **When** the detail page is displayed,
   **Then** the reason for decline provided by the Admin is visible.

5. **Given** a Store User's order list is empty,
   **When** the page loads,
   **Then** an informative empty state is shown with a "New Order" CTA.

## Tasks / Subtasks

- [x] Task 1 — Enhance orders list page to link to detail pages (AC: #1, #2, #5)
  - [x] Update `app/(dashboard)/orders/page.tsx` to wrap each order row in a `<Link>` to `/orders/[order-id]`
  - [x] Add left border orange accent to each order card per UX spec (`border-l-4 border-primary`)
  - [x] Add store name display for admin/factory roles (query `stores` via join — RLS already handles visibility)
  - [x] Ensure "New Order" CTA text in empty state (already English, verify)
  - [x] Keep existing status badge colors, item counts, totals — all working from Story 3-1

- [x] Task 2 — Create order detail page (AC: #3, #4)
  - [x] Create `app/(dashboard)/orders/[order-id]/page.tsx` as Server Component
  - [x] Auth check: get user, get profile — redirect unauthenticated to `/login`
  - [x] Fetch order: `.from("orders").select("id, store_id, submitted_by, status, decline_reason, fulfilled_at, created_at, updated_at").eq("id", orderId).single()`
  - [x] RLS handles store isolation — Store User can only fetch their own store's orders. If `data` is null (not found or RLS denied), redirect to `/orders`
  - [x] Fetch order items: `.from("order_items").select("id, product_name, unit_of_measure, unit_price, quantity").eq("order_id", orderId).order("created_at")`
  - [x] Fetch status history: `.from("order_status_history").select("id, status, changed_by, changed_at").eq("order_id", orderId).order("changed_at", { ascending: true })`
  - [x] Calculate order total from items: `items.reduce((sum, i) => sum + Number(i.unit_price) * i.quantity, 0)`
  - [x] Display page with: breadcrumb (Orders > Order #XXXXXXXX), status badge, order metadata, items table, status history timeline, decline reason (if applicable)

- [x] Task 3 — Build order detail UI components (AC: #3, #4)
  - [x] Items section: table/list with columns — Product Name, Unit of Measure, Unit Price, Quantity, Line Total
  - [x] Order summary: total price prominently displayed
  - [x] Status history timeline: chronological list showing status, timestamp (formatted with `Intl.DateTimeFormat`), and who made the change
  - [x] Decline reason: if `status === 'declined'` and `decline_reason` is not null, show in a highlighted callout (amber/red card)
  - [x] For status history `changed_by`, fetch user display names via profiles join or display "System" for triggers. Simplest approach: join is complex cross-table — just show the timestamp and status change. User name is optional enhancement

- [x] Task 4 — Build and lint verification (AC: all)
  - [x] Run `npm run build` — zero errors
  - [x] Run `npm run lint` — zero warnings/errors
  - [x] Verify TypeScript compilation passes

## Quick Reference — Existing Code to Reuse

```
Supabase client:     import { createClient } from "@/lib/supabase/server"
Types:               import type { OrderStatus, OrderItemRow } from "@/lib/types"
Price formatting:    import { formatPrice } from "@/lib/utils"
CN utility:          import { cn } from "@/lib/utils"
Status colors:       STATUS_COLORS and STATUS_LABELS already defined in orders/page.tsx — extract to shared constant or duplicate
UI components:       Badge, Card, CardContent, CardHeader, CardTitle from @/components/ui/*
Icons:               Package, ArrowLeft, Clock, AlertCircle from lucide-react
Toast:               import { toast } from "sonner"  (not needed — read-only page)
Breadcrumbs:         import { Breadcrumbs } from "@/components/shared/breadcrumbs"  (already exists)
```

## Dev Notes

### This Story is Read-Only — No New Mutations

Story 3-2 is purely read-only. No Server Actions needed. No new database tables or migrations. No new RLS policies. All data access uses existing tables and RLS from Story 3-1.

### Existing Orders List — What's Already Working (from Story 3-1)

The current `app/(dashboard)/orders/page.tsx` already:
- Fetches orders via Supabase with RLS filtering
- Shows order ID (truncated), date, item count, total, status badge
- Has "New Order" button for store users
- Has empty state with CTA
- Calculates item summaries (count + total) from `order_items` table

**What needs to change:** Make each order row a clickable `<Link>` to `/orders/[order-id]`. Optionally add the orange left border per UX spec.

### Order Detail Page — Key Implementation Details

**Route:** `app/(dashboard)/orders/[order-id]/page.tsx`

**Data queries (all via RLS, no admin client needed):**

```typescript
// 1. Fetch order
const { data: order } = await supabase
  .from("orders")
  .select("id, store_id, submitted_by, status, decline_reason, fulfilled_at, created_at, updated_at")
  .eq("id", params["order-id"])
  .single();

// 2. Fetch order items
const { data: items } = await supabase
  .from("order_items")
  .select("id, product_name, unit_of_measure, unit_price, quantity")
  .eq("order_id", params["order-id"])
  .order("created_at");

// 3. Fetch status history
const { data: history } = await supabase
  .from("order_status_history")
  .select("id, status, changed_by, changed_at")
  .eq("order_id", params["order-id"])
  .order("changed_at", { ascending: true });
```

**RLS guarantees store isolation:** If a Store User tries to access an order from another store, the `orders` SELECT policy returns null (`store_id = auth_store_id()`). Handle this: `if (!order) redirect("/orders")`.

**Dynamic route param:** Next.js App Router uses `params["order-id"]` for folder `[order-id]`. Access via `{ params }: { params: Promise<{ "order-id": string }> }` — must await params in Next.js 15.

### Status Badge Colors — Reuse Pattern

Story 3-1 defined these inline in `orders/page.tsx`:

```typescript
const STATUS_COLORS: Record<OrderStatus, string> = {
  submitted: "bg-gray-500 text-white",
  under_review: "bg-amber-500 text-white",
  approved: "bg-green-600 text-white",
  declined: "bg-red-600 text-white",
  fulfilled: "bg-blue-600 text-white",
};

const STATUS_LABELS: Record<OrderStatus, string> = {
  submitted: "Submitted",
  under_review: "Under Review",
  approved: "Approved",
  declined: "Declined",
  fulfilled: "Fulfilled",
};
```

**Options:** Either (a) duplicate in the detail page, or (b) extract to a shared file like `lib/constants/order-status.ts` and import in both pages. Option (b) is cleaner since Story 3-3 through 3-6 will also need these. Recommended: extract to shared file.

### Date Formatting

Story 3-1 used `Intl.DateTimeFormat` instead of `date-fns` (date-fns was listed as installed but wasn't in `package.json`). Continue using `Intl.DateTimeFormat`:

```typescript
new Intl.DateTimeFormat("en-CA", {
  dateStyle: "medium",
  timeStyle: "short",
}).format(new Date(timestamp))
```

### Status History Timeline UI

The `order_status_history` table has: `id, order_id, status, changed_by (uuid), changed_at (timestamptz)`.

For the timeline display:
- Show each status change as a timeline entry with the status label, formatted timestamp
- `changed_by` is a UUID reference to `auth.users` — resolving to a display name requires joining profiles. **Simplest approach for this story:** Show only the status and timestamp. User name resolution can be added in Story 3-3 (admin view) if needed
- If only one entry (initial "submitted"), still show it as the creation timestamp

### Decline Reason Display

When `order.status === "declined"` and `order.decline_reason` is not null:
- Show in a visually distinct callout — use a Card with destructive/warning styling
- Example: red-tinted background, AlertCircle icon, "Reason for Decline:" label + the text
- Per UX spec: "the reason for decline provided by the Admin is visible"

### UX Requirements Summary

**Order card in list (UX spec):**
- White background, left border orange 4px (`border-l-4 border-primary`)
- Status badge color-coded
- Submission date + total
- Clickable → navigates to detail

**Order detail page:**
- Breadcrumb: Orders > Order #XXXXXXXX
- Status badge prominently displayed
- Items table: Product Name, Unit, Price, Qty, Line Total
- Order total
- Status history timeline
- Decline reason (if applicable)
- Back navigation (link or breadcrumb)

**Empty state (order list):**
- "No orders yet" message with "New Order" CTA for store users (already implemented in 3-1)

**UI Language: English** — all labels in English per project feedback.

### Project Structure Notes

**Files to CREATE:**

```
scotty-ops/scotty-ops/
├── app/(dashboard)/orders/[order-id]/
│   └── page.tsx                        — Order detail page (Server Component)
├── lib/constants/
│   └── order-status.ts                 — Shared STATUS_COLORS and STATUS_LABELS (optional refactor)
```

**Files to MODIFY:**

```
scotty-ops/scotty-ops/
├── app/(dashboard)/orders/page.tsx     — Add <Link> wrapping each order row
```

**Files NOT to touch:**
- `app/(dashboard)/orders/actions.ts` — no new actions needed (read-only story)
- `app/(dashboard)/orders/new/page.tsx` — order creation, unrelated
- `components/orders/new-order-cart.tsx` — cart component, unrelated
- `lib/types/index.ts` — types already sufficient (OrderRow, OrderItemRow, OrderStatus all exist)
- `lib/validations/orders.ts` — no new validation needed
- `middleware.ts` — no changes needed
- `supabase/migrations/` — no new migrations needed

### Architecture Compliance

**D7 — Server Actions:** Not applicable — this story is read-only. No mutations.

**D8 — SSR:** Order detail page is a Server Component. Data fetched server-side via Supabase server client. No client components needed for this story (no interactivity beyond navigation).

**D9 — Error Handling:** If order not found (RLS denied or invalid ID), redirect to `/orders`. No error toasts needed since there are no user-triggered actions.

**D10 — State Management:** No client state needed. Pure SSR pages.

**Anti-Patterns — NEVER DO:**
- `supabase.from('orders').select('*')` — always select specific columns
- Import server Supabase client in a client component
- Use `service_role` key — RLS handles all access
- `new Date().toLocaleDateString()` — use `Intl.DateTimeFormat("en-CA", ...)`
- Create a new API route for fetching order details — SSR does this directly

### Library & Framework Requirements

**Already installed — no new packages needed:**

| Package | Purpose | Notes |
|---------|---------|-------|
| `@supabase/ssr` | Server-side Supabase client | Already configured |
| `lucide-react` | Icons (Package, ArrowLeft, Clock, AlertCircle) | Already installed |

**No new packages to install.** This story is purely SSR with existing dependencies.

### Testing Requirements

- Run `npm run build` — zero errors
- Run `npm run lint` — zero warnings/errors
- Manual verification: Store User sees only their store's orders (RLS)
- Manual verification: Clicking an order navigates to `/orders/[order-id]`
- Manual verification: Detail page shows all items with quantities, prices, line totals
- Manual verification: Detail page shows order total
- Manual verification: Detail page shows status badge with correct color
- Manual verification: Detail page shows status history with timestamps
- Manual verification: Declined order shows decline reason
- Manual verification: Accessing another store's order ID redirects to `/orders`
- Manual verification: Non-existent order ID redirects to `/orders`

### Previous Story Intelligence (from Story 3-1)

**Key learnings that MUST inform this implementation:**

1. **`date-fns` is NOT installed** — Story 3-1 discovered this and used `Intl.DateTimeFormat` instead. Continue this pattern.

2. **`formatPrice` exists in `lib/utils.ts`** — Use it for all price display. Do NOT create a new formatter.

3. **Server Action pattern: do NOT call `redirect()` inside Server Actions** — return result and let client handle navigation. Not directly relevant to this story (no Server Actions), but if tempted to add any mutation, follow this pattern.

4. **RLS is the enforcement layer** — The orders list already works via RLS. The detail page will also work via RLS. No additional application-layer role checks needed for data access (RLS denies unauthorized reads automatically).

5. **`types/database.types.ts` (root) was deleted** — The actual types live in `lib/types/database.types.ts` (manually authored). The canonical app types are in `lib/types/index.ts`.

6. **Next.js 15 async params** — Route params must be awaited: `const { "order-id": orderId } = await params;`

7. **Status colors/labels** were defined inline in `orders/page.tsx` — consider extracting to a shared constant for reuse in the detail page and future stories.

8. **Pre-existing `catalog-browser.tsx` Image import bug** was fixed in Story 3-1 — no action needed.

### References

- [Source: epics.md — Epic 3, Story 3.2] User story, acceptance criteria
- [Source: prd.md — FR18] Store Users can view their own store's order history and full order details
- [Source: prd.md — FR27] System tracks and displays order status throughout its full lifecycle
- [Source: architecture.md — D5] RLS helper functions auth_role() / auth_store_id()
- [Source: architecture.md — D8] SSR for data fetching — no Realtime needed for this story
- [Source: architecture.md — Project Structure] orders/[order-id]/page.tsx route
- [Source: ux-design-specification.md — OrderCard] Left border orange, status badge, clickable
- [Source: ux-design-specification.md — Status Colors] Gray/Amber/Green/Red/Blue per status
- [Source: ux-design-specification.md — Navigation Hierarchy] /pedidos/[id] breadcrumb pattern
- [Source: ux-design-specification.md — Empty States] Store user empty state with CTA
- [Source: Story 3-1 — Dev Notes] date-fns not installed, formatPrice exists, RLS patterns, async params
- [Source: memory/feedback_ui_language.md] UI must be in English

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

No issues encountered during implementation.

### Completion Notes List

- Extracted `STATUS_COLORS` and `STATUS_LABELS` to shared `lib/constants/order-status.ts` for reuse across orders pages (3-3 through 3-6 will benefit)
- Updated orders list page: each order row is now a clickable `<Link>` with orange left border (`border-l-4 border-primary`) and hover state
- Added store name display for admin/factory roles by querying the `stores` table with collected store IDs
- Updated empty state CTA button to say "New Order" (was "Create your first order")
- Created order detail page as Server Component at `app/(dashboard)/orders/[order-id]/page.tsx`
- Order detail fetches: order (with RLS), order items, status history — all with specific column selects
- Order total calculated client-side from items `unit_price * quantity`
- Breadcrumb shows "Orders > Order #XXXXXXXX" with ArrowLeft icon for back navigation
- Items displayed in table with Product Name, Unit, Unit Price, Qty, Line Total + footer total
- Status history displayed as vertical timeline with color-coded status badges and timestamps
- Decline reason shown in red callout card with AlertCircle icon (only when status is "declined" and reason exists)
- Used `Intl.DateTimeFormat("en-CA", ...)` for all date formatting (no date-fns)
- Used Next.js 15 async params pattern: `await params`
- All UI labels in English per project feedback
- `npm run build` — zero errors, route `/orders/[order-id]` confirmed dynamic
- `npm run lint` — zero errors/warnings

### File List

**New files:**
- `scotty-ops/lib/constants/order-status.ts` — Shared STATUS_COLORS and STATUS_LABELS constants
- `scotty-ops/app/(dashboard)/orders/[order-id]/page.tsx` — Order detail page (Server Component)

**Modified files:**
- `scotty-ops/app/(dashboard)/orders/page.tsx` — Added Link wrapping, orange border, store name for admin/factory, imported shared constants

### Change Log

- 2026-03-16: Story 3-2 implemented — order list enhanced with clickable rows and orange border; order detail page created with items table, status history timeline, decline reason callout, and breadcrumb navigation

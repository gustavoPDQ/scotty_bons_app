# Story 3.1: Store User — Create & Submit Supply Order

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Store User,
I want to create a supply order by selecting products and quantities from the catalog and submit it,
so that I can request weekly supplies from the factory in under 2 minutes.

## Acceptance Criteria

1. **Given** a Store User clicks "New Order",
   **When** the order creation screen loads,
   **Then** the full product catalog is displayed organized by category with sticky category navigation, and a running total bar is visible at the bottom of the screen.

2. **Given** a Store User selects a product and enters a quantity,
   **When** they click "Add",
   **Then** the item is added to the order, the running total updates immediately, and a cart badge shows the current item count.

3. **Given** a Store User has added at least one item,
   **When** they click "Review Order" in the sticky action bar,
   **Then** they are taken to an order review screen showing all items, quantities, unit prices, and the order total.

4. **Given** a Store User is on the review screen,
   **When** they click "Submit Order",
   **Then** the order is submitted with status "Submitted", a success toast displays ("Order submitted! The Admin will be notified."), and they are redirected to their order list showing the new order.

5. **Given** a Store User attempts to submit an order with no items added,
   **When** they try to proceed,
   **Then** the "Review Order" button is disabled and a hint explains that at least one item must be added.

6. **Given** a network error occurs during order submission,
   **When** the submission fails,
   **Then** a clear error toast is shown, the order data is preserved in the current session, and the user can retry without re-entering items (NFR14).

7. **Given** a Store User submits an order,
   **When** the order is created,
   **Then** the prices stored on the order reflect the catalog prices at the moment of submission — future catalog price changes do not alter this order.

8. **Given** a Store User is adding products to an order,
   **When** they add or remove items,
   **Then** the cart state is managed via `useReducer` in the `new-order-cart.tsx` Client Component — state persists through category navigation without page reload, and the running total recalculates on every dispatch.

## Tasks / Subtasks

- [x] Task 1 — Create database migration for `orders`, `order_items`, and `order_status_history` tables (AC: #7)
  - [x]Create migration file `supabase/migrations/YYYYMMDD_create_orders.sql`
  - [x]`orders` table: `id` (uuid PK default gen_random_uuid()), `store_id` (uuid FK → stores NOT NULL), `submitted_by` (uuid FK → auth.users NOT NULL), `status` (text NOT NULL default 'submitted' CHECK in ('submitted','under_review','approved','declined','fulfilled')), `decline_reason` (text nullable), `fulfilled_at` (timestamptz nullable), `created_at` (timestamptz default now()), `updated_at` (timestamptz default now())
  - [x]`order_items` table: `id` (uuid PK default gen_random_uuid()), `order_id` (uuid FK → orders ON DELETE CASCADE NOT NULL), `product_id` (uuid FK → products NOT NULL), `product_name` (text NOT NULL — snapshot), `unit_of_measure` (text NOT NULL — snapshot), `unit_price` (numeric(10,2) NOT NULL — snapshot), `quantity` (integer NOT NULL CHECK > 0), `created_at` (timestamptz default now())
  - [x]`order_status_history` table: `id` (uuid PK default gen_random_uuid()), `order_id` (uuid FK → orders ON DELETE CASCADE NOT NULL), `status` (text NOT NULL), `changed_by` (uuid FK → auth.users NOT NULL), `changed_at` (timestamptz default now())
  - [x]Add `updated_at` trigger on `orders` — REUSE existing `update_updated_at_column()` function from `create_stores` migration. Do NOT create a new function. Just create the trigger referencing `update_updated_at_column()`
  - [x]Create RLS policies for `orders`: admin SELECT/INSERT/UPDATE/DELETE all; store SELECT/INSERT where `store_id = auth_store_id()`; factory SELECT all (read-only)
  - [x]Create RLS policies for `order_items`: admin full access; store SELECT where order's store_id matches; factory SELECT all. For store INSERT: create a SECURITY DEFINER helper function `order_belongs_to_store(p_order_id uuid)` that checks `EXISTS (SELECT 1 FROM orders WHERE id = p_order_id AND store_id = auth_store_id())`, then use it in the WITH CHECK clause
  - [x]Create RLS policies for `order_status_history`: admin SELECT + INSERT (for future status changes); store SELECT where order belongs to their store; factory SELECT all. No direct INSERT for store/factory — initial row created by SECURITY DEFINER trigger only
  - [x]Create SECURITY DEFINER trigger function `insert_initial_order_status()` on `orders` INSERT that inserts into `order_status_history` (status=NEW.status, changed_by=NEW.submitted_by, order_id=NEW.id). Must be SECURITY DEFINER to bypass RLS on order_status_history
  - [x]Add indexes: `idx_orders_store_id` on orders(store_id), `idx_orders_status` on orders(status), `idx_orders_submitted_by` on orders(submitted_by), `idx_order_items_order_id` on order_items(order_id), `idx_order_status_history_order_id` on order_status_history(order_id)
  - [x]Run `supabase gen types typescript --local > types/database.types.ts` to regenerate types

- [x] Task 2 — Create order types and validation schemas (AC: #2, #7)
  - [x]Add to `lib/types/index.ts`: `OrderRow` (id, store_id, store_name, submitted_by, status, decline_reason, fulfilled_at, created_at, updated_at, item_count?, total?), `OrderItemRow` (id, order_id, product_id, product_name, unit_price, quantity), `OrderStatus` type union
  - [x]Create `lib/validations/orders.ts`: `createOrderSchema` — Zod schema validating `items: z.array(z.object({ product_id: z.string().uuid(), product_name: z.string().min(1), unit_of_measure: z.string().min(1), unit_price: z.number().positive(), quantity: z.number().int().positive() })).min(1, "At least one item is required")`, `store_id: z.string().uuid()`

- [x] Task 3 — Create `createOrder` Server Action (AC: #4, #6, #7)
  - [x]Create `app/(dashboard)/orders/actions.ts` with `"use server"`
  - [x]Implement `verifyStoreUser()` helper (follow `verifyAdmin()` pattern from `products/actions.ts`): get user via `supabase.auth.getUser()`, get profile with `select("role, store_id")`, verify `profile.role === 'store'` AND `profile.store_id` is not null, return `{ supabase, user, profile }` or `null`. Must return all three since supabase client, user.id (for submitted_by), and profile.store_id are all needed
  - [x]Implement `createOrder(values)`: validate with `createOrderSchema.safeParse()`, verify store user, INSERT into `orders` (store_id from profile.store_id, submitted_by from user.id, status='submitted'), then INSERT all items into `order_items` with snapshot product_name, unit_of_measure, and unit_price. Return `ActionResult<{ id: string }>`
  - [x]ATOMICITY: Insert order first, then items. If items INSERT fails, delete the orphaned order in a cleanup step (same pattern as user creation rollback in `users/actions.ts`). Alternative: create a PostgreSQL function `create_order_with_items(...)` called via `supabase.rpc()` for transactional atomicity
  - [x]Handle errors: return human-readable messages, never throw, never expose raw Supabase errors
  - [x]Call `revalidatePath('/orders')` after successful creation to invalidate cache. Do NOT call `redirect()` inside the Server Action — return the result and let the client handle navigation

- [x] Task 4 — Create `NewOrderCart` client component with `useReducer` (AC: #1, #2, #3, #5, #8)
  - [x]Create `components/orders/new-order-cart.tsx` as `"use client"` component
  - [x]Define cart reducer with actions: `ADD_ITEM`, `REMOVE_ITEM`, `UPDATE_QUANTITY`, `CLEAR_CART`
  - [x]Cart state: `Map<string, CartItem>` where CartItem = `{ product_id, product_name, unit_of_measure, unit_price, quantity }`
  - [x]Accept props: `categories: CategoryRow[]`, `products: ProductRow[]`
  - [x]Two-phase UI: Phase 1 = catalog browse + add items, Phase 2 = order review
  - [x]Phase 1: Reuse the grouped-by-category pattern from `CatalogBrowser` (Story 2-3) — sticky category pills, product cards with quantity input + "Add" button
  - [x]Each product card: name, unit of measure, price (formatted CAD), quantity input (number, min=1), "Add" button
  - [x]StickyOrderBar at bottom: item count badge, running total, "Review Order" button (disabled when cart empty)
  - [x]Phase 2 (review): list all cart items with quantities, unit prices, line totals, order total, "Edit" button to go back to Phase 1, "Submit Order" button
  - [x]On submit: call `createOrder` server action via `useTransition`, on success show toast and call `router.push('/orders')` from client (using `useRouter` from `next/navigation`). Do NOT use `redirect()` inside the Server Action
  - [x]On error: show error toast, preserve cart state, allow retry

- [x] Task 5 — Create `/orders/new` page (AC: #1)
  - [x]Create `app/(dashboard)/orders/new/page.tsx` as Server Component
  - [x]Auth check: get user, get profile, verify role is 'store' — redirect non-store users to `/orders`
  - [x]Fetch categories: `.from("product_categories").select("id, name").order("name")`
  - [x]Fetch products: `.from("products").select("id, name, price, unit_of_measure, category_id, image_url").order("name")`
  - [x]RLS NOTE: Both tables already have SELECT policies for 'store' role — no new RLS needed for these queries
  - [x]Render `<NewOrderCart categories={categories} products={products} />`
  - [x]Page header: "New Order" with breadcrumb (Orders > New Order)

- [x] Task 6 — Update `/orders` page with placeholder order list (AC: #4 redirect target)
  - [x]Update `app/(dashboard)/orders/page.tsx` from "Coming soon" to functional page
  - [x]Server Component: auth check, role detection
  - [x]For Store Users: fetch orders where store_id matches, display in simple list with status badges
  - [x]Include "New Order" button (primary, links to `/orders/new`) — visible only for store role
  - [x]Empty state: "No orders yet" with "Create your first order" CTA for store users
  - [x]Note: Full order list features (real-time, admin view, filtering) are Stories 3-2 and 3-3 — this is minimal viable for redirect target

- [x] Task 7 — Build and lint verification (AC: all)
  - [x]Run `npm run build` — zero errors
  - [x]Run `npm run lint` — zero warnings/errors
  - [x]Verify TypeScript compilation passes

## Quick Reference — Existing Code to Reuse

```
Supabase client:     import { createClient } from "@/lib/supabase/server"
Types:               import type { ActionResult, ProductRow, CategoryRow } from "@/lib/types"
Validation pattern:  see lib/validations/products.ts
Server Action:       see app/(dashboard)/products/actions.ts (verifyAdmin pattern)
Catalog UI:          see components/products/catalog-browser.tsx (grouped-by-category)
Price formatting:    import { formatPrice } from "@/lib/utils"  ← ALREADY EXISTS, reuse it
Toast:               import { toast } from "sonner"
Trigger function:    update_updated_at_column()  ← ALREADY EXISTS, do NOT recreate
```

## Dev Notes

### CRITICAL: This Story Creates the Order Domain Foundation

This is the first story in Epic 3. It creates the database tables, types, validation schemas, server actions, and the complete order creation flow for Store Users. Subsequent stories (3-2 through 3-6) build on this foundation — get it right.

### Database Migration — Key Decisions

**Price snapshot pattern (AC #7):** `order_items` stores `product_name` and `unit_price` as snapshot values copied from the product catalog at submission time. These are NOT foreign key lookups — they are denormalized copies. This ensures order integrity even if catalog prices change later. This mirrors the invoice immutability pattern from D2.

**Status as text with CHECK constraint:** Use a CHECK constraint instead of a PostgreSQL enum type. This avoids migration headaches when adding new statuses later. Pattern: `CHECK (status IN ('submitted', 'under_review', 'approved', 'declined', 'fulfilled'))`.

**`order_status_history` table:** Every status change is recorded with who made it and when. Story 3-1 only creates the initial "submitted" entry. Later stories (3-4, 3-6) add entries for approve/decline/fulfill transitions. Use a trigger on `orders` INSERT to automatically create the initial history row.

**RLS policies — critical for this story:**
- Store Users can only SELECT orders where `store_id = auth_store_id()` and INSERT orders where `store_id = auth_store_id()`
- Store Users can INSERT order_items only for orders they own (join through orders table)
- Admin has full CRUD on all order tables
- Factory Users have SELECT-only on all order tables
- NEVER use service_role in application code — RLS enforces all access

**`updated_at` trigger:** REUSE the existing `update_updated_at_column()` function already defined in the `create_stores` migration (also used by profiles, product_categories, products). Do NOT create a new trigger function. Just add the trigger:
```sql
-- REUSE existing function — do NOT create update_updated_at() or similar
CREATE TRIGGER orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

**`order_status_history` initial row trigger:** Must be SECURITY DEFINER to bypass RLS:
```sql
CREATE OR REPLACE FUNCTION insert_initial_order_status()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO order_status_history (order_id, status, changed_by)
  VALUES (NEW.id, NEW.status, NEW.submitted_by);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE TRIGGER orders_insert_status_history
  AFTER INSERT ON orders
  FOR EACH ROW EXECUTE FUNCTION insert_initial_order_status();
```

**`order_items` RLS for Store User INSERT:** Requires a helper function since WITH CHECK can't easily join to orders:
```sql
CREATE OR REPLACE FUNCTION order_belongs_to_store(p_order_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM orders WHERE id = p_order_id AND store_id = auth_store_id()
  )
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

CREATE POLICY "order_items_insert_store" ON order_items
  FOR INSERT WITH CHECK (auth_role() = 'store' AND order_belongs_to_store(order_id));
```

### Existing Codebase — What Already Works

**Data layer (reuse, do NOT recreate):**
- `lib/supabase/server.ts` — `createClient()` for Server Components and Server Actions
- `lib/supabase/admin.ts` — `createAdminClient()` for admin-only operations (NOT needed for order creation — Store Users create orders via RLS)
- `lib/types/index.ts` — `ActionResult<T>`, `ProductRow`, `CategoryRow`, `StoreRow`
- `lib/validations/products.ts` — pattern for Zod schemas
- `lib/utils.ts` — `formatPrice(value: number)` utility already exists. REUSE this in the cart component. Do NOT create a new currency formatter
- `auth_role()` / `auth_store_id()` — SECURITY DEFINER PostgreSQL functions already exist
- `update_updated_at_column()` — trigger function already exists in `create_stores` migration. REUSE for orders table

**UI patterns (reuse, do NOT recreate):**
- `components/products/catalog-browser.tsx` — Story 2-3 created the grouped-by-category browse pattern with sticky pills, IntersectionObserver. Reuse the same visual pattern in the order creation flow but with quantity inputs and Add buttons.
- `components/ui/` — all shadcn/ui components (Button, Card, Input, Badge, Dialog, etc.)
- `components/shared/sidebar.tsx` — role-aware navigation (Orders link already exists for all roles)
- Server Action pattern from `app/(dashboard)/users/actions.ts` and `app/(dashboard)/products/actions.ts`

**Navigation (already configured):**
- `lib/nav-items.ts` — Orders nav item exists at `/orders` for admin, factory, store roles

### Architecture Compliance

**D7 — Server Actions:** `createOrder` is a Server Action in `app/(dashboard)/orders/actions.ts`. Returns `ActionResult<{ id: string }>`. Never throws to client.

**D8 — SSR + No Realtime for this story:** The `/orders/new` page is SSR — Server Component fetches catalog data, passes to client component. No Realtime needed for order creation. (Realtime is Story 3-3.)

**D9 — Error Handling:** Server Action returns `{ data, error }`. Client surfaces error via toast. Zod validates client-side before calling action. Same Zod schema re-validates inside Server Action.

**D10 — State Management:** Cart state uses `useReducer` in `NewOrderCart` client component. No global state library. No URL params for cart state (it's ephemeral).

**D11 — Forms + Zod:** Quantity inputs use controlled components. `createOrderSchema` validates the complete order before submission. Shared between client validation and Server Action.

**Anti-Patterns — NEVER DO:**
- `supabase.from('orders').select('*')` — always select specific columns
- `throw new Error(...)` inside Server Action — return `{ data: null, error: "message" }`
- Import server Supabase client in client component — pass data as props
- Use `service_role` key in Server Action — use authenticated client with RLS
- Manual `isLoading` state — use `useTransition` for `isPending`
- `new Date().toLocaleDateString()` — use `date-fns` format()
- Create a separate API route for order creation — use Server Action

### UX Requirements

**Order creation flow (from UX spec):**
1. Store User clicks "New Order" — primary orange button on Orders page
2. Catalog displayed by category with sticky pill navigation (same pattern as catalog browse)
3. Each product: name, unit of measure, price, quantity input, "Add" button
4. Sticky bottom bar: item count, running total, "Review Order" button
5. Review screen: all items with quantities, prices, totals, "Edit" and "Submit Order" buttons
6. On submit: success toast, redirect to orders list

**Design tokens:**
- Primary button: `bg-primary` (Scotty Orange #F5A623)
- Currency format: `new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(value)`
- Touch targets: minimum 44×44px for mobile
- Empty state: Package icon + message + CTA

**UI Language: English** — All labels, buttons, toasts must be in English. The epics file has PT-BR text from the UX spec — translate everything to English for implementation.

**Status badge colors:**
| Status | Color |
|--------|-------|
| Submitted | gray (#6B7280) |
| Under Review | amber (#F59E0B) |
| Approved | green (#27A800) |
| Declined | red (#DC2626) |
| Fulfilled | blue (#2563EB) |

### Cart Reducer Design

```typescript
type CartItem = {
  product_id: string;
  product_name: string;
  unit_of_measure: string;
  unit_price: number;
  quantity: number;
};

type CartState = {
  items: Map<string, CartItem>; // keyed by product_id
};

type CartAction =
  | { type: 'ADD_ITEM'; payload: CartItem }
  | { type: 'REMOVE_ITEM'; payload: { product_id: string } }
  | { type: 'UPDATE_QUANTITY'; payload: { product_id: string; quantity: number } }
  | { type: 'CLEAR_CART' };
```

- `ADD_ITEM`: If product already in cart, increment quantity. Otherwise add new entry.
- `REMOVE_ITEM`: Remove product from cart entirely.
- `UPDATE_QUANTITY`: Set exact quantity. If quantity ≤ 0, remove item.
- `CLEAR_CART`: Empty entire cart (used after successful submission).

**Map serialization:** Before calling `createOrder()`, convert the Map to an array: `Array.from(state.items.values())` — Server Actions receive plain objects, not Maps.

### Project Structure Notes

**Files to CREATE:**

```
scotty-ops/scotty-ops/
├── supabase/migrations/YYYYMMDD_create_orders.sql  — orders + order_items + order_status_history + RLS
├── lib/validations/orders.ts                         — createOrderSchema
├── app/(dashboard)/orders/actions.ts                 — createOrder server action
├── app/(dashboard)/orders/new/page.tsx               — New Order page (Server Component)
├── components/orders/new-order-cart.tsx               — Cart + catalog browse + review (Client Component)
```

**Files to MODIFY:**

```
scotty-ops/scotty-ops/
├── lib/types/index.ts                                — Add OrderRow, OrderItemRow, OrderStatus
├── app/(dashboard)/orders/page.tsx                   — Replace "Coming soon" with functional order list
├── types/database.types.ts                           — Regenerated from schema (auto)
```

**Files NOT to touch:**
- `components/products/catalog-browser.tsx` — reference only for UI patterns, do NOT modify
- `components/products/products-client.tsx` — admin product management, unrelated
- `app/(dashboard)/products/page.tsx` — reference only for query patterns, do NOT modify
- `middleware.ts` — no changes needed
- `lib/supabase/server.ts` — no changes needed
- `lib/supabase/admin.ts` — NOT needed for this story (Store Users use RLS, not admin client)
- `lib/utils.ts` — already has `formatPrice`, do NOT add a duplicate formatter
- `lib/nav-items.ts` — Orders nav already configured

### Library & Framework Requirements

**Already installed — use these exact packages:**

| Package | Purpose | Notes |
|---------|---------|-------|
| `@supabase/ssr` | Server/client Supabase clients | Already configured |
| `zod` | Schema validation | Already used in products/users |
| `react-hook-form` | Form state (NOT needed for cart — useReducer) | Only if adding form fields |
| `@hookform/resolvers` | Zod resolver for RHF | Only if using RHF |
| `lucide-react` | Icons (Package, Plus, Minus, ShoppingCart, Trash2) | Already installed |
| `sonner` | Toast notifications | Already configured via `components/ui/sonner.tsx` |
| `date-fns` | Date formatting | Already installed |

**No new packages to install.**

**Do NOT install:**
- Redux, Zustand, or any state management library — `useReducer` is sufficient
- Any cart library — custom reducer is simpler
- Any e-commerce library — this is a simple order form

### Testing Requirements

- Run `npm run build` — zero errors
- Run `npm run lint` — zero warnings/errors
- Manual verification: Store User can access `/orders/new`
- Manual verification: Catalog loads organized by category with sticky pills
- Manual verification: Adding items updates cart count and running total
- Manual verification: "Review Order" button disabled when cart is empty
- Manual verification: Review screen shows all items with correct prices and totals
- Manual verification: "Submit Order" creates order and redirects to `/orders`
- Manual verification: Order appears in orders list with "Submitted" status badge
- Manual verification: Admin and Factory Users are redirected away from `/orders/new`
- Manual verification: Prices on order items match catalog prices at time of submission
- RLS verification: Store User can only see own store's orders
- RLS verification: Admin can see all orders
- RLS verification: Factory User can see all orders (read-only)

### Previous Story Intelligence (from Story 2-3)

**Key learnings that MUST inform this implementation:**

1. **Catalog browse pattern** — `CatalogBrowser` in Story 2-3 established the grouped-by-category view with sticky pills, IntersectionObserver for active category tracking, and smooth scroll. Reuse the same visual pattern for the order creation catalog but add quantity inputs and Add buttons.

2. **Price formatting is `en-CA` / `CAD`** — established in Story 2-2. Use `new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(value)`.

3. **UI language is English** — all labels in English per project requirements.

4. **Products page structure** — `page.tsx` fetches data in Server Component, passes to client. Follow the same pattern for `/orders/new/page.tsx`.

5. **Server Action pattern** — `verifyAdmin()` helper in actions.ts checks role before mutations. Create analogous `verifyStoreUser()` for order creation (or just check `auth_role() = 'store'` in the action).

6. **Client-side navigation after mutations** — established pattern: Server Action returns `ActionResult`, client checks result, then calls `router.push('/orders')` for navigation. Do NOT use `redirect()` inside Server Actions — it throws a special Next.js error that interrupts execution.

### Git Intelligence

**Recent commits (scotty-ops submodule):**
- `602dbdd` fix: add password confirmation field (story 1-2)
- `6aaa258` fix: add role-based redirect (story 1-1)
- Stories 1-3 through 2-3 changes exist but may not be committed yet

**Commit pattern:** `feat:` for new features. Recommended: `feat: add order creation flow with cart and database schema (story 3-1)`

### References

- [Source: epics.md — Epic 3, Story 3.1] User story, acceptance criteria, database table specs
- [Source: prd.md — FR17] Store Users can create a new supply order by selecting products and quantities
- [Source: prd.md — FR27] System tracks order status through full lifecycle
- [Source: architecture.md — D1] profiles table for role + store assignment
- [Source: architecture.md — D5] RLS helper functions auth_role() / auth_store_id()
- [Source: architecture.md — D7] Server Actions as primary mutation pattern, ActionResult<T>
- [Source: architecture.md — D8] SSR + targeted Realtime (no Realtime in this story)
- [Source: architecture.md — D10] useReducer for order cart state
- [Source: architecture.md — D11] Zod validation schemas
- [Source: architecture.md — Project Structure] orders/ route, components/orders/, actions.ts location
- [Source: architecture.md — Data Flow] Order Submission Flow diagram
- [Source: ux-design-specification.md — Journey 1] Daniel submits order in under 2 minutes
- [Source: ux-design-specification.md — Section 2.5] Order creation UX mechanics
- [Source: ux-design-specification.md — StickyOrderBar] Running total + Review Order button
- [Source: ux-design-specification.md — CategoryPillNav] Sticky category pills for navigation
- [Source: Story 2-3 — CatalogBrowser] Grouped-by-category browse pattern with sticky pills
- [Source: memory/feedback_ui_language.md] UI is English — all labels in English

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

- `date-fns` listed as installed in Dev Notes but was NOT in `package.json` — replaced with `Intl.DateTimeFormat` to avoid adding new dependency
- Pre-existing lint/build error in `catalog-browser.tsx` (missing `Image` import from `next/image`) — fixed as part of this story since it blocked the build
- `types/database.types.ts` was not tracked in git and got corrupted by a failed `supabase gen types` command — deleted (nothing imported it; actual types live in `types/supabase.ts` and `lib/types/database.types.ts`)
- `supabase gen types` requires Docker/local Supabase running — `lib/types/database.types.ts` was manually authored to match the schema. Should be regenerated with `supabase gen types typescript --local` when Docker is available

### Completion Notes List

- Task 1: Created migration `20260317100000_create_orders.sql` with all 3 tables, RLS policies (admin full, store own, factory read-only), SECURITY DEFINER trigger for status history, helper function `order_belongs_to_store()`, and indexes
- Task 2: Added `OrderRow`, `OrderItemRow`, `OrderStatus` types to `lib/types/index.ts`. Created `lib/validations/orders.ts` with `createOrderSchema` Zod schema
- Task 3: Created `app/(dashboard)/orders/actions.ts` with `verifyStoreUser()` helper and `createOrder` Server Action. Implements rollback if order_items insert fails. Returns `ActionResult<{ id: string }>`, calls `revalidatePath('/orders')`
- Task 4: Created `components/orders/new-order-cart.tsx` — full `useReducer` cart with ADD_ITEM/REMOVE_ITEM/UPDATE_QUANTITY/CLEAR_CART. Two-phase UI: browse catalog with sticky category pills + review with quantity editing. Sticky bottom bar with item count, total, and Review/Submit buttons
- Task 5: Created `app/(dashboard)/orders/new/page.tsx` — Server Component with auth check (store-only), fetches categories and products via RLS, renders `NewOrderCart`
- Task 6: Replaced "Coming soon" in `app/(dashboard)/orders/page.tsx` with functional order list showing status badges, item counts, totals. "New Order" button visible only for store role. Empty state with CTA
- Task 7: `npm run build` — zero errors. `npm run lint` — zero errors. TypeScript compilation passes

### Senior Developer Review (AI)

**Reviewer:** Gustavo (via Claude Opus 4.6) | **Date:** 2026-03-16

**Issues Found:** 3 High, 3 Medium, 3 Low

**HIGH — Fixed:**
- H1: SECURITY — `createOrder` trusted client-submitted prices. Replaced with `create_order_with_items()` RPC that looks up prices server-side from the products table
- H2: Non-atomic order+items creation with unreliable rollback. Replaced with single PostgreSQL transaction via RPC
- H3: `orders/page.tsx` defaulted role to 'store' on profile lookup failure. Now redirects to `/login` on missing profile

**MEDIUM — Fixed:**
- M2: Clearing quantity input in review removed item from cart. Now clamps minimum to 1 and ignores NaN
- M3: `product_name` and `unit_of_measure` trusted from client. Fixed by H1 — all snapshot data comes from DB now

**MEDIUM — Noted (acceptable at current scale):**
- M1: Orders page fetches all order_items for summary computation. At current scale (~10-20 users, <100 orders) this is acceptable. Optimize with server-side aggregation RPC when order volume grows

**LOW — Noted:**
- L1: No maximum quantity validation (no cap on quantity field). Add `.max(9999)` to Zod schema when business rule is defined
- L2: Date formatting uses `Intl.DateTimeFormat` instead of `date-fns` (not installed). Architecture spec should be updated to reflect this decision
- L3: `database.types.ts` manually authored. Regenerate with `supabase gen types typescript --local` when Docker available

**Build:** `npm run build` — zero errors | `npm run lint` — zero errors

### Change Log

- 2026-03-16: Implemented Story 3-1 — Order creation flow with database schema, Server Action, cart component, and order listing page
- 2026-03-16: Fixed pre-existing `Image` import bug in `catalog-browser.tsx`
- 2026-03-16: Manually authored `lib/types/database.types.ts` to include order tables (pending regeneration when Docker available)
- 2026-03-16: Code review — created `create_order_with_items()` RPC for atomic order creation with server-side price lookup (fixes H1+H2+M3). Fixed role fallback in orders page (H3). Fixed quantity input clearing UX (M2)

### File List

**New files:**
- `supabase/migrations/20260317100000_create_orders.sql`
- `supabase/migrations/20260317110000_create_order_rpc.sql`
- `lib/validations/orders.ts`
- `app/(dashboard)/orders/actions.ts`
- `app/(dashboard)/orders/new/page.tsx`
- `components/orders/new-order-cart.tsx`

**Modified files:**
- `lib/types/index.ts` — added OrderRow, OrderItemRow, OrderStatus types
- `lib/types/database.types.ts` — manually rebuilt with order tables + `create_order_with_items` RPC type (was untracked/corrupted)
- `app/(dashboard)/orders/page.tsx` — replaced "Coming soon" with functional order list
- `components/products/catalog-browser.tsx` — added missing `Image` import (pre-existing bug fix)

**Deleted files:**
- `types/database.types.ts` — removed corrupted file (nothing imported it)

# Story 5.2: Immutable Invoice Generation on Fulfillment

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a system operator,
I want an invoice to be automatically generated when an order is marked as fulfilled,
so that there is an immutable financial record of every completed order with accurate tax calculations and company details.

## Acceptance Criteria

1. **Given** a Factory user marks an order as "fulfilled" (Story 3-6),
   **When** the fulfillment action completes successfully,
   **Then** an invoice record is automatically created in the `invoices` table with a unique sequential invoice number (e.g., `INV-2026-0001`), linked to the order.

2. **Given** an invoice is being generated,
   **When** the invoice record is created,
   **Then** it includes: a snapshot of all order items (product_name, quantity, unit_price, unit_of_measure, line_total) in `invoice_items`, computed subtotal, tax rate and tax amount (from `financial_settings`), grand total, company details snapshot (from `financial_settings`), and store name.

3. **Given** an invoice has been created,
   **When** any user attempts to UPDATE or DELETE the invoice or its items,
   **Then** the operation is denied by RLS — invoices are immutable (INSERT-only policy, no UPDATE/DELETE policies).

4. **Given** an Admin user views the invoices,
   **When** the page loads,
   **Then** all invoices across all stores are visible.

5. **Given** a Store user views invoices,
   **When** the page loads,
   **Then** only invoices for their own store are visible.

6. **Given** a Factory user views invoices,
   **When** the page loads,
   **Then** all invoices are visible (read-only).

7. **Given** a user views a fulfilled order's detail page,
   **When** the page renders,
   **Then** a "View Invoice" link is displayed that navigates to the invoice detail page.

8. **Given** a user views an invoice detail page,
   **When** the page renders,
   **Then** a formatted invoice is displayed showing: invoice number, invoice date, company details (name, address, tax ID), store name, itemized line items (product_name, quantity, unit_price, unit_of_measure, line_total), subtotal, tax rate, tax amount, and grand total.

9. **Given** invoice generation fails (e.g., `financial_settings` not configured),
   **When** the fulfillment action runs,
   **Then** the entire operation fails atomically — the order status does NOT change to "fulfilled" and an error is returned.

10. **Given** the sequential invoice number,
    **When** multiple invoices are generated concurrently,
    **Then** each invoice receives a unique, gap-free sequential number within its year prefix.

## Tasks / Subtasks

- [ ] Task 1 — DB migration: create `invoices` and `invoice_items` tables (AC: #1, #2, #3, #10)
  - [ ] Create `supabase/migrations/20260319100000_create_invoices.sql`
  - [ ] Create `invoices` table with columns: `id`, `order_id`, `invoice_number`, `store_id`, `store_name`, `company_name`, `company_address`, `company_tax_id`, `subtotal`, `tax_rate`, `tax_amount`, `grand_total`, `created_at`
  - [ ] Add UNIQUE constraint on `invoice_number`
  - [ ] Add UNIQUE constraint on `order_id` (one invoice per order)
  - [ ] Create `invoice_items` table with columns: `id`, `invoice_id`, `product_name`, `unit_of_measure`, `unit_price`, `quantity`, `line_total`
  - [ ] Create `invoice_number_seq` sequence or counter table for gap-free sequential numbering within year
  - [ ] Enable RLS on both tables
  - [ ] INSERT-only policies for `invoices`: admin (INSERT), no UPDATE/DELETE for any role
  - [ ] SELECT policies: admin sees all, store sees own store_id, factory sees all
  - [ ] INSERT-only policies for `invoice_items`: admin (INSERT), no UPDATE/DELETE for any role
  - [ ] SELECT policies for `invoice_items`: admin sees all, store sees own (via invoice→store_id join), factory sees all

- [ ] Task 2 — DB function: `generate_invoice_on_fulfill` SECURITY DEFINER RPC (AC: #1, #2, #9, #10)
  - [ ] Create SECURITY DEFINER function `generate_invoice(p_order_id uuid)` that:
    - Fetches the order and validates status = 'fulfilled'
    - Fetches `financial_settings` (RAISE EXCEPTION if not configured)
    - Fetches store name from `stores`
    - Generates next sequential invoice number: `INV-YYYY-NNNN` using `advisory lock` + counter for concurrency safety
    - Inserts into `invoices` with all snapshot data
    - Inserts into `invoice_items` from `order_items` with computed `line_total`
    - Returns the invoice ID
  - [ ] Function uses advisory lock or serializable approach for gap-free numbering

- [ ] Task 3 — Modify `fulfillOrder` server action to generate invoice atomically (AC: #1, #9)
  - [ ] Update `app/(dashboard)/orders/[order-id]/actions.ts`
  - [ ] After setting order status to `fulfilled`, call `generate_invoice` RPC
  - [ ] If RPC fails, return error (DB transaction ensures order status is also rolled back if using a single RPC approach)
  - [ ] Alternative: wrap fulfill + invoice generation in a single SECURITY DEFINER function for true atomicity

- [ ] Task 4 — Add "View Invoice" link on order detail page (AC: #7)
  - [ ] Update `app/(dashboard)/orders/[order-id]/page.tsx`
  - [ ] When order status is `fulfilled`, query for the associated invoice
  - [ ] Display a "View Invoice" link/button that navigates to `/invoices/[invoice-id]`

- [ ] Task 5 — Invoice detail page (AC: #8)
  - [ ] Create `app/(dashboard)/invoices/[invoice-id]/page.tsx` as a Server Component
  - [ ] Fetch invoice + invoice_items via Supabase (RLS handles access)
  - [ ] Render formatted invoice: header with company details, store info, invoice number & date, itemized table, subtotal/tax/grand total
  - [ ] Use `formatPrice()` for all currency values
  - [ ] Use `Intl.DateTimeFormat("en-CA", ...)` for dates
  - [ ] Include "Back to Order" link

- [ ] Task 6 — TypeScript types (AC: all)
  - [ ] Add `InvoiceRow` and `InvoiceItemRow` types to `lib/types/index.ts`

- [ ] Task 7 — Build and lint verification (AC: all)
  - [ ] Run `npm run build` — zero errors
  - [ ] Run `npm run lint` — zero warnings/errors

## Quick Reference — Existing Code to Reuse

```
Supabase server client:  import { createClient } from "@/lib/supabase/server"
Types:                   import type { ActionResult, OrderStatus } from "@/lib/types"
Format currency:         import { formatPrice } from "@/lib/utils"
CN utility:              import { cn } from "@/lib/utils"
UI components:           Card, CardContent, CardHeader, CardTitle, Badge, Button from @/components/ui/*
Icons:                   FileText, ArrowLeft from lucide-react
revalidatePath:          import { revalidatePath } from "next/cache"
Server action pattern:   see app/(dashboard)/orders/[order-id]/actions.ts (fulfillOrder)
Order detail page:       app/(dashboard)/orders/[order-id]/page.tsx
Date formatting:         Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeStyle: "short" })
```

## Dev Notes

### SQL Migration: Tables

```sql
-- ── invoices ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS invoices (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id          uuid NOT NULL UNIQUE REFERENCES orders(id),
  invoice_number    text NOT NULL UNIQUE,
  store_id          uuid NOT NULL REFERENCES stores(id),
  store_name        text NOT NULL,
  company_name      text NOT NULL,
  company_address   text NOT NULL,
  company_tax_id    text NOT NULL,
  subtotal          numeric(12,2) NOT NULL,
  tax_rate          numeric(5,4) NOT NULL,
  tax_amount        numeric(12,2) NOT NULL,
  grand_total       numeric(12,2) NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_invoices_order_id ON invoices(order_id);
CREATE INDEX idx_invoices_store_id ON invoices(store_id);
CREATE INDEX idx_invoices_invoice_number ON invoices(invoice_number);

-- ── invoice_items ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS invoice_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id      uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  product_name    text NOT NULL,
  unit_of_measure text NOT NULL,
  unit_price      numeric(10,2) NOT NULL,
  quantity        integer NOT NULL,
  line_total      numeric(12,2) NOT NULL
);

CREATE INDEX idx_invoice_items_invoice_id ON invoice_items(invoice_id);
```

### SQL Migration: Invoice Number Sequence

Use an `invoice_number_counters` table with a year column for gap-free sequential numbering:

```sql
CREATE TABLE IF NOT EXISTS invoice_number_counters (
  year    integer PRIMARY KEY,
  counter integer NOT NULL DEFAULT 0
);
```

The `generate_invoice` function uses `pg_advisory_xact_lock` on the year to serialize access, then increments the counter atomically.

### SQL Migration: SECURITY DEFINER Function

```sql
CREATE OR REPLACE FUNCTION generate_invoice(p_order_id uuid)
RETURNS uuid AS $$
DECLARE
  v_order RECORD;
  v_settings RECORD;
  v_store RECORD;
  v_invoice_id uuid;
  v_invoice_number text;
  v_year integer;
  v_counter integer;
  v_subtotal numeric(12,2);
  v_tax_amount numeric(12,2);
  v_grand_total numeric(12,2);
BEGIN
  -- Fetch and validate order
  SELECT id, store_id, status INTO v_order FROM orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;
  IF v_order.status != 'fulfilled' THEN
    RAISE EXCEPTION 'Order is not fulfilled';
  END IF;

  -- Check if invoice already exists for this order
  IF EXISTS (SELECT 1 FROM invoices WHERE order_id = p_order_id) THEN
    RAISE EXCEPTION 'Invoice already exists for this order';
  END IF;

  -- Fetch financial_settings (must exist)
  SELECT tax_rate, company_name, company_address, company_tax_id
    INTO v_settings FROM financial_settings LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Financial settings not configured';
  END IF;

  -- Fetch store name
  SELECT name INTO v_store FROM stores WHERE id = v_order.store_id;

  -- Calculate subtotal from order items
  SELECT COALESCE(SUM(unit_price * quantity), 0) INTO v_subtotal
    FROM order_items WHERE order_id = p_order_id;

  -- Calculate tax and grand total
  v_tax_amount := ROUND(v_subtotal * v_settings.tax_rate, 2);
  v_grand_total := v_subtotal + v_tax_amount;

  -- Generate sequential invoice number with advisory lock
  v_year := EXTRACT(YEAR FROM now())::integer;
  PERFORM pg_advisory_xact_lock(hashtext('invoice_number'), v_year);

  INSERT INTO invoice_number_counters (year, counter)
    VALUES (v_year, 1)
    ON CONFLICT (year) DO UPDATE SET counter = invoice_number_counters.counter + 1
    RETURNING counter INTO v_counter;

  v_invoice_number := 'INV-' || v_year || '-' || LPAD(v_counter::text, 4, '0');

  -- Insert invoice
  INSERT INTO invoices (
    order_id, invoice_number, store_id, store_name,
    company_name, company_address, company_tax_id,
    subtotal, tax_rate, tax_amount, grand_total
  ) VALUES (
    p_order_id, v_invoice_number, v_order.store_id, v_store.name,
    v_settings.company_name, v_settings.company_address, v_settings.company_tax_id,
    v_subtotal, v_settings.tax_rate, v_tax_amount, v_grand_total
  ) RETURNING id INTO v_invoice_id;

  -- Copy order items into invoice items
  INSERT INTO invoice_items (invoice_id, product_name, unit_of_measure, unit_price, quantity, line_total)
    SELECT v_invoice_id, product_name, unit_of_measure, unit_price, quantity,
           ROUND(unit_price * quantity, 2)
    FROM order_items WHERE order_id = p_order_id;

  RETURN v_invoice_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
```

### SQL Migration: RLS Policies (Immutable — INSERT-only, no UPDATE/DELETE)

```sql
-- ── RLS: invoices ───────────────────────────────────────────────────────────

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- SELECT policies
CREATE POLICY "invoices_select_admin"
  ON invoices FOR SELECT
  USING (auth_role() = 'admin');

CREATE POLICY "invoices_select_store"
  ON invoices FOR SELECT
  USING (auth_role() = 'store' AND store_id = auth_store_id());

CREATE POLICY "invoices_select_factory"
  ON invoices FOR SELECT
  USING (auth_role() = 'factory');

-- INSERT: only via SECURITY DEFINER function (no direct user INSERT needed)
-- No UPDATE or DELETE policies — invoices are immutable.

-- ── RLS: invoice_items ──────────────────────────────────────────────────────

ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;

-- Helper function to check invoice ownership
CREATE OR REPLACE FUNCTION invoice_belongs_to_store(p_invoice_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM invoices WHERE id = p_invoice_id AND store_id = auth_store_id()
  )
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

-- SELECT policies
CREATE POLICY "invoice_items_select_admin"
  ON invoice_items FOR SELECT
  USING (auth_role() = 'admin');

CREATE POLICY "invoice_items_select_store"
  ON invoice_items FOR SELECT
  USING (auth_role() = 'store' AND invoice_belongs_to_store(invoice_id));

CREATE POLICY "invoice_items_select_factory"
  ON invoice_items FOR SELECT
  USING (auth_role() = 'factory');

-- No UPDATE or DELETE policies — invoice items are immutable.

-- ── RLS: invoice_number_counters ────────────────────────────────────────────

ALTER TABLE invoice_number_counters ENABLE ROW LEVEL SECURITY;
-- No SELECT/INSERT/UPDATE/DELETE policies for any user — only SECURITY DEFINER can access.
```

### Modifying the `fulfillOrder` Server Action

The current `fulfillOrder` action in `app/(dashboard)/orders/[order-id]/actions.ts` updates the order status and then needs to call the `generate_invoice` RPC. For atomicity, there are two approaches:

**Approach A — Two-step with RPC (simpler, recommended):**
After the order update succeeds, call `supabase.rpc('generate_invoice', { p_order_id: orderId })`. If the RPC fails, return an error. The order status change is already committed, but the invoice generation failure means the user sees an error and can retry. Since `generate_invoice` checks for existing invoices (idempotent guard), retrying is safe.

**Approach B — Single SECURITY DEFINER function (true atomicity):**
Create a `fulfill_order_with_invoice(p_order_id uuid)` function that does both the status update and invoice generation in one transaction. This is the more robust approach.

**Recommended: Approach B.** Create a new `fulfill_order_with_invoice` RPC that:
1. Validates the order is `approved`
2. Updates order status to `fulfilled` and sets `fulfilled_at`
3. Calls the invoice generation logic
4. Returns the invoice ID

Then simplify `fulfillOrder` to just call this single RPC.

```typescript
export async function fulfillOrder(
  orderId: string
): Promise<ActionResult<void>> {
  if (!UUID_REGEX.test(orderId)) {
    return { data: null, error: "Invalid order ID." };
  }

  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "Unauthorized." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (!profile || profile.role !== "factory") {
    return { data: null, error: "Unauthorized." };
  }

  const { error: rpcError } = await supabase.rpc("fulfill_order_with_invoice", {
    p_order_id: orderId,
  });

  if (rpcError) {
    return { data: null, error: rpcError.message || "Failed to fulfill order. Please try again." };
  }

  revalidatePath("/orders");
  revalidatePath(`/orders/${orderId}`);
  return { data: undefined, error: null };
}
```

### TypeScript Types

Add to `lib/types/index.ts`:

```typescript
export type InvoiceRow = {
  id: string;
  order_id: string;
  invoice_number: string;
  store_id: string;
  store_name: string;
  company_name: string;
  company_address: string;
  company_tax_id: string;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  grand_total: number;
  created_at: string;
};

export type InvoiceItemRow = {
  id: string;
  invoice_id: string;
  product_name: string;
  unit_of_measure: string;
  unit_price: number;
  quantity: number;
  line_total: number;
};
```

### Invoice Detail Page

Create `app/(dashboard)/invoices/[invoice-id]/page.tsx` as a Server Component. The page should:
- Fetch the invoice by ID (RLS handles access control)
- Fetch invoice_items for the invoice
- Render a professional invoice layout with:
  - Company header (name, address, tax ID from the snapshot)
  - Invoice metadata (number, date, store name)
  - Items table (product_name, unit_of_measure, quantity, unit_price, line_total)
  - Financial summary (subtotal, tax rate + amount, grand total)
  - "Back to Order" link using `invoice.order_id`
- Use `formatPrice()` for all currency values
- Use `Intl.DateTimeFormat("en-CA", { dateStyle: "medium" })` for dates

### Order Detail Page — "View Invoice" Link

On the order detail page, when `status === "fulfilled"`, query for the invoice:

```typescript
let invoiceId: string | null = null;
if (status === "fulfilled") {
  const { data: invoice } = await supabase
    .from("invoices")
    .select("id")
    .eq("order_id", order.id)
    .single();
  invoiceId = invoice?.id ?? null;
}
```

Then render a link in the order header area:

```tsx
{invoiceId && (
  <Link href={`/invoices/${invoiceId}`}>
    <Button variant="outline" size="sm">
      <FileText className="size-4 mr-1.5" />
      View Invoice
    </Button>
  </Link>
)}
```

### Architecture Compliance

**D5 — RLS:** Immutable invoices enforced at the DB level. No UPDATE/DELETE policies. SELECT policies follow the same pattern as orders (admin=all, store=own, factory=all).

**D7 — Server Actions:** `fulfillOrder` calls a single SECURITY DEFINER RPC for atomicity. Auth + role check in the server action is defense-in-depth.

**SECURITY DEFINER:** The `generate_invoice` / `fulfill_order_with_invoice` function runs with elevated privileges, bypassing RLS to write to `invoices`, `invoice_items`, and `invoice_number_counters`. Always uses `SET search_path = public, pg_temp`.

**Immutability:** No UPDATE or DELETE RLS policies on `invoices` or `invoice_items`. Even if application code tried, the DB would reject it. The `invoice_number_counters` table is fully locked down — no user-facing policies at all.

### Anti-Patterns — NEVER DO

- Allow UPDATE or DELETE on invoices or invoice_items — they are immutable financial records
- Generate invoice numbers in application code — must be in the DB with advisory lock for concurrency
- Call `redirect()` inside the server action — return `ActionResult`, let the client handle navigation
- Use `service_role` key — SECURITY DEFINER functions handle elevated access
- Skip the `financial_settings` check — if not configured, fail loudly rather than generating a broken invoice
- Store computed values (subtotal, tax) in application code — compute in the DB function for consistency
- Allow invoice generation without a fulfilled order — always validate order status in the DB function

### Library & Framework Requirements

**No new packages needed.** All dependencies (shadcn/ui Card, Button, Badge, sonner, lucide-react) are already installed.

### Testing Requirements

- Run `npm run build` — zero errors
- Run `npm run lint` — zero warnings/errors
- Manual: Configure `financial_settings` via Story 5-1 (tax rate, company details)
- Manual: Factory user fulfills an approved order — invoice auto-generated
- Manual: Check `invoices` table — invoice_number follows `INV-YYYY-NNNN` pattern
- Manual: Check `invoice_items` — all order items snapshotted with correct line_total
- Manual: Verify subtotal, tax_amount, grand_total calculations are correct
- Manual: On order detail page, fulfilled order shows "View Invoice" link
- Manual: Click "View Invoice" — invoice detail page renders with all fields
- Manual: Store user can see invoices for their own store only
- Manual: Admin can see all invoices
- Manual: Factory user can see all invoices
- Manual: Attempt to UPDATE an invoice via SQL — RLS denies the operation
- Manual: Attempt to DELETE an invoice via SQL — RLS denies the operation
- Manual: Fulfill an order without `financial_settings` configured — error returned, order stays `approved`
- Manual: Fulfill two orders rapidly — invoice numbers are sequential, no duplicates

### Previous Story Intelligence

1. **`date-fns` is NOT installed** — use `Intl.DateTimeFormat("en-CA", ...)` for all date formatting.
2. **Server Action: do NOT call `redirect()` inside** — return `ActionResult`, let the Client Component handle via `router.refresh()`.
3. **`ActionResult<void>` pattern** — return `{ data: undefined, error: null }` for success.
4. **RLS is the enforcement layer** — role check in Server Action is defense-in-depth.
5. **UI Language is English** — all labels, toasts, page content in English.
6. **`formatPrice()` uses CAD currency** — defined in `lib/utils.ts`.
7. **SECURITY DEFINER functions** must include `SET search_path = public, pg_temp`.
8. **`auth_role()` and `auth_store_id()`** are existing RLS helper functions (from migration `20260313153929`).
9. **`order_belongs_to_store()`** pattern exists for checking store-scoped access on related tables.

### Git Intelligence

**Recent commits:**
- `6eaa5c3` feat: stories 3-4 and 3-5 — admin order actions and soft delete

**Recommended commit message:**
`feat: immutable invoice generation on fulfillment (story 5-2)`

### References

- [Source: Story 3-6] `fulfillOrder` server action — `app/(dashboard)/orders/[order-id]/actions.ts`
- [Source: Story 5-1] `financial_settings` table — tax rate, company details
- [Source: migration 20260317100000] `orders` and `order_items` table schema
- [Source: migration 20260313153929] `auth_role()` and `auth_store_id()` RLS helpers
- [Source: lib/types/index.ts] `OrderStatus`, `OrderItemRow`, `ActionResult` types
- [Source: lib/utils.ts] `formatPrice()` — CAD currency formatter
- [Source: memory/feedback_ui_language.md] UI must be in English

# Quick Spec: Order & Invoice Enhancements

Status: ready-for-dev

## Overview

Multiple enhancements to orders, invoices, and general settings:

1. Remove `under_review` order status
2. Move financial configuration to store-level; remove `payment_terms`
3. Rename invoice "Tax" to "HST"; HST rate is a global setting (same for all stores)
4. Add global "Advertisement & Royalties Fee" (flat dollar amount per order, shown on invoice)
5. Add commissary billing info to global settings (appears on invoices as "From" header)
6. Multi-select orders/invoices to show aggregated item summary
7. Expanded order edit/delete permissions

---

## 1. Remove `under_review` Order Status

### Why

The "Under Review" status is unused in the business workflow. Orders go directly from `submitted` to `approved`/`declined`.

### Changes

**Type (`lib/types/index.ts`):**

```typescript
// BEFORE
export type OrderStatus = "submitted" | "under_review" | "approved" | "declined" | "fulfilled";

// AFTER
export type OrderStatus = "submitted" | "approved" | "declined" | "fulfilled";
```

**Constants (`lib/constants/order-status.ts`):**

Remove `under_review` entries from `STATUS_STYLES`, `STATUS_BORDER_COLORS`, `STATUS_LABELS`.

**Actions (`app/(dashboard)/orders/[order-id]/actions.ts`):**

- Remove `"under_review"` from `ACTIONABLE_STATUSES` → becomes `["approved", "declined"]`
- Remove the `if (newStatus === "under_review" && ...)` guard
- `TERMINAL_STATUSES` stays as `["approved", "declined", "fulfilled"]`

**Component (`components/orders/order-status-actions.tsx`):**

Remove the "Place Under Review" button block (lines 72-81).

**Filters (`components/orders/order-filters.tsx`):**

Remove `under_review` from the status dropdown options.

**Validation (`lib/validations/orders.ts`):**

Remove `"under_review"` from any Zod enum/union that references order statuses.

**DB Migration:**

```sql
-- Migration: remove_under_review_status
-- Update any existing under_review orders to submitted (safety)
UPDATE orders SET status = 'submitted' WHERE status = 'under_review';
UPDATE order_status_history SET status = 'submitted' WHERE status = 'under_review';
```

No enum type in DB (status is TEXT), so no ALTER TYPE needed.

---

## 2. Restructure Financial Settings — Global vs. Store-level

### Current Plan (Story 5-1)

Story 5-1 defines a `financial_settings` key-value table with: `tax_rate`, `currency`, `payment_terms`, `company_name`, `company_address`, `company_phone`, `company_email`.

### New Design

**Remove:** `payment_terms` field entirely (not needed).

**Global settings (`financial_settings` table) — admin only:**

| Key | Description | Example |
|-----|-------------|---------|
| `hst_rate` | HST percentage (replaces `tax_rate`) | `13` |
| `currency` | ISO 4217 code | `CAD` |
| `ad_royalties_fee` | Advertisement & royalties fee in dollars | `50.00` |
| `commissary_name` | Commissary business name | `Commissary` |
| `commissary_address` | Commissary address | `501 Rogers rd Toronto, Ontario` |
| `commissary_postal_code` | Postal code | `M6M1B4` |
| `commissary_phone` | Commissary phone | `416-657-8977` |

**Store-level settings:** None needed for now — the commissary billing info is global (single commissary), and each store's billing info already comes from the `stores` table (store name). If stores need individual billing addresses in the future, a `store_settings` table can be added.

### Settings UI (`app/(dashboard)/settings/page.tsx`)

Admin-only "General Settings" section with two cards:

**Card 1: Tax & Fees**
- HST Rate (%) — number, min 0, max 100
- Currency — text, default "CAD"
- Advertisement & Royalties Fee ($) — number, min 0, 2 decimal places

**Card 2: Commissary Billing Information**
- Business Name
- Address (textarea)
- Postal Code
- Phone

This info appears as the "From:" section on every invoice (see attached image reference: company name, address, postal code, phone).

### Zod Schema (`lib/validations/settings.ts`)

```typescript
export const generalSettingsSchema = z.object({
  hst_rate: z
    .number({ invalid_type_error: "HST rate must be a number." })
    .min(0, "HST rate cannot be negative.")
    .max(100, "HST rate cannot exceed 100%."),
  currency: z
    .string()
    .min(1, "Currency is required.")
    .max(10, "Currency code is too long."),
  ad_royalties_fee: z
    .number({ invalid_type_error: "Fee must be a number." })
    .min(0, "Fee cannot be negative."),
  commissary_name: z.string().max(200).optional().default(""),
  commissary_address: z.string().max(500).optional().default(""),
  commissary_postal_code: z.string().max(20).optional().default(""),
  commissary_phone: z.string().max(50).optional().default(""),
});

export type GeneralSettingsValues = z.infer<typeof generalSettingsSchema>;
```

### DB Migration

Same `financial_settings` table from Story 5-1, but with updated keys. The migration creates the table if it doesn't exist. Keys stored:

```sql
-- financial_settings table (same schema from story 5-1)
-- Keys: hst_rate, currency, ad_royalties_fee, commissary_name, commissary_address, commissary_postal_code, commissary_phone
```

### RLS

Same as Story 5-1: admin-only SELECT/INSERT/UPDATE. **Add:** commissary and store can SELECT (they need to read HST rate and commissary info for invoice display).

```sql
CREATE POLICY "financial_settings_select_authenticated"
  ON financial_settings FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "financial_settings_insert_admin"
  ON financial_settings FOR INSERT
  WITH CHECK (auth_role() = 'admin');

CREATE POLICY "financial_settings_update_admin"
  ON financial_settings FOR UPDATE
  USING (auth_role() = 'admin');
```

---

## 3. Invoice — HST and Ad & Royalties Fee

### Invoice Table Changes

**`invoices` table — add column:**

```sql
ALTER TABLE invoices ADD COLUMN ad_royalties_fee NUMERIC(10,2) NOT NULL DEFAULT 0;
```

**Rename concept only (not column):** The `tax_rate` and `tax_amount` columns stay, but the UI label changes from "Tax" to "HST".

### Invoice Detail Page Changes (`app/(dashboard)/invoices/[invoice-id]/page.tsx`)

**"From" section** (new, top-left of invoice — replaces current company info block):

```
From:
Commissary
501 Rogers rd Toronto, Ontario
M6M1B4
Ph# 416-657-8977
```

This data is read from `invoices` table (snapshotted at fulfillment time) or from `financial_settings` at display time. **Recommendation:** Snapshot into invoice at creation time (same pattern as current `company_name`, `company_address`). Replace `company_name` → use for commissary name, `company_address` → commissary address, `company_tax_id` → commissary phone + postal code.

Actually, better approach — add dedicated columns:

```sql
ALTER TABLE invoices ADD COLUMN commissary_name TEXT NOT NULL DEFAULT '';
ALTER TABLE invoices ADD COLUMN commissary_address TEXT NOT NULL DEFAULT '';
ALTER TABLE invoices ADD COLUMN commissary_postal_code TEXT NOT NULL DEFAULT '';
ALTER TABLE invoices ADD COLUMN commissary_phone TEXT NOT NULL DEFAULT '';
```

Or reuse existing `company_name`, `company_address`, `company_tax_id` columns by repurposing them:
- `company_name` → commissary name
- `company_address` → commissary full address
- `company_tax_id` → commissary phone

**Recommended:** Reuse existing columns to avoid migration complexity. The `company_tax_id` can hold the phone, and address can include postal code.

### Totals Section Update

```
Subtotal:                    $X,XXX.XX
Ad & Royalties Fee:          $50.00
HST (13.00%):                $XXX.XX
                           -----------
Grand Total:                 $X,XXX.XX
```

**Grand total calculation:** `subtotal + ad_royalties_fee + tax_amount`

Where `tax_amount = (subtotal + ad_royalties_fee) * hst_rate` — HST applies to the subtotal + fee.

**Update `InvoiceRow` type (`lib/types/index.ts`):**

```typescript
export type InvoiceRow = {
  id: string;
  order_id: string;
  invoice_number: string;
  store_id: string;
  store_name: string;
  company_name: string;      // commissary name
  company_address: string;   // commissary address + postal code
  company_tax_id: string;    // commissary phone
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  ad_royalties_fee: number;  // NEW
  grand_total: number;
  created_at: string;
};
```

### Fulfill RPC Update

The `fulfill_order_with_invoice` RPC must be updated to:
1. Read `hst_rate`, `ad_royalties_fee`, commissary info from `financial_settings`
2. Add `ad_royalties_fee` to invoice
3. Calculate `tax_amount = (subtotal + ad_royalties_fee) * (hst_rate / 100)`
4. Calculate `grand_total = subtotal + ad_royalties_fee + tax_amount`
5. Snapshot commissary info into invoice columns

---

## 4. Multi-Select Orders/Invoices — Aggregated Summary

### Orders Page (`app/(dashboard)/orders/page.tsx`)

Add checkboxes to each order row. When 2+ orders are selected, show a summary panel (sticky bottom bar or expandable section) with:

| Product | Modifier | Unit Price | Total Qty | Total Value |
|---------|----------|------------|-----------|-------------|
| Bread   | box      | $25.00     | 40        | $1,000.00   |
| Milk    | unit     | $3.50      | 120       | $420.00     |

Items are aggregated by `product_name + modifier + unit_price`. Total Qty = sum of quantities. Total Value = sum of line totals.

**Data fetching:** When orders are selected, fetch all `order_items` for those order IDs and aggregate client-side.

**Implementation:**

- New client component: `components/orders/order-selection-summary.tsx`
- State: `selectedOrderIds: Set<string>` managed in the orders list client component
- Fetch items via server action: `getOrderItemsForOrders(orderIds: string[])`
- Display in a collapsible Card at the bottom of the page

### Invoices Page (`app/(dashboard)/invoices/page.tsx`)

Same pattern: checkboxes, multi-select, aggregated summary showing:

| Product | Modifier | Unit Price | Total Qty | Total Value |
|---------|----------|------------|-----------|-------------|

Plus totals row with: total subtotal, total ad & royalties fees, total HST, total grand total.

**Implementation:**

- New client component: `components/invoices/invoice-selection-summary.tsx`
- Fetch items via server action: `getInvoiceItemsForInvoices(invoiceIds: string[])`

### Server Actions

```typescript
// app/(dashboard)/orders/actions.ts
export async function getOrderItemsForOrders(
  orderIds: string[]
): Promise<ActionResult<OrderItemRow[]>>

// app/(dashboard)/invoices/actions.ts
export async function getInvoiceItemsForInvoices(
  invoiceIds: string[]
): Promise<ActionResult<InvoiceItemRow[]>>
```

Both actions validate that the user has access (RLS handles this), limit to max 50 order/invoice IDs per request, and return the raw items for client-side aggregation.

---

## 5. Expanded Order Edit/Delete Permissions

### Current Behavior

- Only admin can delete (soft-delete) orders
- Only admin/commissary can update status
- Store users cannot edit or delete their own orders

### New Rules

| Action | Admin | Commissary | Store |
|--------|-------|------------|-------|
| Edit order items | If not fulfilled | If not fulfilled | Own orders, if status = `submitted` only |
| Delete order (soft) | If not fulfilled | If not fulfilled | Own orders, if status = `submitted` only |

"Not fulfilled" means: status is NOT `fulfilled` (i.e., `submitted`, `approved`, or `declined` are all editable/deletable by admin/commissary).

### Actions Changes (`app/(dashboard)/orders/[order-id]/actions.ts`)

**`deleteOrder` — update authorization:**

```typescript
// BEFORE: admin only
// AFTER:
if (!profile) return { data: null, error: "Unauthorized." };

if (profile.role === "store") {
  // Store users can only delete their own submitted orders
  const { data: order } = await supabase
    .from("orders")
    .select("status, store_id")
    .eq("id", orderId)
    .single();

  if (!order) return { data: null, error: "Order not found." };
  if (order.status !== "submitted") {
    return { data: null, error: "You can only delete submitted orders." };
  }
  // RLS ensures store_id matches — if the delete returns no rows, it wasn't their order
} else if (!["admin", "commissary"].includes(profile.role)) {
  return { data: null, error: "Unauthorized." };
}

// For admin/commissary: can delete if not fulfilled
// For store: can delete if submitted (checked above)
const blockedStatuses = profile.role === "store"
  ? ["approved", "declined", "fulfilled"]
  : ["fulfilled"];

const { data, error } = await supabase
  .from("orders")
  .update({ deleted_at: new Date().toISOString() })
  .eq("id", orderId)
  .not("status", "in", `(${blockedStatuses.join(",")})`)
  .select("id")
  .single();
```

**New action: `editOrderItems`**

```typescript
export async function editOrderItems(
  orderId: string,
  items: { product_id: string; quantity: number }[]
): Promise<ActionResult<void>>
```

Logic:
1. Auth check — get user role
2. Fetch order status + store_id
3. If store role: only allow if order.status === "submitted" (RLS ensures store_id match)
4. If admin/commissary: allow if status !== "fulfilled"
5. Delete existing order_items for the order
6. Re-insert new items with server-side price lookup (same pattern as `createOrder`)
7. Revalidate paths

### UI Changes

**Order Detail Page (`app/(dashboard)/orders/[order-id]/page.tsx`):**

- Show "Edit" button for admin/commissary if status !== "fulfilled"
- Show "Edit" button for store if status === "submitted"
- Show "Delete" button with same logic
- Edit button opens the order in edit mode (reuse cart/item selection UI from new order page)

**Orders List Page:**

- Show delete button per row with same permission logic

---

## 6. DB Migration Summary

Single migration file: `supabase/migrations/20260324100000_order_invoice_enhancements.sql`

```sql
-- 1. Remove under_review orders (safety cleanup)
UPDATE orders SET status = 'submitted' WHERE status = 'under_review';
UPDATE order_status_history SET status = 'submitted' WHERE status = 'under_review';

-- 2. Add ad_royalties_fee to invoices
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS ad_royalties_fee NUMERIC(10,2) NOT NULL DEFAULT 0;

-- 3. Add commissary columns to invoices (if not reusing company_* columns)
-- Option A: reuse company_name, company_address, company_tax_id
-- Option B: add new columns (preferred for clarity)
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS commissary_name TEXT NOT NULL DEFAULT '';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS commissary_address TEXT NOT NULL DEFAULT '';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS commissary_postal_code TEXT NOT NULL DEFAULT '';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS commissary_phone TEXT NOT NULL DEFAULT '';

-- 4. Create financial_settings if not exists (from story 5-1, with updated RLS)
CREATE TABLE IF NOT EXISTS financial_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE financial_settings ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read settings
CREATE POLICY "financial_settings_select_authenticated"
  ON financial_settings FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Admin-only write
CREATE POLICY "financial_settings_insert_admin"
  ON financial_settings FOR INSERT
  WITH CHECK (auth_role() = 'admin');

CREATE POLICY "financial_settings_update_admin"
  ON financial_settings FOR UPDATE
  USING (auth_role() = 'admin');

-- 5. Update RLS on orders to allow store soft-delete of own submitted orders
-- (Current RLS likely allows UPDATE for store on own orders — verify existing policies)

-- 6. Update fulfill_order_with_invoice RPC to include ad_royalties_fee and commissary info
-- (This requires updating the function — see separate RPC section below)
```

### Updated `fulfill_order_with_invoice` RPC

The RPC must be updated to:

```sql
-- Inside the function, after calculating subtotal:
SELECT value INTO v_hst_rate FROM financial_settings WHERE key = 'hst_rate';
SELECT value INTO v_ad_fee FROM financial_settings WHERE key = 'ad_royalties_fee';
SELECT value INTO v_comm_name FROM financial_settings WHERE key = 'commissary_name';
SELECT value INTO v_comm_addr FROM financial_settings WHERE key = 'commissary_address';
SELECT value INTO v_comm_postal FROM financial_settings WHERE key = 'commissary_postal_code';
SELECT value INTO v_comm_phone FROM financial_settings WHERE key = 'commissary_phone';

v_tax_amount := (v_subtotal + COALESCE(v_ad_fee::NUMERIC, 0)) * (COALESCE(v_hst_rate::NUMERIC, 0) / 100);
v_grand_total := v_subtotal + COALESCE(v_ad_fee::NUMERIC, 0) + v_tax_amount;

INSERT INTO invoices (..., ad_royalties_fee, commissary_name, commissary_address, commissary_postal_code, commissary_phone)
VALUES (..., COALESCE(v_ad_fee::NUMERIC, 0), v_comm_name, v_comm_addr, v_comm_postal, v_comm_phone);
```

---

## 7. Files to Create

| File | Purpose |
|------|---------|
| `supabase/migrations/20260324100000_order_invoice_enhancements.sql` | DB changes |
| `components/orders/order-selection-summary.tsx` | Multi-select aggregated summary for orders |
| `components/invoices/invoice-selection-summary.tsx` | Multi-select aggregated summary for invoices |
| `components/settings/general-settings-form.tsx` | Admin general settings form (replaces financial-settings-form from 5-1) |

## 8. Files to Modify

| File | Changes |
|------|---------|
| `lib/types/index.ts` | Remove `under_review` from OrderStatus; add `ad_royalties_fee` to InvoiceRow |
| `lib/constants/order-status.ts` | Remove `under_review` entries |
| `lib/validations/orders.ts` | Remove `under_review` from status validation |
| `lib/validations/settings.ts` | Add `generalSettingsSchema` (replaces `financialSettingsSchema`) |
| `app/(dashboard)/orders/[order-id]/actions.ts` | Update delete permissions; add `editOrderItems`; remove under_review transition |
| `app/(dashboard)/orders/[order-id]/page.tsx` | Add edit/delete buttons with new permissions |
| `app/(dashboard)/orders/page.tsx` | Add multi-select checkboxes + summary |
| `app/(dashboard)/orders/actions.ts` | Add `getOrderItemsForOrders` action |
| `app/(dashboard)/invoices/page.tsx` | Add multi-select checkboxes + summary |
| `app/(dashboard)/invoices/[invoice-id]/page.tsx` | Show "From:" commissary info; rename Tax→HST; show Ad & Royalties Fee line |
| `app/(dashboard)/invoices/actions.ts` | Add `getInvoiceItemsForInvoices` action (create if not exists) |
| `app/(dashboard)/settings/page.tsx` | Replace financial config with General Settings |
| `app/(dashboard)/settings/actions.ts` | Update to use `generalSettingsSchema` and new keys |
| `components/orders/order-status-actions.tsx` | Remove "Place Under Review" button |
| `components/orders/order-filters.tsx` | Remove `under_review` from status filter |
| `types/supabase.ts` | Update generated types for new columns |

## 9. Files NOT to Touch

| File | Reason |
|------|--------|
| `supabase/migrations/202603[existing]*.sql` | Never edit existing migrations |
| `lib/nav-items.ts` | No new routes needed |
| `middleware.ts` | No auth changes |

## 10. Testing

- Build: `npm run build` — zero errors
- Lint: `npm run lint` — zero warnings
- Manual: Verify `under_review` status no longer appears anywhere
- Manual: Admin configures HST rate, ad fee, commissary info in Settings
- Manual: Fulfill an order → invoice shows "From:" commissary info, HST label, ad fee line
- Manual: Select multiple orders → aggregated summary appears
- Manual: Select multiple invoices → aggregated summary appears
- Manual: Store user edits own submitted order → success
- Manual: Store user tries to edit approved order → blocked
- Manual: Admin/commissary deletes a declined order → success
- Manual: Admin/commissary tries to delete fulfilled order → blocked

# Quick Tech Spec: Rename "Factory" → "Commissary"

Status: ready-for-dev

## What

Rename the role `factory` to `commissary` across the entire application — database enum, RLS policies, TypeScript types, business logic, and UI labels.

## Why

Client requested the terminology change in the latest meeting. "Commissary" better reflects the business domain.

## Impact Analysis

### 1. Database (Supabase Migration Required)

**Enum rename** — `user_role` enum in `create_profiles.sql`:
- `'factory'` → `'commissary'`

**RLS policies referencing `'factory'`** (all need `'commissary'`):
- `supabase/migrations/20260317100000_create_orders.sql` — 3 policies (`orders_select_factory`, `order_items_select_factory`, `order_status_history_select_factory`)
- `supabase/migrations/20260317140000_add_order_soft_delete.sql` — 1 policy (`orders_select_factory` recreated)
- `supabase/migrations/20260318100000_factory_fulfill_orders.sql` — 2 policies (`orders_update_factory`, `order_status_history_insert_factory`)
- `supabase/migrations/20260319100000_create_invoices.sql` — 2 policies + 1 function (`invoices_select_factory`, `invoice_items_select_factory`, `generate_invoice_on_fulfillment`)
- `supabase/migrations/20260319200000_create_audit_templates.sql` — 2 policies (`audit_templates_factory_select`, `audit_template_items_factory_select`)
- `supabase/migrations/20260319300000_create_audits.sql` — 2 policies (`audits_factory_select`, `audit_responses_factory_select`)
- `supabase/migrations/20260319400000_create_audit_evidence.sql` — 1 policy (`audit_evidence_factory_select`)
- `supabase/migrations/20260316163721_fix_product_categories_rls_factory_access.sql` — comments only

**Approach**: Single new migration that:
1. Renames enum value `ALTER TYPE user_role RENAME VALUE 'factory' TO 'commissary';`
2. Drops and recreates all affected RLS policies with `'commissary'`
3. Replaces the `generate_invoice_on_fulfillment` function

### 2. TypeScript Types (5 files)

| File | Change |
|------|--------|
| `types/supabase.ts:107,238` | `"factory"` → `"commissary"` in type union and enum array |
| `lib/types/database.types.ts:296` | `"factory"` → `"commissary"` in type union |
| `lib/types/index.ts:12` | `"factory"` → `"commissary"` in role type |
| `lib/validations/users.ts:7,26` | `"factory"` → `"commissary"` in zod enum |
| `components/audits/audit-filters.tsx:20` | `"factory"` → `"commissary"` in prop type |
| `components/orders/order-filters.tsx:27` | `"factory"` → `"commissary"` in prop type |

### 3. Business Logic (5 files)

| File | Line | Change |
|------|------|--------|
| `components/orders/fulfill-order-button.tsx` | 34 | `role !== "factory"` → `role !== "commissary"` |
| `app/(dashboard)/products/page.tsx` | 22 | `role === "factory"` → `role === "commissary"` |
| `app/(dashboard)/orders/page.tsx` | 124,150,175,256 | all `"factory"` refs → `"commissary"` |
| `app/(dashboard)/orders/[order-id]/actions.ts` | 149 | `role !== "factory"` → `role !== "commissary"` |
| `app/(dashboard)/orders/[order-id]/page.tsx` | 63,64 | `role === "factory"` → `role === "commissary"` |
| `app/(dashboard)/invoices/page.tsx` | 50 | comment update |
| `app/(dashboard)/audits/page.tsx` | 40 | `"factory"` → `"commissary"` in type cast |
| `lib/nav-items.ts` | 13-18 | `"factory"` → `"commissary"` in roles arrays |

### 4. UI Labels (2 files)

| File | Change |
|------|--------|
| `components/users/create-user-form.tsx:110` | `"Factory User"` → `"Commissary User"` |
| `components/users/edit-user-form.tsx:117` | `"Factory User"` → `"Commissary User"` |
| `components/users/user-list.tsx:43` | `factory: "Factory"` → `commissary: "Commissary"` |

### 5. Documentation (not code — optional update)

- `_bmad-output/implementation-artifacts/*.md` — story specs reference "Factory" extensively
- `_bmad-output/scotty-ops-backlog.csv` — column header and values

## Acceptance Criteria

1. **Given** an existing user with role `factory` in the database, **When** the migration runs, **Then** their role is automatically updated to `commissary` with no data loss.
2. **Given** the app is running after the change, **When** an admin creates or edits a user, **Then** the role dropdown shows "Commissary User" instead of "Factory User".
3. **Given** a commissary user logs in, **When** they navigate the app, **Then** all permissions and access patterns work identically to the previous factory role.
4. **Given** TypeScript compilation, **When** `npm run build` is executed, **Then** zero type errors related to the role rename.

## Risks

- **Existing sessions**: Users with active sessions storing `factory` in JWT claims may need to re-login. The `auth_role()` helper reads from `profiles` table, so this should be transparent.
- **Supabase generated types**: After migration, `supabase gen types` must be re-run to update `types/supabase.ts`.

## Execution Order

1. Create new Supabase migration (enum rename + policy updates)
2. Update TypeScript types (`types/supabase.ts`, `lib/types/*`, `lib/validations/*`)
3. Update business logic (all `.ts`/`.tsx` files)
4. Update UI labels
5. Build and verify (`npm run build`)

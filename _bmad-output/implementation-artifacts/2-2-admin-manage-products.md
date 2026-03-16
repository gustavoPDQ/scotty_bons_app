# Story 2.2: Admin — Manage Products

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an Admin,
I want to create, edit, and delete products with name, price, unit of measure, and category,
so that the catalog accurately reflects what Store Users can order from the supply facility.

## Acceptance Criteria

1. **Given** an Admin navigates to the products list within a category,
   **When** the page loads,
   **Then** all products in that category are displayed with name, price, unit of measure, and category name.

2. **Given** an Admin clicks "New Product",
   **When** they fill in name, price (numeric), unit of measure, and category, and submit,
   **Then** the product is created and appears in the catalog under the selected category.

3. **Given** an Admin submits the new product form with any required field empty,
   **When** validation runs,
   **Then** the relevant fields are highlighted with error messages and the product is not created.

4. **Given** an Admin clicks "Edit" on an existing product,
   **When** they update any field (name, price, unit, category) and save,
   **Then** the product is updated immediately in the catalog.

5. **Given** an Admin updates a product's price,
   **When** the change is saved,
   **Then** the new price applies to all future orders — existing submitted or approved orders retain the price at the time they were created.

6. **Given** an Admin clicks "Delete" on a product,
   **When** they confirm the deletion,
   **Then** the product is removed from the catalog and no longer available for new orders.

7. **Given** a Factory User is authenticated and navigates to any catalog URL,
   **When** the request is processed,
   **Then** access is denied at the database level via RLS (`auth_role() IN ('admin', 'store')`) — the Factory User receives no catalog data even on direct API calls; no catalog edit controls are ever rendered in their session (FR16, NFR9).

### Clarification: "Active Status" in AC #1

The epics file mentions "active status" in AC #1, but the DB schema for `products` does **not** include an `is_active` column. The schema is: `id`, `name`, `price`, `unit_of_measure`, `category_id`, `created_at`, `updated_at`. Since AC #6 defines deletion as hard-delete (product removed from catalog), all products in the table are implicitly active. **Do NOT add an `is_active` column** — treat all existing products as active. Display the category name instead of "active status" in the product list UI.

## Tasks / Subtasks

- [x] Task 1 — Create `products` table migration (AC: #1, #2, #5, #7)
  - [x] Run `npx supabase migration new create_products` from `scotty-ops/scotty-ops/`
  - [x] Create table: `id` (uuid PK default gen_random_uuid()), `name` (text NOT NULL), `price` (numeric(10,2) NOT NULL), `unit_of_measure` (text NOT NULL), `category_id` (uuid FK → product_categories NOT NULL), `created_at` (timestamptz NOT NULL DEFAULT now()), `updated_at` (timestamptz NOT NULL DEFAULT now())
  - [x] Add `updated_at` trigger using existing `update_updated_at_column()` function
  - [x] Enable RLS on `products`
  - [x] Add RLS policies: SELECT for `auth_role() IN ('admin', 'store')`, INSERT/UPDATE/DELETE for `auth_role() = 'admin'`
  - [x] Add index on `category_id` for efficient joins

- [x] Task 2 — Add `ProductRow` type and update `CategoryRow` (AC: #1)
  - [x] Add `ProductRow` to `lib/types/index.ts`: `{ id: string; name: string; price: number; unit_of_measure: string; category_id: string; category_name?: string }`
  - [x] Keep existing `CategoryRow` as-is (product_count already defined)

- [x] Task 3 — Add product Zod validation schemas (AC: #2, #3, #4)
  - [x] Add to `lib/validations/products.ts`: `createProductSchema` and `updateProductSchema`
  - [x] Fields: name (string, trim, min 2, max 200), price (number, positive, max 99999999.99), unit_of_measure (string, trim, min 1, max 50), category_id (string, uuid)
  - [x] Export types: `CreateProductValues`, `UpdateProductValues`

- [x] Task 4 — Add product Server Actions (AC: #2, #4, #5, #6)
  - [x] Add to `app/(dashboard)/products/actions.ts`: `createProduct`, `updateProduct`, `deleteProduct`
  - [x] All actions use existing `verifyAdmin()` pattern
  - [x] `createProduct`: validate with Zod → insert into products → select with category join → return `ActionResult<ProductRow>`
  - [x] `updateProduct`: validate ID + fields → update → return `ActionResult<null>`
  - [x] `deleteProduct`: validate ID → delete → return `ActionResult<null>`
  - [x] Handle unique constraint violations if name+category combo should be unique (optional — not in schema)

- [x] Task 5 — Update Products page to show products per category (AC: #1)
  - [x] In `app/(dashboard)/products/page.tsx`: query `products` table joined with `product_categories` to get product counts
  - [x] Replace hardcoded `product_count: 0` with actual count from products table
  - [x] Pass products data grouped by category to client component

- [x] Task 6 — Create ProductForm component (AC: #2, #3, #4)
  - [x] Create `components/products/product-form.tsx`
  - [x] React Hook Form + Zod resolver with `createProductSchema`
  - [x] Fields: name (Input), price (Input type="number" step="0.01"), unit_of_measure (Input), category_id (Select dropdown)
  - [x] Accept `categories` prop for the dropdown options
  - [x] Accept optional `product` prop for edit mode (pre-fill values)
  - [x] Follow `CategoryForm` pattern: `useTransition`, `toast.success/error`, `onSuccess` callback

- [x] Task 7 — Create ProductsClient component with CRUD UI (AC: #1, #2, #4, #6)
  - [x] Create `components/products/products-client.tsx`
  - [x] Display products in a list/table within each category section
  - [x] Show: name, price (formatted as currency), unit of measure, category name
  - [x] Admin controls: "New Product" button → Dialog with ProductForm
  - [x] Per-product: DropdownMenu with Edit and Delete actions
  - [x] Edit → Dialog with ProductForm (pre-filled)
  - [x] Delete → AlertDialog confirmation with destructive styling
  - [x] Follow `CategoriesClient` patterns exactly: `useTransition`, `router.refresh()`, `toast`

- [x] Task 8 — Integrate products into the Products page layout (AC: #1)
  - [x] Update `page.tsx` to render both CategoriesClient and ProductsClient
  - [x] Or: extend CategoriesClient to show expandable product lists per category
  - [x] Design decision: flat product list with category column OR products nested under categories — recommend flat list for admin management simplicity

- [x] Task 9 — Verify Factory User access denial (AC: #7)
  - [x] Confirm existing page-level redirect for factory users still works
  - [x] Confirm RLS on `products` table blocks factory user queries
  - [x] No additional nav-items changes needed (already restricted to admin/store from Story 2-1)

- [x] Task 10 — Build and lint verification (AC: all)
  - [x] Run `npm run build` from `scotty-ops/scotty-ops/`
  - [x] Run `npm run lint` from `scotty-ops/scotty-ops/`
  - [x] Fix any TypeScript or lint errors

## Dev Notes

### CRITICAL: This Story Creates New Code — Not a Bug-Fix Story Like 2-1

Unlike Story 2-1 which found most code pre-existing, this story requires creating the `products` table, server actions, validation schemas, and UI components from scratch. However, ALL patterns are established by the categories implementation — follow them exactly.

### Existing Codebase Patterns — MUST Follow

**Server Action pattern** (from `app/(dashboard)/products/actions.ts`):
1. `verifyAdmin()` — returns supabase client or null (returns the client to avoid double instantiation — this was a code review fix from Story 2-1)
2. UUID validation with `z.string().uuid()` for ID parameters
3. Zod `safeParse()` for input validation
4. Supabase query with **specific column selection** — NEVER `select('*')`
5. Error code `23505` handling for unique constraint violations
6. Returns `ActionResult<T>` — never throws

**Client Component pattern** (from `components/products/categories-client.tsx`):
1. `useTransition` for async action loading states — never manual `isLoading` state
2. `Dialog` from shadcn/ui for create/edit forms
3. `AlertDialog` for destructive confirmations with `className="bg-destructive text-destructive-foreground hover:bg-destructive/90"` on the action button
4. `DropdownMenu` for per-row actions (Edit, Delete)
5. `toast.success()` / `toast.error()` from sonner
6. `router.refresh()` after every mutation

**Form Component pattern** (from `components/products/category-form.tsx`):
1. React Hook Form with `zodResolver`
2. shadcn/ui `Form`, `FormField`, `FormItem`, `FormLabel`, `FormControl`, `FormMessage`
3. `useTransition` wrapping the server action call
4. `onSuccess` callback prop for parent Dialog control
5. `form.reset()` after successful submission

### Technical Requirements

**Database:**
- `numeric(10,2)` for price — NEVER use `float` or `real` for monetary values
- Foreign key `category_id` references `product_categories(id)` — add `ON DELETE RESTRICT` to prevent category deletion when products exist (this replaces the application-level check in `deleteCategory` with a DB-level guarantee)
- Add index `CREATE INDEX idx_products_category_id ON products(category_id)` for efficient category-scoped queries
- Use existing `update_updated_at_column()` trigger function for `updated_at`

**RLS Policies (MUST use `auth_role()` helper — NEVER inline subqueries per D5):**
```sql
-- SELECT: Admin and Store users can read products
CREATE POLICY "products_select_admin_store"
  ON products FOR SELECT
  USING (auth_role() IN ('admin', 'store'));

-- INSERT: Only Admins can create products
CREATE POLICY "products_insert_admin"
  ON products FOR INSERT
  WITH CHECK (auth_role() = 'admin');

-- UPDATE: Only Admins can update products
CREATE POLICY "products_update_admin"
  ON products FOR UPDATE
  USING (auth_role() = 'admin')
  WITH CHECK (auth_role() = 'admin');

-- DELETE: Only Admins can delete products
CREATE POLICY "products_delete_admin"
  ON products FOR DELETE
  USING (auth_role() = 'admin');
```

**Currency Display:**
- Format prices with `new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(value)`
- Use `en-CA` locale (English UI) — NOT `pt-BR`
- Price input: `<Input type="number" step="0.01" min="0.01">` — prevent zero or negative values

**Price Immutability for Existing Orders (AC #5):**
- This story does NOT need to implement order price snapshotting — that belongs to Epic 3 (Order Management) where `order_items` will store `unit_price` at the time of order creation
- Simply update the product price in the `products` table; order price isolation is handled by the order creation flow copying price at submission time
- **Do NOT add price history tracking or versioning** — out of scope

### Architecture Compliance

**D1 — Role Model:** Three roles (`admin`, `factory`, `store`). Only `admin` can CRUD products. `store` can read. `factory` has zero catalog access. Enforced at RLS + page redirect + nav items (already done in Story 2-1).

**D3 — Migration Strategy:** Run `npx supabase migration new create_products` to generate timestamped migration file. **NEVER edit existing migrations** — each story adds new migration files only. After migration, regenerate types with `supabase gen types typescript --local > types/supabase.ts` (requires Docker/Supabase running locally — if unavailable, manually add the `ProductRow` type and note that type regen was skipped).

**D5 — RLS Helper Functions:** All policies MUST use `auth_role()` — never `(SELECT role FROM profiles WHERE user_id = auth.uid())`. Both functions (`auth_role()`, `auth_store_id()`) are `SECURITY DEFINER` and `STABLE`.

**D7 — Server Actions:** All product mutations use Server Actions returning `ActionResult<T>`. Never throw errors to the client. Never return raw Supabase error objects.

**D9 — Error Handling:** Human-readable English error strings. Handle PostgreSQL error code `23503` (foreign key violation — invalid category_id) and `23505` (unique constraint if applicable). Generic fallback: "Failed to [action] product. Please try again."

**D11 — Form Handling:** React Hook Form + Zod. Schemas in `lib/validations/products.ts`. Same schema validates client-side (form) and server-side (Server Action).

**Anti-Patterns — NEVER DO:**
- `supabase.from('products').select('*')` — always select specific columns
- `throw new Error(...)` inside a Server Action
- Manual `isLoading` state — use `useTransition` instead
- `service_role` key in Server Actions — use the session-based client from `verifyAdmin()`
- Checking role in application code instead of relying on RLS (RLS is the primary guard; app-level checks are defense-in-depth only)

**Route Convention:** The codebase uses `/products` NOT `/catalog` (architecture doc says `/catalog` but codebase diverged in prior implementation). **Maintain `/products`** — do NOT rename.

### Library & Framework Requirements

**Already installed — use these exact packages (do NOT install alternatives):**

| Package | Purpose | Import |
|---------|---------|--------|
| `@supabase/ssr` | Server-side Supabase client | `import { createClient } from "@/lib/supabase/server"` |
| `zod` | Schema validation | `import { z } from "zod"` |
| `react-hook-form` | Form state management | `import { useForm } from "react-hook-form"` |
| `@hookform/resolvers` | Zod ↔ RHF bridge | `import { zodResolver } from "@hookform/resolvers/zod"` |
| `sonner` | Toast notifications | `import { toast } from "sonner"` |
| `lucide-react` | Icons | `import { Plus, Pencil, Trash2, MoreHorizontal, Package } from "lucide-react"` |
| `next/navigation` | Router, redirect | `import { useRouter } from "next/navigation"` / `import { redirect } from "next/navigation"` |

**shadcn/ui components — already installed, import from `@/components/ui/`:**
- `Button`, `Input`, `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogTrigger`
- `AlertDialog`, `AlertDialogAction`, `AlertDialogCancel`, `AlertDialogContent`, `AlertDialogDescription`, `AlertDialogFooter`, `AlertDialogHeader`, `AlertDialogTitle`
- `DropdownMenu`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuTrigger`
- `Form`, `FormControl`, `FormField`, `FormItem`, `FormLabel`, `FormMessage`
- `Card`, `CardContent`, `CardDescription`, `CardHeader`, `CardTitle`
- `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue` — for category dropdown in ProductForm

**Check if Select component is installed** — if `components/ui/select.tsx` does not exist, install via: `npx shadcn@latest add select`

**Do NOT install:**
- Any additional ORM (Prisma, Drizzle) — Supabase client is the data layer
- Any state management library (Redux, Zustand) — React state + Server Components suffice
- Any currency formatting library — use native `Intl.NumberFormat`
- Any table library (TanStack Table) — simple list/card layout sufficient for this story

### File Structure Requirements

**Files to CREATE:**

```
scotty-ops/scotty-ops/
├── supabase/migrations/<timestamp>_create_products.sql    — Products table + RLS policies
├── components/products/product-form.tsx                    — React Hook Form for create/edit product
├── components/products/products-client.tsx                 — Product list with CRUD UI (Admin)
```

**Files to MODIFY:**

```
scotty-ops/scotty-ops/
├── app/(dashboard)/products/page.tsx       — Query products, compute category counts, pass to components
├── app/(dashboard)/products/actions.ts     — Add createProduct, updateProduct, deleteProduct
├── lib/validations/products.ts             — Add createProductSchema, updateProductSchema + types
├── lib/types/index.ts                      — Add ProductRow type
├── types/supabase.ts                       — Regenerate (if Docker available) or skip with note
```

**Files NOT to touch (no changes needed):**

```
scotty-ops/scotty-ops/
├── components/products/categories-client.tsx   — Keep as-is; categories UI is complete from Story 2-1
├── components/products/category-form.tsx       — Keep as-is; category forms are complete
├── lib/nav-items.ts                            — Already correct (admin, store only) from Story 2-1
├── middleware.ts                                — No changes needed
├── lib/supabase/server.ts                      — No changes needed
├── lib/supabase/admin.ts                       — Do NOT use admin client for product CRUD (use session client via verifyAdmin)
```

**Naming Conventions (match existing codebase):**
- Migration: `<timestamp>_create_products.sql` (generated by `npx supabase migration new create_products`)
- Components: `kebab-case.tsx` — `product-form.tsx`, `products-client.tsx`
- Server Actions: `camelCase` functions — `createProduct`, `updateProduct`, `deleteProduct`
- Validation schemas: `camelCase` + `Schema` suffix — `createProductSchema`, `updateProductSchema`
- Types: `PascalCase` + `Row` suffix — `ProductRow`

### Testing Requirements

- Run `npm run build` — must pass with zero errors
- Run `npm run lint` — must pass with zero warnings/errors
- Manual verification: create, edit, delete a product via the UI
- Manual verification: confirm product count updates on category list
- Manual verification: Factory User cannot access `/products` (redirect to `/orders`)
- No automated E2E tests required for this story — QA automation is a separate optional workflow

### Previous Story Intelligence (from Story 2-1)

**Key learnings from Story 2-1 that MUST inform this implementation:**

1. **`verifyAdmin()` returns the supabase client** — this was a code review fix (H3). Do NOT create a separate supabase client after calling `verifyAdmin()`. Use the client it returns.

2. **Error handling for missing tables** — `deleteCategory` handles `42P01` (undefined_table) for when products table didn't exist. Now that products table WILL exist after this story, this edge case is resolved. Do not remove that handling — it's still valid defense-in-depth.

3. **`types/supabase.ts` can be corrupted by `supabase gen types` if Docker is not running** — the command overwrites the file with error output. Always check that Docker/Supabase is running before executing type generation. If it fails, restore from git immediately.

4. **Product count was hardcoded to 0** — `page.tsx` maps categories with `product_count: 0`. This MUST be updated in this story to query actual product counts per category.

5. **Code review fixes applied in Story 2-1:**
   - H1: `deleteCategory` error handling — don't swallow all exceptions, check specific error codes
   - H2: Null count check — always handle `count !== null` before comparing
   - M1/L1: Added `trim()` and `max(100)` to category name validation — apply same patterns to product validation
   - M3: Delete confirmation uses destructive button styling — follow same pattern for product delete

6. **UI language is English** — all labels, button text, toast messages, error strings in English. The epics file has PT-BR references ("Novo Produto", "Editar", "Excluir") but these are overridden.

> [Source: _bmad-output/implementation-artifacts/2-1-admin-manage-product-categories.md — Dev Notes, Completion Notes, Change Log]

### Git Intelligence

**Recent commits (scotty-ops submodule):**
- `602dbdd` fix: add password confirmation field (story 1-2)
- `6aaa258` fix: add role-based redirect (story 1-1)
- `28a28db` fix: add Node.js runtime comment (story 0-3)
- `8992f9c` fix: code review — supabase migrations and security fixes (story 0-2)
- `4630681` fix: code review round 2 — auth, middleware, UI fixes (story 0-1)
- `a540d2d` feat: initialize project with supabase starter and brand tokens

**Note:** Story 2-1 changes are not yet committed to the submodule. The dev agent should expect the categories code to exist in the working tree even if not reflected in git log.

**Commit pattern:** Use `feat:` prefix for new functionality. Format: `feat: add product CRUD management (story 2-2)`

### Project Structure Notes

- Alignment with unified project structure: all product files under `app/(dashboard)/products/` and `components/products/` — matches existing convention
- Route is `/products` (not `/catalog` as architecture suggests) — established in prior implementation, do NOT change
- Validations co-located in `lib/validations/products.ts` alongside existing category schemas
- Types co-located in `lib/types/index.ts` alongside existing `CategoryRow`, `UserRow`, `StoreRow`

### References

- [Source: epics.md — Epic 2, Story 2.2] User story, acceptance criteria, DB table annotation
- [Source: prd.md — FR14] Admins can create, edit, and delete products with name, price, unit, category
- [Source: prd.md — FR16] Factory Users have NO access to the product catalog
- [Source: architecture.md — D1] `profiles` table with role enum (`admin`, `factory`, `store`)
- [Source: architecture.md — D3] Supabase CLI migrations, never edit previous migration files
- [Source: architecture.md — D5] RLS helper functions `auth_role()` / `auth_store_id()`
- [Source: architecture.md — D7] Server Actions return `ActionResult<T>`
- [Source: architecture.md — D9] Error handling: human-readable English strings
- [Source: architecture.md — D11] React Hook Form + Zod for all forms
- [Source: architecture.md — Anti-Patterns] Never `select('*')`, never throw from Server Actions
- [Source: Story 2-1 Completion Notes] verifyAdmin() returns client, destructive button styling, trim+max on validation
- [Source: Story 2-1 Code Review] H1-H3 fixes, M1/M3/L1 fixes — apply same patterns
- [Source: memory/feedback_ui_language.md] UI is English — all labels, toasts, validation messages in English

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

- Linter auto-fixed `invalid_type_error` → `error` in Zod `.number()` options (newer Zod API)

### Completion Notes List

- Created products table migration with RLS policies matching categories pattern (admin CRUD, admin+store SELECT, factory denied)
- Added `ON DELETE RESTRICT` FK from products → product_categories (DB-level guarantee prevents deleting categories with products)
- Added `ProductRow` type to `lib/types/index.ts`
- Added `createProductSchema` and `updateProductSchema` with Zod validation (name, price, unit_of_measure, category_id)
- Added `createProduct`, `updateProduct`, `deleteProduct` Server Actions following existing `verifyAdmin()` pattern
- Updated `page.tsx` to query products table, compute real product counts per category (replacing hardcoded 0), and enrich products with category names
- Created `ProductForm` component with React Hook Form + Zod + Select dropdown for categories
- Created `ProductsClient` component with full CRUD UI: list, create dialog, edit dialog, delete confirmation with destructive styling
- Chose flat product list layout (products with category column) for admin management simplicity
- Verified Factory User access denial: nav items, page redirect, and RLS all in place
- Price formatted with `Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' })`
- All UI text in English per project requirements
- Build and lint pass cleanly with zero errors

### File List

- `scotty-ops/supabase/migrations/20260316170216_create_products.sql` — NEW: Products table, RLS policies, index, trigger
- `scotty-ops/lib/types/index.ts` — MODIFIED: Added ProductRow type
- `scotty-ops/lib/validations/products.ts` — MODIFIED: Added createProductSchema, updateProductSchema + types
- `scotty-ops/app/(dashboard)/products/actions.ts` — MODIFIED: Added createProduct, updateProduct, deleteProduct Server Actions
- `scotty-ops/app/(dashboard)/products/page.tsx` — MODIFIED: Query products, compute counts, render ProductsClient
- `scotty-ops/components/products/product-form.tsx` — NEW: Product form component with category Select dropdown
- `scotty-ops/components/products/products-client.tsx` — NEW: Product list with CRUD UI

## Change Log

- 2026-03-16: Implemented full product CRUD — migration, types, validation, server actions, form component, list component with create/edit/delete UI. Product counts now computed from actual products table. Build and lint pass.
- 2026-03-16: Code review fixes — H1: added `.select().single()` to updateProduct, deleteProduct, updateCategory to detect missing entities (PGRST116); M1: added CHECK(price > 0) constraint to migration; M2: added query error handling banner to page.tsx; M3: deduplicated Zod schemas (updateProductSchema = createProductSchema, same for category). Build and lint pass.

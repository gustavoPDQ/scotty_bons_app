# Story 2.1: Admin — Manage Product Categories

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an Admin,
I want to create, edit, and delete product categories,
so that the catalog is organized and products can be grouped meaningfully for Store Users.

## Acceptance Criteria

1. **Given** an Admin navigates to the Catalog management section,
   **When** the page loads,
   **Then** a list of all existing product categories is displayed with name and product count per category.

2. **Given** an Admin clicks "New Category",
   **When** they enter a category name and save,
   **Then** the new category appears in the list and is immediately available for product assignment.

3. **Given** an Admin clicks "Edit" on an existing category,
   **When** they update the name and save,
   **Then** the category name is updated and reflected on all products belonging to it.

4. **Given** an Admin clicks "Delete" on a category that has no products,
   **When** they confirm the deletion,
   **Then** the category is removed from the list.

5. **Given** an Admin attempts to delete a category that has associated products,
   **When** they confirm the deletion attempt,
   **Then** an error is shown ("This category has products. Remove the products before deleting.") and the category is not deleted.

6. **Given** an Admin submits a category name that already exists,
   **When** the form is submitted,
   **Then** a validation error is shown ("A category with this name already exists.") and the duplicate is not created.

7. **Given** an Admin creates, edits, or deletes a category,
   **When** the Server Action (`createCategory` / `updateCategory` / `deleteCategory`) executes,
   **Then** it returns `{ data: Category | null; error: string | null }` — on success an English toast confirms the action and the list refreshes via `router.refresh()`; on error a human-readable English message is shown without exposing raw database errors.

8. **Given** a Factory User is authenticated,
   **When** they attempt to access the catalog page or query `product_categories` directly,
   **Then** access is denied — the sidebar does not show the Products link, the page redirects non-authorized roles, and RLS blocks data access at the database level (FR16).

## Tasks / Subtasks

- [x] Task 1 — Fix RLS policy: restrict catalog read access to Admin and Store only (AC: #8)
  - [x] Create new migration to DROP the existing `product_categories_select_authenticated` policy
  - [x] Create replacement policy `product_categories_select_admin_store` with `USING (auth_role() IN ('admin', 'store'))`
  - [x] Run `supabase gen types typescript --local > types/supabase.ts` to regenerate types — SKIPPED: RLS-only change, no schema change, Docker not available locally

- [x] Task 2 — Fix nav-items.ts: remove Factory User from Products route (AC: #8)
  - [x] Update `lib/nav-items.ts` line 14: change `roles: ["admin", "factory", "store"]` to `roles: ["admin", "store"]`

- [x] Task 3 — Add server-side role guard on Products page (AC: #8)
  - [x] In `app/(dashboard)/products/page.tsx`, add redirect for factory users: if `profile?.role === 'factory'` → `redirect('/orders')`

- [x] Task 4 — Verify existing category CRUD implementation against ACs (AC: #1–#7)
  - [x] Verify `createCategory` server action handles duplicate name (AC: #6) ✓ Already implemented
  - [x] Verify `updateCategory` server action handles duplicate name (AC: #6) ✓ Already implemented
  - [x] Verify `deleteCategory` server action checks for associated products (AC: #5) ✓ Already implemented
  - [x] Verify `CategoriesClient` shows product count per category (AC: #1) — currently hardcoded to 0; acceptable until Story 2-2 creates the products table
  - [x] Verify all toast messages are in English (AC: #7) ✓ Already implemented
  - [x] Verify `router.refresh()` is called after each mutation (AC: #7) ✓ Already implemented

- [x] Task 5 — Verify build and lint pass (AC: all)
  - [x] Run `npm run build` from `scotty-ops/scotty-ops/`
  - [x] Run `npm run lint` from `scotty-ops/scotty-ops/`
  - [x] Fix any TypeScript or lint errors introduced — restored types/supabase.ts after failed gen command overwrote it

## Dev Notes

### CRITICAL: Most Code Already Exists — This Is Primarily a Bug-Fix Story

A previous implementation (likely during Epic 1 prep) already created the full category CRUD:
- **Migration:** `20260316162216_create_product_categories.sql` — table with `id`, `name`, `created_at`, `updated_at`, unique constraint on `name`
- **Server Actions:** `app/(dashboard)/products/actions.ts` — `createCategory`, `updateCategory`, `deleteCategory` with `verifyAdmin()`, Zod validation, `ActionResult<T>` pattern
- **Validation:** `lib/validations/products.ts` — `createCategorySchema`, `updateCategorySchema`
- **UI Components:** `components/products/categories-client.tsx` (list + dialogs), `category-form.tsx` (React Hook Form + Zod)
- **Page:** `app/(dashboard)/products/page.tsx` — SSR with role check, passes `isAdmin` to control edit visibility
- **Type:** `CategoryRow` in `lib/types/index.ts`

**The primary new work is fixing two FR16 violations (Factory User catalog access).**

> [Source: epics.md — Epic 2, Story 2.1; prd.md — FR13-FR16; architecture.md — D5 RLS helpers]

---

### CRITICAL: RLS Policy Bug — Factory Users Can Read Categories

The current policy `product_categories_select_authenticated` uses:
```sql
USING (auth.uid() IS NOT NULL)
```

This allows ANY authenticated user (including Factory Users) to read categories, violating FR16: "Factory Users have no catalog access."

**Fix:** Replace with:
```sql
CREATE POLICY "product_categories_select_admin_store"
  ON product_categories FOR SELECT
  USING (auth_role() IN ('admin', 'store'));
```

**IMPORTANT:** Use `auth_role()` helper function — never inline subqueries per architecture D5.

> [Source: architecture.md — D5 RLS Policy Design; prd.md — FR16]

---

### CRITICAL: Nav Item Bug — Factory Users See Products Link

`lib/nav-items.ts` line 14 currently includes `factory` in the roles array for `/products`. Factory Users should NOT see the Products link in the sidebar.

**Fix:** Change to `roles: ["admin", "store"]`

> [Source: architecture.md — Role Boundary: "UI navigation is role-filtered (sidebar shows only relevant links per role)"]

---

### CRITICAL: Missing Server-Side Role Guard

The products `page.tsx` checks `isAdmin` to control edit UI visibility, but does NOT redirect Factory Users. A Factory User who navigates directly to `/products` would see the page (categories list, read-only). Combined with the RLS fix, the query would return empty data, but the page should actively redirect non-authorized roles.

**Fix:** Add redirect guard:
```typescript
if (profile?.role === 'factory') redirect('/orders');
```

This matches the pattern from `app/(dashboard)/users/page.tsx` which guards admin-only pages.

> [Source: architecture.md — Role Boundary: "Admin-only pages check auth_role() in the Server Component and redirect non-admins"]

---

### Product Count Shows 0 Until Story 2-2

`page.tsx` line 28-32 maps categories with `product_count: 0` because the `products` table doesn't exist yet. This is correct and expected — Story 2-2 will create the products table and update the query to include actual counts. No changes needed here for Story 2-1.

> [Source: epics.md — Story 2.2 creates the `products` table]

---

### Route Naming: `/products` vs Architecture's `/catalog`

The architecture document specifies `catalog/` as the route, but the codebase uses `products/`. This was established in prior implementation and is consistent across all files. **Do NOT rename** — maintain the existing `/products` convention.

> [Source: Existing codebase pattern; architecture.md — Project Structure (aspirational, not binding when codebase diverges)]

---

### Existing Codebase Patterns to Follow

**Server Action pattern** (from `app/(dashboard)/products/actions.ts`):
1. `verifyAdmin()` — creates supabase client, gets user, checks profile role
2. UUID validation with `z.string().uuid()` for ID parameters
3. Zod `safeParse()` for input validation
4. Supabase query with specific column selection
5. Error code `23505` handling for unique constraint violations
6. Returns `ActionResult<T>` — never throws

**Client Component pattern** (from `components/products/categories-client.tsx`):
1. `useTransition` for async action loading states
2. `Dialog` for create/edit forms
3. `AlertDialog` for destructive confirmations
4. `DropdownMenu` for row actions
5. `toast.success()` / `toast.error()` from sonner
6. `router.refresh()` after mutations

> [Source: Existing codebase `scotty-ops/scotty-ops/app/(dashboard)/products/`]

---

### UI Language Is English

All UI labels, button text, toast messages, and error strings MUST be in **English**. The epics file references PT-BR strings ("Nova Categoria", "Editar", "Excluir") but these are overridden. Current implementation already uses English correctly.

> [Source: memory/feedback_ui_language.md — UI is English, overrides UX spec/epics PT-BR]

---

### Migration Naming Convention

Follow the Supabase CLI timestamp convention. Run:
```bash
cd scotty-ops/scotty-ops && npx supabase migration new fix_product_categories_rls_factory_access
```

This creates a new timestamped migration file. **Never edit existing migrations** — per architecture gap 4: "Each sprint adds a new RLS migration file, never edits previous ones."

> [Source: architecture.md — D3 Migration Strategy; Gap 4 resolved — RLS migration convention]

---

### Project Structure Notes

Files to CREATE:
- `scotty-ops/supabase/migrations/<timestamp>_fix_product_categories_rls_factory_access.sql` — New migration fixing RLS

Files to MODIFY:
- `scotty-ops/lib/nav-items.ts` — Remove `factory` from Products route roles
- `scotty-ops/app/(dashboard)/products/page.tsx` — Add factory user redirect guard

No new components needed — all UI is already implemented and working correctly.

---

### References

- [Source: epics.md — Epic 2, Story 2.1] User story, acceptance criteria, DB table annotation
- [Source: prd.md — FR13] Admins can create, edit, and delete product categories
- [Source: prd.md — FR14] Admins can create, edit, and delete products with name, price, unit, category
- [Source: prd.md — FR15] Store Users can browse the product catalog organized by category
- [Source: prd.md — FR16] Factory Users have NO access to the product catalog
- [Source: architecture.md — D1] `profiles` table with role enum
- [Source: architecture.md — D5] RLS helper functions `auth_role()` / `auth_store_id()`
- [Source: architecture.md — D7] Server Actions return `ActionResult<T>`
- [Source: architecture.md — D9] Error handling: human-readable English strings
- [Source: architecture.md — D3] Supabase CLI migrations, never edit previous migration files
- [Source: architecture.md — Gap 4] Each sprint adds new RLS migration file
- [Source: architecture.md — Role Boundary] UI navigation role-filtered; admin-only pages redirect
- [Source: architecture.md — Anti-Patterns] Never `select('*')` in application code
- [Source: Story 1.6 Completion Notes] Established `verifyAdmin()`, `AlertDialog` for destructive actions, `useTransition` patterns
- [Source: Story 1.5] RLS policies for profiles and stores already deployed
- [Source: memory/feedback_ui_language.md] UI is English — all labels, toasts, validation messages in English

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

- types/supabase.ts was accidentally overwritten by `supabase gen types` error output (Docker not running). Restored from git.

### Completion Notes List

- Fixed FR16 violation: Factory Users can no longer read product_categories at the RLS level (new migration drops permissive policy, adds role-restricted one)
- Fixed FR16 violation: Factory Users no longer see Products link in sidebar (removed "factory" from nav-items.ts roles)
- Added server-side redirect guard: Factory Users navigating directly to /products are redirected to /orders
- Verified all existing CRUD functionality (create, edit, delete categories) meets ACs #1-#7
- All toast messages confirmed in English, router.refresh() called after every mutation
- Build and lint pass cleanly

### File List

- `scotty-ops/supabase/migrations/20260316163721_fix_product_categories_rls_factory_access.sql` — NEW: Migration to fix RLS SELECT policy
- `scotty-ops/lib/nav-items.ts` — MODIFIED: Removed "factory" from Products route roles
- `scotty-ops/app/(dashboard)/products/page.tsx` — MODIFIED: Added factory user redirect guard
- `scotty-ops/app/(dashboard)/products/actions.ts` — MODIFIED: Code review fixes (H1-H3, L1)
- `scotty-ops/lib/validations/products.ts` — MODIFIED: Code review fixes (M1, L1)
- `scotty-ops/components/products/categories-client.tsx` — MODIFIED: Code review fix (M3)

## Change Log

- 2026-03-16: Fixed FR16 violations — RLS policy, nav item, and page guard all updated to deny Factory User catalog access. Verified existing CRUD implementation meets all ACs. Build and lint pass.
- 2026-03-16: Code review fixes — H1: deleteCategory error handling no longer swallows all exceptions (checks 42P01 specifically); H2: null count check fixed; H3: verifyAdmin now returns supabase client to avoid double instantiation; M1/L1: added trim() and max(100) to category name validation; M3: delete confirmation button uses destructive styling.

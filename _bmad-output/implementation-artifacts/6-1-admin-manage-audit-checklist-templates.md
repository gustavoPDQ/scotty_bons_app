# Story 6.1: Admin — Manage Audit Checklist Templates

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an Admin,
I want to create, edit, activate/deactivate, and delete audit checklist templates,
so that I can define standardized checklists that will be used to audit stores for compliance.

## Acceptance Criteria

1. **Given** an Admin navigates to the Audits section,
   **When** the page loads,
   **Then** a list of all audit templates is displayed showing name, description, item count, and active/inactive status.

2. **Given** an Admin clicks "New Template",
   **When** they enter a template name, description, and at least one checklist item, then save,
   **Then** the new template appears in the list and is active by default.

3. **Given** an Admin clicks "Edit" on an existing template,
   **When** they update the name, description, or checklist items (add, remove, reorder) and save,
   **Then** the template is updated and the changes are reflected immediately.

4. **Given** an Admin reorders checklist items within a template,
   **When** they move an item up or down and save,
   **Then** the `sort_order` is updated and items display in the new order.

5. **Given** an Admin toggles a template's active status,
   **When** the action completes,
   **Then** the template's `is_active` flag is updated, the status badge reflects the change, and a success toast is shown.

6. **Given** an Admin clicks "Delete" on a template that has no associated audits,
   **When** they confirm the deletion,
   **Then** the template and all its items are removed from the database.

7. **Given** an Admin attempts to delete a template that has been used in at least one audit,
   **When** they confirm the deletion attempt,
   **Then** an error is shown ("This template has been used in audits and cannot be deleted. You can deactivate it instead.") and the template is not deleted.

8. **Given** an Admin submits a template name that already exists,
   **When** the form is submitted,
   **Then** a validation error is shown ("A template with this name already exists.") and the duplicate is not created.

9. **Given** an Admin submits a template with no checklist items,
   **When** the form is submitted,
   **Then** a validation error is shown ("A template must have at least one checklist item.") and the template is not created/updated.

10. **Given** a Store or Factory user is authenticated,
    **When** they attempt to access `/audits/templates`,
    **Then** access is denied — the sidebar shows the Audits link only for admins, the page redirects non-admin roles, and RLS blocks write access at the database level. Store and Factory users can SELECT active templates (read-only, needed for later stories).

11. **Given** any template CRUD action is performed,
    **When** the Server Action executes,
    **Then** it returns `{ data: T | null; error: string | null }` — on success an English toast confirms the action and the list refreshes via `router.refresh()`; on error a human-readable English message is shown without exposing raw database errors.

## Tasks / Subtasks

- [ ] Task 1 — DB migration: create `audit_templates` and `audit_template_items` tables (AC: #1-#9)
  - [ ] Create `supabase/migrations/<timestamp>_create_audit_templates.sql`
  - [ ] Create `audit_templates` table: `id uuid DEFAULT gen_random_uuid() PRIMARY KEY`, `name text NOT NULL`, `description text`, `is_active boolean NOT NULL DEFAULT true`, `created_at timestamptz DEFAULT now()`, `updated_at timestamptz DEFAULT now()`
  - [ ] Add unique constraint on `audit_templates.name`
  - [ ] Create `audit_template_items` table: `id uuid DEFAULT gen_random_uuid() PRIMARY KEY`, `template_id uuid NOT NULL REFERENCES audit_templates(id) ON DELETE CASCADE`, `label text NOT NULL`, `sort_order integer NOT NULL DEFAULT 0`, `created_at timestamptz DEFAULT now()`
  - [ ] Add `updated_at` trigger on `audit_templates` (reuse `update_updated_at_column()` function if it exists, otherwise create it)
  - [ ] Enable RLS on both tables
  - [ ] RLS for `audit_templates`: admin full CRUD (`auth_role() = 'admin'`); store and factory SELECT active only (`auth_role() IN ('store', 'factory') AND is_active = true`)
  - [ ] RLS for `audit_template_items`: admin full CRUD (`auth_role() = 'admin'`); store and factory SELECT where template is active (join or subquery against `audit_templates.is_active`)
  - [ ] Run `supabase gen types typescript --local > types/supabase.ts` to regenerate types (if Docker available; otherwise skip and note)

- [ ] Task 2 — Types and validation schemas (AC: #2, #3, #8, #9)
  - [ ] Add `AuditTemplateRow` type to `lib/types/index.ts`: `{ id: string; name: string; description: string | null; is_active: boolean; item_count: number; created_at: string; updated_at: string }`
  - [ ] Add `AuditTemplateItemRow` type to `lib/types/index.ts`: `{ id: string; template_id: string; label: string; sort_order: number; created_at: string }`
  - [ ] Create `lib/validations/audit-templates.ts` with:
    - `templateItemSchema`: `z.object({ label: z.string().trim().min(1, "Item label is required.").max(500, "Item label must be 500 characters or less.") })`
    - `createTemplateSchema`: `z.object({ name: z.string().trim().min(1, "Template name is required.").max(100, "Template name must be 100 characters or less."), description: z.string().trim().max(500).optional().or(z.literal("")), items: z.array(templateItemSchema).min(1, "A template must have at least one checklist item.") })`
    - `updateTemplateSchema`: same shape as `createTemplateSchema`
    - Export value types: `CreateTemplateValues`, `UpdateTemplateValues`

- [ ] Task 3 — Server Actions (AC: #2, #3, #5, #6, #7, #8, #9, #11)
  - [ ] Create `app/(dashboard)/audits/templates/actions.ts`
  - [ ] `createTemplate(values)`: verifyAdmin, Zod validate, insert `audit_templates` row, then bulk insert `audit_template_items` with `sort_order` based on array index; handle unique constraint `23505`; return `ActionResult<AuditTemplateRow | null>`
  - [ ] `updateTemplate(templateId, values)`: verifyAdmin, validate ID + body, update template row, delete existing items and re-insert with new items/order; handle `23505` and `PGRST116`; return `ActionResult<null>`
  - [ ] `toggleTemplateActive(templateId, isActive)`: verifyAdmin, validate ID, update `is_active`; return `ActionResult<null>`
  - [ ] `deleteTemplate(templateId)`: verifyAdmin, validate ID, check if audits exist for this template (query `audits` table — if table doesn't exist yet handle `42P01` gracefully like deleteCategory does), delete template (cascade deletes items); return `ActionResult<null>`
  - [ ] All actions call `revalidatePath("/audits/templates")` on success

- [ ] Task 4 — Navigation: add Audits to sidebar (AC: #10)
  - [ ] Update `lib/nav-items.ts`: add `{ href: "/audits/templates", label: "Audits", icon: ClipboardCheck, roles: ["admin"] }`
  - [ ] Import `ClipboardCheck` from `lucide-react`

- [ ] Task 5 — Page: audit templates list (AC: #1, #10)
  - [ ] Create `app/(dashboard)/audits/templates/page.tsx` (Server Component)
  - [ ] Auth guard: get user + profile; if not admin, `redirect("/orders")`
  - [ ] Fetch all templates: `.from("audit_templates").select("id, name, description, is_active, created_at, updated_at").order("created_at", { ascending: false })`
  - [ ] For each template, fetch item count (or use a subquery/aggregate)
  - [ ] Pass data + `isAdmin` flag to client component
  - [ ] Page title: "Audit Templates"

- [ ] Task 6 — Client Components (AC: #1-#9, #11)
  - [ ] Create `components/audits/templates-client.tsx` (main list + dialogs)
    - List templates in Cards or Table rows showing: name, description (truncated), item count badge, active/inactive badge, actions dropdown
    - "New Template" button at top
    - `DropdownMenu` per row: "Edit", "Toggle Active/Inactive", "Delete"
    - `useTransition` + `toast` for all mutations
    - `router.refresh()` after success
  - [ ] Create `components/audits/template-form.tsx` (used in create/edit Dialog)
    - React Hook Form + Zod resolver with `createTemplateSchema`
    - Fields: name (Input), description (Textarea, optional)
    - Dynamic checklist items section: each item has a text Input + remove button + up/down reorder buttons
    - "Add Item" button to append a new blank item
    - Form validates at least 1 item before submission
  - [ ] Delete confirmation: use `AlertDialog` — if template has been used in audits, show error toast (from server action); otherwise confirm and delete

- [ ] Task 7 — Build and lint verification (AC: all)
  - [ ] Run `npm run build` — zero errors
  - [ ] Run `npm run lint` — zero warnings/errors

## Quick Reference — Existing Code to Reuse

```
Supabase server client:  import { createClient } from "@/lib/supabase/server"
Supabase browser client: import { createClient } from "@/lib/supabase/client"
Types:                   import type { ActionResult, AuditTemplateRow, AuditTemplateItemRow } from "@/lib/types"
CN utility:              import { cn } from "@/lib/utils"
UI components:           Badge, Button, Card*, Dialog*, AlertDialog*, Input, Textarea, DropdownMenu* from @/components/ui/*
Toast:                   import { toast } from "sonner"
Icons:                   ClipboardCheck, Plus, Trash2, Pencil, ArrowUp, ArrowDown, ToggleLeft, ToggleRight from lucide-react
revalidatePath:          import { revalidatePath } from "next/cache"
useRouter:               import { useRouter } from "next/navigation"
useTransition:           import { useTransition } from "react"
React Hook Form:         import { useForm, useFieldArray } from "react-hook-form"
Zod resolver:            import { zodResolver } from "@hookform/resolvers/zod"
```

## Dev Notes

### SQL Migration

```sql
-- audit_templates table
CREATE TABLE audit_templates (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE audit_templates ADD CONSTRAINT audit_templates_name_unique UNIQUE (name);

-- audit_template_items table
CREATE TABLE audit_template_items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id uuid NOT NULL REFERENCES audit_templates(id) ON DELETE CASCADE,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_template_items_template_id ON audit_template_items(template_id);

-- updated_at trigger (reuse existing function if available)
CREATE TRIGGER audit_templates_updated_at
  BEFORE UPDATE ON audit_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE audit_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_template_items ENABLE ROW LEVEL SECURITY;

-- RLS: audit_templates
CREATE POLICY "audit_templates_select_admin"
  ON audit_templates FOR SELECT
  USING (auth_role() = 'admin');

CREATE POLICY "audit_templates_select_active_store_factory"
  ON audit_templates FOR SELECT
  USING (auth_role() IN ('store', 'factory') AND is_active = true);

CREATE POLICY "audit_templates_insert_admin"
  ON audit_templates FOR INSERT
  WITH CHECK (auth_role() = 'admin');

CREATE POLICY "audit_templates_update_admin"
  ON audit_templates FOR UPDATE
  USING (auth_role() = 'admin');

CREATE POLICY "audit_templates_delete_admin"
  ON audit_templates FOR DELETE
  USING (auth_role() = 'admin');

-- RLS: audit_template_items
CREATE POLICY "audit_template_items_select_admin"
  ON audit_template_items FOR SELECT
  USING (auth_role() = 'admin');

CREATE POLICY "audit_template_items_select_active_store_factory"
  ON audit_template_items FOR SELECT
  USING (
    auth_role() IN ('store', 'factory')
    AND EXISTS (
      SELECT 1 FROM audit_templates
      WHERE audit_templates.id = audit_template_items.template_id
      AND audit_templates.is_active = true
    )
  );

CREATE POLICY "audit_template_items_insert_admin"
  ON audit_template_items FOR INSERT
  WITH CHECK (auth_role() = 'admin');

CREATE POLICY "audit_template_items_update_admin"
  ON audit_template_items FOR UPDATE
  USING (auth_role() = 'admin');

CREATE POLICY "audit_template_items_delete_admin"
  ON audit_template_items FOR DELETE
  USING (auth_role() = 'admin');
```

**IMPORTANT:** Verify that `update_updated_at_column()` function exists from a prior migration. If not, create it:

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**IMPORTANT:** Use `auth_role()` helper function — never inline subqueries against `profiles` per architecture D5.

### Server Actions Pattern

Follow the established pattern from `app/(dashboard)/products/actions.ts`:

```typescript
"use server";

import { createClient } from "@/lib/supabase/server";
import type { ActionResult, AuditTemplateRow } from "@/lib/types";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createTemplateSchema, type CreateTemplateValues } from "@/lib/validations/audit-templates";

const idSchema = z.string().uuid("Invalid ID.");

async function verifyAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();
  return profile?.role === "admin" ? supabase : null;
}

export async function createTemplate(
  values: CreateTemplateValues
): Promise<ActionResult<AuditTemplateRow | null>> {
  const parsed = createTemplateSchema.safeParse(values);
  if (!parsed.success) {
    return { data: null, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await verifyAdmin();
  if (!supabase) return { data: null, error: "Unauthorized." };

  // Insert template
  const { data: template, error: templateError } = await supabase
    .from("audit_templates")
    .insert({ name: parsed.data.name, description: parsed.data.description || null })
    .select("id, name, description, is_active, created_at, updated_at")
    .single();

  if (templateError) {
    if (templateError.code === "23505") {
      return { data: null, error: "A template with this name already exists." };
    }
    return { data: null, error: "Failed to create template. Please try again." };
  }

  // Insert items
  const items = parsed.data.items.map((item, index) => ({
    template_id: template.id,
    label: item.label,
    sort_order: index,
  }));

  const { error: itemsError } = await supabase
    .from("audit_template_items")
    .insert(items);

  if (itemsError) {
    // Rollback: delete the template (cascade deletes items)
    await supabase.from("audit_templates").delete().eq("id", template.id);
    return { data: null, error: "Failed to create template items. Please try again." };
  }

  revalidatePath("/audits/templates");
  return {
    data: { ...template, item_count: items.length } as AuditTemplateRow,
    error: null,
  };
}
```

**Key pattern notes:**
- `verifyAdmin()` returns the supabase client (avoids double instantiation) or `null`
- Template + items insert is NOT atomic at app level — if items fail, manually delete the template. An RPC would be cleaner but follows the simpler pattern established in the codebase. If preferred, use an RPC with a transaction.
- `updateTemplate` should delete all existing items and re-insert — simpler than diffing adds/removes/reorders
- `deleteTemplate` checks for associated audits (table may not exist yet — handle `42P01`)

### Component Guidance

**Template Form with Dynamic Items (`useFieldArray`):**

```tsx
const { control, register, handleSubmit, formState: { errors } } = useForm<CreateTemplateValues>({
  resolver: zodResolver(createTemplateSchema),
  defaultValues: { name: "", description: "", items: [{ label: "" }] },
});

const { fields, append, remove, move } = useFieldArray({ control, name: "items" });
```

- Each item row: text Input bound to `items.${index}.label`, up/down arrows, remove button
- Up arrow calls `move(index, index - 1)`, down arrow calls `move(index, index + 1)`
- Disable up on first item, disable down on last item
- Remove button disabled when only 1 item remains (min 1 required)
- "Add Item" button calls `append({ label: "" })`

**Active/Inactive Badge:**

```tsx
<Badge variant={template.is_active ? "default" : "secondary"}>
  {template.is_active ? "Active" : "Inactive"}
</Badge>
```

**Templates List Layout:**

Use the same Card-based or Table-based layout as the products/categories page. Each row shows:
- Template name (bold)
- Description (truncated to ~80 chars with ellipsis)
- Item count (e.g., "5 items")
- Active/Inactive badge
- Actions dropdown (Edit, Toggle Active, Delete)

### Anti-Patterns — NEVER DO

- `select('*')` in application code — always select specific columns
- `redirect()` inside Server Actions — let the Client Component handle via `router.refresh()`
- Inline subqueries in RLS policies — use `auth_role()` helper
- Edit existing migration files — always create new migrations
- Use `service_role` key in application code — RLS handles access
- Skip Zod validation before DB calls
- Expose raw Postgres error messages to the user
- Create template without items — enforce min 1 at both client (Zod) and server (Zod) level
- Hard-delete templates that have audit references — check first, show helpful error

### Testing Requirements

- Run `npm run build` — zero errors
- Run `npm run lint` — zero warnings/errors
- Manual: Admin navigates to Audits in sidebar — template list page loads with correct title
- Manual: Admin creates a new template with name, description, and 3 checklist items — template appears in the list with "3 items" count and "Active" badge
- Manual: Admin creates template with duplicate name — error toast "A template with this name already exists."
- Manual: Admin tries to submit template with no items — validation error shown
- Manual: Admin edits a template: changes name, removes 1 item, adds 2 new items, reorders — all changes saved correctly
- Manual: Admin toggles template inactive — badge changes to "Inactive", success toast shown
- Manual: Admin toggles template active again — badge changes to "Active"
- Manual: Admin deletes a template with no audits — template removed from list
- Manual: Admin tries to delete a template with audits (once Story 6-2 exists) — error toast shown
- Manual: Store user cannot see "Audits" in sidebar
- Manual: Factory user cannot see "Audits" in sidebar
- Manual: Non-admin navigating directly to `/audits/templates` is redirected to `/orders`

### Navigation Update

In `lib/nav-items.ts`, add the Audits entry. Place it after Orders and before Users:

```typescript
import { ClipboardCheck, LayoutDashboard, Package, Settings, ShoppingBasket, Users } from "lucide-react";

// In allNavItems array:
{ href: "/audits/templates", label: "Audits", icon: ClipboardCheck, roles: ["admin"] },
```

### Project Structure Notes

**Files to CREATE:**

```
supabase/migrations/<timestamp>_create_audit_templates.sql
lib/validations/audit-templates.ts
app/(dashboard)/audits/templates/page.tsx
app/(dashboard)/audits/templates/actions.ts
components/audits/templates-client.tsx
components/audits/template-form.tsx
```

**Files to MODIFY:**

```
lib/nav-items.ts                — Add Audits nav item with ClipboardCheck icon
lib/types/index.ts              — Add AuditTemplateRow and AuditTemplateItemRow types
```

**Files NOT to touch:**
- Any existing migration files — never edit previous migrations
- `proxy.ts` / middleware — no changes needed
- `app/(dashboard)/products/*` — unrelated
- `app/(dashboard)/orders/*` — unrelated

### Architecture Compliance

**D3 — Migration Strategy:** New timestamped migration file. Never edit existing migrations. Use `supabase migration new create_audit_templates` to generate.

**D5 — RLS Policy Design:** All policies use `auth_role()` helper. Admin gets full CRUD. Store/Factory get SELECT on active templates only (needed for Stories 6-2 through 6-4). Items SELECT for non-admin uses EXISTS subquery against parent template's `is_active`.

**D7 — Server Actions:** All actions in `app/(dashboard)/audits/templates/actions.ts`. Auth check + role check before any DB call. Returns `ActionResult<T>`. Uses `revalidatePath`.

**D9 — Error Handling:** Human-readable English error strings. Never expose raw DB errors. Unique constraint `23505` mapped to friendly message. Missing record `PGRST116` mapped to "Template not found."

**ON DELETE CASCADE:** `audit_template_items.template_id` uses `ON DELETE CASCADE` so deleting a template automatically removes its items. No manual cleanup needed in the delete action.

### Library & Framework Requirements

**Already installed — no new packages needed:**

| Package | Purpose | Notes |
|---------|---------|-------|
| `@supabase/ssr` | Server-side Supabase client | Already configured |
| `sonner` | Toast notifications | Already installed |
| `lucide-react` | Icons (ClipboardCheck, Plus, etc.) | Already installed |
| `react-hook-form` | Form management | Already installed |
| `@hookform/resolvers` | Zod resolver | Already installed |
| `zod` | Validation schemas | Already installed |
| shadcn/ui components | Dialog, AlertDialog, Badge, etc. | Already available |

**No new packages to install.**

### Previous Story Intelligence

1. **`verifyAdmin()` pattern** — returns supabase client or null. Established in `app/(dashboard)/products/actions.ts`. Copy this exact pattern.

2. **`useFieldArray` from react-hook-form** — use for dynamic checklist items. This is the standard approach for variable-length form arrays with reorder support.

3. **Category CRUD is the closest pattern** — `components/products/categories-client.tsx` has list + create/edit Dialog + delete AlertDialog. Follow this structure for templates.

4. **`ActionResult<void>` vs `ActionResult<null>`** — for actions that don't return data (update, delete, toggle), use `ActionResult<null>` with `{ data: null, error: null }` on success, matching the existing pattern.

5. **UI Language is English** — all labels, toasts, validation messages in English per `memory/feedback_ui_language.md`.

6. **Next.js 16 async params** — Server Components receiving params must await them. Follow the pattern from existing pages.

7. **`date-fns` is NOT installed** — use `Intl.DateTimeFormat` if date formatting is needed.

### References

- [Source: architecture.md — D3] Supabase CLI migrations, never edit previous migration files
- [Source: architecture.md — D5] RLS helper functions `auth_role()` / `auth_store_id()`
- [Source: architecture.md — D7] Server Actions return `ActionResult<T>`
- [Source: architecture.md — D9] Error handling: human-readable English strings
- [Source: Story 2-1] Category CRUD pattern — closest analog for template management
- [Source: Story 3-4] Server Action pattern with `revalidatePath` and `ActionResult<void>`
- [Source: lib/types/index.ts] Existing type definitions to extend
- [Source: lib/nav-items.ts] Navigation structure to update
- [Source: app/(dashboard)/products/actions.ts] `verifyAdmin()` pattern, Zod validation, error code handling
- [Source: memory/feedback_ui_language.md] UI must be in English

# Story 6.2: Admin — Conduct Store Audit with Scoring

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an Admin,
I want to conduct store audits using predefined templates, scoring individual checklist items and computing an overall compliance percentage,
so that I can systematically evaluate store compliance and track audit results over time.

## Acceptance Criteria

1. **Given** an Admin navigates to `/audits`,
   **When** the page loads,
   **Then** a list of all audits is displayed showing store name, template name, status (draft/completed), score (if completed), conducted date, and conducted-by name — sorted by most recent first.

2. **Given** an Admin views the audits list,
   **When** they use the store filter dropdown or status filter,
   **Then** the list is filtered accordingly and the URL search params are updated for shareable/bookmarkable URLs.

3. **Given** an Admin clicks "New Audit",
   **When** the dialog/form opens,
   **Then** they can select a store and a template from dropdowns, and upon submission a new audit is created with status `draft` and they are redirected to the audit conduct page.

4. **Given** an Admin opens a draft audit,
   **When** the conduct page loads,
   **Then** all template items are displayed as a checklist with each item showing: item name, description (if any), a pass/fail toggle, and an optional notes field.

5. **Given** an Admin toggles pass/fail on an item and optionally adds notes,
   **When** they interact with the checklist,
   **Then** individual responses are saved (via Server Action) so that partial progress is preserved — the admin can leave and return to a draft audit.

6. **Given** an Admin clicks "Complete Audit" on a draft audit,
   **When** all items have a response (pass or fail),
   **Then** the score is computed as `(passed_items / total_items) * 100`, the audit status is set to `completed`, `conducted_at` is set to the current timestamp, and the admin is redirected to the completed audit detail view with a success toast.

7. **Given** an Admin clicks "Complete Audit" but not all items have responses,
   **When** validation runs,
   **Then** an error message is shown ("All items must be answered before completing the audit.") and the audit remains in `draft` status.

8. **Given** an Admin views a completed audit,
   **When** the detail page loads,
   **Then** the overall score is displayed as a percentage, each item shows its pass/fail result and notes, and the audit metadata (store, template, conducted by, date) is visible. No editing is allowed on completed audits.

9. **Given** a Store User accesses `/audits`,
   **When** the page loads,
   **Then** they can only see audits for their own store (read-only) — no create, edit, or complete actions are available.

10. **Given** a Factory User accesses `/audits`,
    **When** the page loads,
    **Then** they can see all audits (read-only) — no create, edit, or complete actions are available.

11. **Given** any audit action fails (network error or DB error),
    **When** the error is returned,
    **Then** an error toast is displayed with a human-readable English message and no data is lost.

## Tasks / Subtasks

- [ ] Task 1 — DB migration: create `audits` and `audit_responses` tables + RLS policies (AC: #1, #3, #5, #6, #8, #9, #10)
  - [ ] Create `supabase/migrations/<timestamp>_create_audits.sql`
  - [ ] Create `audits` table: `id` (uuid PK), `template_id` (FK→audit_templates), `store_id` (FK→stores), `conducted_by` (FK→auth.users), `status` (text CHECK IN ('draft','completed') DEFAULT 'draft'), `score` (numeric(5,2) NULL), `notes` (text NULL), `conducted_at` (timestamptz NULL), `created_at` (timestamptz DEFAULT now()), `updated_at` (timestamptz DEFAULT now())
  - [ ] Create `audit_responses` table: `id` (uuid PK), `audit_id` (FK→audits ON DELETE CASCADE), `template_item_id` (FK→audit_template_items), `passed` (boolean NOT NULL), `notes` (text NULL), `created_at` (timestamptz DEFAULT now())
  - [ ] Add unique constraint on `audit_responses(audit_id, template_item_id)` to prevent duplicate responses per item
  - [ ] Add `updated_at` trigger on `audits` (reuse `update_updated_at_column()`)
  - [ ] RLS: Enable on both tables
  - [ ] Policy `audits_select_admin`: admin can SELECT all audits
  - [ ] Policy `audits_select_store`: store can SELECT audits WHERE `store_id = auth_store_id()`
  - [ ] Policy `audits_select_factory`: factory can SELECT all audits
  - [ ] Policy `audits_insert_admin`: admin can INSERT audits
  - [ ] Policy `audits_update_admin`: admin can UPDATE audits
  - [ ] Policy `audit_responses_select_admin`: admin can SELECT all responses
  - [ ] Policy `audit_responses_select_store`: store can SELECT responses for audits at their store (via subquery on audits.store_id)
  - [ ] Policy `audit_responses_select_factory`: factory can SELECT all responses
  - [ ] Policy `audit_responses_insert_admin`: admin can INSERT responses
  - [ ] Policy `audit_responses_update_admin`: admin can UPDATE responses

- [ ] Task 2 — Types and validation schemas (AC: #3, #5, #6)
  - [ ] Add `AuditStatus` type to `lib/types/index.ts`: `"draft" | "completed"`
  - [ ] Add `AuditRow` type: `id`, `template_id`, `store_id`, `store_name?`, `template_name?`, `conducted_by`, `conducted_by_name?`, `status: AuditStatus`, `score: number | null`, `notes: string | null`, `conducted_at: string | null`, `created_at: string`, `updated_at: string`
  - [ ] Add `AuditResponseRow` type: `id`, `audit_id`, `template_item_id`, `item_name?`, `item_description?`, `passed: boolean`, `notes: string | null`
  - [ ] Create `lib/validations/audits.ts` — Zod schemas: `createAuditSchema` (template_id: uuid, store_id: uuid), `saveResponseSchema` (audit_id: uuid, template_item_id: uuid, passed: boolean, notes: string optional), `completeAuditSchema` (audit_id: uuid, notes: string optional)

- [ ] Task 3 — Server Actions (AC: #3, #5, #6, #7, #11)
  - [ ] Create `app/(dashboard)/audits/actions.ts`
  - [ ] `createAudit(formData)`: validate with Zod, auth check (admin only), INSERT into audits with `conducted_by = auth.uid()`, return `ActionResult<{ id: string }>` with the new audit ID
  - [ ] `saveAuditResponse(formData)`: validate with Zod, auth check (admin only), UPSERT into audit_responses (ON CONFLICT (audit_id, template_item_id) DO UPDATE), return `ActionResult<void>`
  - [ ] `completeAudit(formData)`: validate with Zod, auth check (admin only), verify all items have responses, compute score, UPDATE audit SET status='completed', score=computed, conducted_at=now(), revalidatePath, return `ActionResult<void>`

- [ ] Task 4 — Nav item: add Audits link (AC: #1, #9, #10)
  - [ ] Add to `lib/nav-items.ts`: `{ href: "/audits", label: "Audits", icon: ClipboardCheck, roles: ["admin", "store", "factory"] }`
  - [ ] Import `ClipboardCheck` from `lucide-react`

- [ ] Task 5 — Audits list page `/audits` (AC: #1, #2, #9, #10)
  - [ ] Create `app/(dashboard)/audits/page.tsx` — SSR page
  - [ ] Fetch audits with joined store name, template name, conducted-by name
  - [ ] Server-side filtering by `store` and `status` search params
  - [ ] Show "New Audit" button only for admin role
  - [ ] Display table: store, template, status badge, score (or "—" for drafts), conducted date, conducted by
  - [ ] Create `components/audits/audit-filters.tsx` — client component with store and status dropdowns using `useRouter` + `useSearchParams`
  - [ ] Create `components/audits/audit-list-table.tsx` — table component

- [ ] Task 6 — New Audit dialog (AC: #3)
  - [ ] Create `components/audits/new-audit-dialog.tsx` — client component
  - [ ] Store dropdown (fetch stores), template dropdown (fetch audit_templates)
  - [ ] On submit: call `createAudit` server action, on success redirect to `/audits/${id}/conduct`
  - [ ] `useTransition` + toast pattern

- [ ] Task 7 — Audit conduct page `/audits/[audit-id]/conduct` (AC: #4, #5, #6, #7)
  - [ ] Create `app/(dashboard)/audits/[audit-id]/conduct/page.tsx` — SSR page
  - [ ] Fetch audit (must be draft, must be admin), template items, existing responses
  - [ ] Redirect to detail page if audit is already completed
  - [ ] Create `components/audits/audit-checklist.tsx` — client component
  - [ ] Each item: name, description, pass/fail toggle (Switch or Checkbox), notes Textarea
  - [ ] Auto-save individual responses via `saveAuditResponse` on toggle/blur
  - [ ] "Complete Audit" button: validates all items answered, calls `completeAudit`, redirects to `/audits/${id}` on success
  - [ ] Overall notes field for the audit

- [ ] Task 8 — Audit detail page `/audits/[audit-id]` (AC: #8)
  - [ ] Create `app/(dashboard)/audits/[audit-id]/page.tsx` — SSR page
  - [ ] Display: audit metadata (store, template, conducted by, date, status badge)
  - [ ] Score displayed prominently as percentage with color coding (green >= 80, amber >= 60, red < 60)
  - [ ] List all responses: item name, pass/fail indicator, notes
  - [ ] Read-only — no edit controls for completed audits
  - [ ] "Back to Audits" link

- [ ] Task 9 — Build and lint verification (AC: all)
  - [ ] Run `npm run build` — zero errors
  - [ ] Run `npm run lint` — zero warnings/errors
  - [ ] Verify TypeScript compilation passes

## Quick Reference — Existing Code to Reuse

```
Supabase server client:  import { createClient } from "@/lib/supabase/server"
Supabase browser client: import { createClient } from "@/lib/supabase/client"
Types:                   import type { ActionResult, AuditStatus, AuditRow, AuditResponseRow } from "@/lib/types"
CN utility:              import { cn } from "@/lib/utils"
UI components:           Badge, Button, Card*, Dialog*, Switch, Textarea, Select* from @/components/ui/*
Toast:                   import { toast } from "sonner"
Icons:                   ClipboardCheck, CheckCircle, XCircle, ArrowLeft from lucide-react
revalidatePath:          import { revalidatePath } from "next/cache"
redirect:                import { redirect } from "next/navigation"
useRouter:               import { useRouter } from "next/navigation"
useSearchParams:         import { useSearchParams } from "next/navigation"
useTransition:           import { useTransition } from "react"
verifyAdmin pattern:     see app/(dashboard)/products/actions.ts
```

## Dev Notes

### SQL Migration

```sql
-- Migration: create_audits
-- Creates audits and audit_responses tables for store audit functionality.
-- Depends on: audit_templates (Story 6-1), stores, auth.users

CREATE TABLE IF NOT EXISTS audits (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id   uuid NOT NULL REFERENCES audit_templates(id),
  store_id      uuid NOT NULL REFERENCES stores(id),
  conducted_by  uuid NOT NULL REFERENCES auth.users(id),
  status        text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'completed')),
  score         numeric(5,2),
  notes         text,
  conducted_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER audits_updated_at
  BEFORE UPDATE ON audits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS audit_responses (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id          uuid NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
  template_item_id  uuid NOT NULL REFERENCES audit_template_items(id),
  passed            boolean NOT NULL,
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (audit_id, template_item_id)
);

-- Enable RLS
ALTER TABLE audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_responses ENABLE ROW LEVEL SECURITY;

-- Audits policies
CREATE POLICY "audits_select_admin"
  ON audits FOR SELECT
  USING (auth_role() = 'admin');

CREATE POLICY "audits_select_store"
  ON audits FOR SELECT
  USING (auth_role() = 'store' AND store_id = auth_store_id());

CREATE POLICY "audits_select_factory"
  ON audits FOR SELECT
  USING (auth_role() = 'factory');

CREATE POLICY "audits_insert_admin"
  ON audits FOR INSERT
  WITH CHECK (auth_role() = 'admin');

CREATE POLICY "audits_update_admin"
  ON audits FOR UPDATE
  USING (auth_role() = 'admin');

-- Audit responses policies
CREATE POLICY "audit_responses_select_admin"
  ON audit_responses FOR SELECT
  USING (auth_role() = 'admin');

CREATE POLICY "audit_responses_select_store"
  ON audit_responses FOR SELECT
  USING (
    auth_role() = 'store'
    AND audit_id IN (
      SELECT id FROM audits WHERE store_id = auth_store_id()
    )
  );

CREATE POLICY "audit_responses_select_factory"
  ON audit_responses FOR SELECT
  USING (auth_role() = 'factory');

CREATE POLICY "audit_responses_insert_admin"
  ON audit_responses FOR INSERT
  WITH CHECK (auth_role() = 'admin');

CREATE POLICY "audit_responses_update_admin"
  ON audit_responses FOR UPDATE
  USING (auth_role() = 'admin');
```

**IMPORTANT:** Use `auth_role()` and `auth_store_id()` helper functions — never inline subqueries for role/store lookups per architecture D5.

### Score Computation — Server-Side Only

Score is computed in the `completeAudit` Server Action, not on the client. The pattern:

```typescript
// Fetch all responses for this audit
const { data: responses } = await supabase
  .from("audit_responses")
  .select("passed")
  .eq("audit_id", auditId);

if (!responses || responses.length === 0) {
  return { data: null, error: "No responses found for this audit." };
}

// Verify all template items have responses
const { count: templateItemCount } = await supabase
  .from("audit_template_items")
  .select("id", { count: "exact", head: true })
  .eq("template_id", audit.template_id);

if (responses.length !== templateItemCount) {
  return { data: null, error: "All items must be answered before completing the audit." };
}

const passedCount = responses.filter((r) => r.passed).length;
const score = (passedCount / responses.length) * 100;

// Update audit
await supabase
  .from("audits")
  .update({ status: "completed", score, conducted_at: new Date().toISOString() })
  .eq("id", auditId);
```

### UPSERT Pattern for Saving Responses

Use PostgreSQL UPSERT via Supabase to handle both initial save and update of responses. This allows the admin to toggle pass/fail multiple times without creating duplicate rows:

```typescript
const { error } = await supabase
  .from("audit_responses")
  .upsert(
    {
      audit_id: auditId,
      template_item_id: templateItemId,
      passed,
      notes: notes?.trim() || null,
    },
    { onConflict: "audit_id,template_item_id" }
  );
```

### Server Action Pattern

Follow the established pattern from `app/(dashboard)/products/actions.ts`:

```typescript
"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/types";

async function verifyAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (profile?.role !== "admin") return null;
  return { supabase, user };
}
```

- `"use server"` at top of file
- Auth check + role check before any DB call
- Return `ActionResult<T>` — `{ data: T, error: null }` on success, `{ data: null, error: "message" }` on failure
- `revalidatePath("/audits")` after mutations
- No `redirect()` inside Server Actions — let the client handle navigation

### Client Component Patterns

**Auto-save on toggle (audit checklist):**

```tsx
const [isPending, startTransition] = useTransition();

const handleToggle = (templateItemId: string, passed: boolean) => {
  startTransition(async () => {
    const result = await saveAuditResponse({
      audit_id: auditId,
      template_item_id: templateItemId,
      passed,
      notes: notes[templateItemId] || null,
    });
    if (result.error) toast.error(result.error);
  });
};
```

**Notes auto-save on blur:**

```tsx
const handleNotesBlur = (templateItemId: string, value: string) => {
  // Only save if the item already has a pass/fail response
  if (responses[templateItemId] !== undefined) {
    startTransition(async () => {
      const result = await saveAuditResponse({
        audit_id: auditId,
        template_item_id: templateItemId,
        passed: responses[templateItemId],
        notes: value.trim() || null,
      });
      if (result.error) toast.error(result.error);
    });
  }
};
```

**Complete audit with validation:**

```tsx
const handleComplete = () => {
  startTransition(async () => {
    const result = await completeAudit({ audit_id: auditId, notes: auditNotes });
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Audit completed successfully.");
      router.push(`/audits/${auditId}`);
    }
  });
};
```

### Score Display — Color Coding

Use conditional styling for the score percentage:

```tsx
function scoreColor(score: number): string {
  if (score >= 80) return "text-green-600";
  if (score >= 60) return "text-amber-600";
  return "text-red-600";
}

function scoreBadgeVariant(score: number): "default" | "secondary" | "destructive" {
  if (score >= 80) return "default";     // green-ish
  if (score >= 60) return "secondary";   // amber-ish
  return "destructive";                   // red
}
```

### Filtering with URL Search Params

The audits list page uses server-side filtering via `searchParams`. The filter component is a Client Component that updates the URL:

```tsx
// In the SSR page:
const store = searchParams?.store || "";
const status = searchParams?.status || "";

let query = supabase.from("audits").select("...");
if (store) query = query.eq("store_id", store);
if (status) query = query.eq("status", status);
query = query.order("created_at", { ascending: false });
```

```tsx
// In the filter client component:
const router = useRouter();
const searchParams = useSearchParams();

const updateFilter = (key: string, value: string) => {
  const params = new URLSearchParams(searchParams.toString());
  if (value) params.set(key, value);
  else params.delete(key);
  router.push(`/audits?${params.toString()}`);
};
```

### Page Access & Role Guards

- `/audits` — accessible by admin, store, factory (different RLS scoping)
- `/audits/[audit-id]` — accessible by admin, store (own store only), factory
- `/audits/[audit-id]/conduct` — admin only; redirect store/factory to `/audits`
- "New Audit" button — rendered only when `profile.role === "admin"`
- "Complete Audit" button — rendered only for admin on draft audits

### Next.js 16 Async Params

In Next.js 16 (app router), `params` and `searchParams` in page components are Promises that must be awaited:

```typescript
export default async function AuditsPage({
  searchParams,
}: {
  searchParams: Promise<{ store?: string; status?: string }>;
}) {
  const { store, status } = await searchParams;
  // ...
}
```

### Project Structure Notes

**Files to CREATE:**

```
supabase/migrations/<timestamp>_create_audits.sql
lib/validations/audits.ts
app/(dashboard)/audits/page.tsx
app/(dashboard)/audits/actions.ts
app/(dashboard)/audits/[audit-id]/page.tsx
app/(dashboard)/audits/[audit-id]/conduct/page.tsx
components/audits/audit-list-table.tsx
components/audits/audit-filters.tsx
components/audits/new-audit-dialog.tsx
components/audits/audit-checklist.tsx
```

**Files to MODIFY:**

```
lib/types/index.ts                — Add AuditStatus, AuditRow, AuditResponseRow types
lib/nav-items.ts                  — Add Audits nav item
```

**Files NOT to touch:**

```
supabase/migrations/*_create_audit_templates.sql  — Story 6-1 migration, never edit
app/(dashboard)/orders/*                          — Unrelated
proxy.ts / middleware                              — No changes needed
lib/supabase/server.ts                            — Already configured
```

### Architecture Compliance

**D5 — RLS:** All access is enforced at the database level. Admin has full CRUD. Store users can only SELECT audits for their store. Factory users can SELECT all. `auth_role()` and `auth_store_id()` helper functions are used in all policies.

**D7 — Server Actions:** `createAudit`, `saveAuditResponse`, and `completeAudit` follow the established pattern: auth check, role check, Zod validation, DB mutation, revalidate, return ActionResult.

**D9 — Error Handling:** Server Actions return `ActionResult<T>`. Client Components use `toast.error()` on failure. All error messages are human-readable English strings.

**Anti-Patterns — NEVER DO:**
- `select('*')` — always specify columns
- `service_role` key in application code — RLS handles access control
- Inline role subqueries in RLS policies — use `auth_role()` / `auth_store_id()`
- `redirect()` inside Server Actions — return result, let client handle navigation
- Compute score on the client — always compute server-side for data integrity
- Allow editing responses on a completed audit — enforce status check server-side
- Skip the unique constraint on `audit_responses(audit_id, template_item_id)` — prevents data corruption

### Library & Framework Requirements

**Already installed — no new packages needed:**

| Package | Purpose | Notes |
|---------|---------|-------|
| `@supabase/ssr` | Server-side Supabase client | Already configured |
| `sonner` | Toast notifications | Already installed |
| `lucide-react` | Icons | Already installed (ClipboardCheck available) |
| `zod` | Validation schemas | Already installed |
| shadcn/ui `Switch` | Pass/fail toggle | Check if installed, may need `npx shadcn@latest add switch` |
| shadcn/ui `Select` | Filter dropdowns | Already available |
| shadcn/ui `Textarea` | Notes input | Already available |
| shadcn/ui `Dialog` | New audit form | Already available |
| shadcn/ui `Badge` | Status/score badges | Already available |
| shadcn/ui `Card` | Layout containers | Already available |
| shadcn/ui `Table` | List display | Already available |

**Check and install if missing:** `Switch` component from shadcn/ui. Run `npx shadcn@latest add switch` if not present in `components/ui/switch.tsx`.

### Testing Requirements

- Run `npm run build` — zero errors
- Run `npm run lint` — zero warnings/errors
- Manual: Admin creates a new audit (select store + template) → redirected to conduct page with all template items visible
- Manual: Admin toggles pass/fail on items → responses saved, page reload preserves state
- Manual: Admin adds notes to items → notes saved on blur
- Manual: Admin clicks "Complete Audit" with all items answered → score computed, status changes to completed, redirected to detail view
- Manual: Admin clicks "Complete Audit" with unanswered items → error toast, audit stays draft
- Manual: Admin views completed audit → score displayed, all responses visible, no edit controls
- Manual: Admin filters audits by store → list updates correctly
- Manual: Admin filters audits by status (draft/completed) → list updates correctly
- Manual: Store User views `/audits` → only sees their store's audits, no "New Audit" button
- Manual: Factory User views `/audits` → sees all audits, no "New Audit" button
- Manual: Store/Factory User navigates to `/audits/[id]/conduct` → redirected away
- Manual: Score color coding — audit with 90% shows green, 70% shows amber, 50% shows red

### Previous Story Intelligence

1. **`date-fns` is NOT installed** — use `Intl.DateTimeFormat("en-CA", ...)` for all date formatting.

2. **`verifyAdmin()` returns supabase client** — reuse the pattern from `products/actions.ts` to avoid double client instantiation.

3. **Next.js 16 async params** — `params` and `searchParams` must be awaited in page components.

4. **Server Action: do NOT call `redirect()` inside** — return result, let the Client Component handle navigation.

5. **`ActionResult<T>` pattern** — return `{ data: T, error: null }` on success; `{ data: null, error: "message" }` on failure. For void actions: `{ data: undefined, error: null }`.

6. **UI Language is English** — all labels, toasts, validation messages, button text in English.

7. **RLS is the enforcement layer** — role check in Server Actions is defense-in-depth. RLS policies are the actual security gate.

8. **`update_updated_at_column()` trigger function already exists** — defined in the stores migration (`20260313153822`). Reuse it for the `audits` table trigger.

### References

- [Source: Story 6-1] `audit_templates` and `audit_template_items` tables — prerequisite for this story
- [Source: architecture.md — D5] RLS helper functions `auth_role()` / `auth_store_id()`
- [Source: architecture.md — D7] Server Actions return `ActionResult<T>`
- [Source: architecture.md — D9] Error handling: human-readable English strings
- [Source: architecture.md — D3] Supabase CLI migrations, never edit previous migration files
- [Source: lib/types/index.ts] Existing type definitions — OrderStatus, ActionResult patterns
- [Source: lib/nav-items.ts] Navigation items with role-based filtering
- [Source: supabase/migrations/20260313153822] `update_updated_at_column()` trigger function
- [Source: memory/feedback_ui_language.md] UI must be in English

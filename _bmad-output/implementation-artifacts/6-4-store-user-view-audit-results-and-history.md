# Story 6.4: Store User — View Audit Results and History

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Store User,
I want to view my store's audit results and history,
so that I can understand how my store performed in compliance checks and address any flagged issues.

As a Factory User,
I want to view all stores' audit results (read-only),
so that I can monitor compliance across the franchise network.

## Acceptance Criteria

1. **Given** a Store User navigates to the Audits section,
   **When** the page loads,
   **Then** only audits belonging to their assigned store are listed — audits from other stores are never visible (RLS enforced).

2. **Given** a Store or Factory User views the audit list,
   **When** audits are displayed,
   **Then** each audit shows the audit date, template name, overall score (percentage), and status, sorted by most recent first.

3. **Given** a Store or Factory User views the audit list,
   **When** the score is displayed,
   **Then** it is color-coded: green for >= 80%, yellow for 60-79%, red for < 60%.

4. **Given** a Store or Factory User clicks on an audit,
   **When** the audit detail page loads,
   **Then** they see the overall score with a color-coded visual indicator, each checklist item with pass/fail status and any notes, photo evidence thumbnails, and admin notes.

5. **Given** a Store or Factory User views an audit detail,
   **When** photo evidence exists on checklist items,
   **Then** thumbnails are displayed and clickable to view the full-size image.

6. **Given** a Store or Factory User views the audit detail,
   **When** the page renders,
   **Then** no create, edit, or delete actions are available — the view is entirely read-only.

7. **Given** a Factory User navigates to the Audits section,
   **When** the page loads,
   **Then** audits from all stores are visible (RLS returns all audits for factory role), with store names displayed on each audit.

8. **Given** a Store User's audit list is empty,
   **When** the page loads,
   **Then** an informative empty state is shown (e.g., "No audits yet for your store.").

9. **Given** the "Audits" navigation item,
   **When** any user with role admin, factory, or store is logged in,
   **Then** the "Audits" nav item is visible in the sidebar.

## Tasks / Subtasks

- [ ] Task 1 — Add audit types to `lib/types/index.ts` (AC: #2, #3, #4, #5)
  - [ ] Add `AuditStatus` type (e.g., `"draft" | "completed"`)
  - [ ] Add `AuditRow` type: `id, store_id, store_name?, template_id, template_name?, auditor_id, status, score, notes, conducted_at, created_at`
  - [ ] Add `AuditResponseRow` type: `id, audit_id, template_item_id, item_label?, passed, notes`
  - [ ] Add `AuditEvidenceRow` type: `id, audit_response_id, file_url, file_type, created_at`

- [ ] Task 2 — Add score color constants to `lib/constants/audit-status.ts` (AC: #3)
  - [ ] Create `lib/constants/audit-status.ts`
  - [ ] Export `AUDIT_STATUS_LABELS` and `AUDIT_STATUS_COLORS` (draft = gray, completed = green)
  - [ ] Export `getScoreColor(score: number): string` — returns CSS classes: green (`text-green-600 bg-green-50`) for >= 80, yellow (`text-amber-600 bg-amber-50`) for 60-79, red (`text-red-600 bg-red-50`) for < 60
  - [ ] Export `getScoreLabel(score: number): string` — returns "Good", "Needs Improvement", or "Critical"

- [ ] Task 3 — Update navigation: add Audits nav item for all roles (AC: #9)
  - [ ] Update `lib/nav-items.ts`: add Audits entry `{ href: "/audits", label: "Audits", icon: ClipboardCheck, roles: ["admin", "factory", "store"] }`
  - [ ] Import `ClipboardCheck` from `lucide-react`

- [ ] Task 4 — Create audit list page `app/(dashboard)/audits/page.tsx` (AC: #1, #2, #3, #7, #8)
  - [ ] Server Component — auth check: get user, get profile, redirect unauthenticated to `/login`
  - [ ] Fetch audits: `.from("audits").select("id, store_id, status, score, notes, conducted_at, created_at, audit_templates(name), stores(name)").order("conducted_at", { ascending: false })`
  - [ ] RLS handles store isolation (store sees own, factory/admin sees all)
  - [ ] Display each audit as a Card with: conducted date, template name, score badge (color-coded), status
  - [ ] Show store name for admin/factory roles
  - [ ] Empty state: "No audits yet for your store." (store) or "No audits yet." (admin/factory)
  - [ ] Each card is a clickable `<Link>` to `/audits/[audit-id]`

- [ ] Task 5 — Create audit detail page `app/(dashboard)/audits/[audit-id]/page.tsx` (AC: #4, #5, #6)
  - [ ] Server Component — auth check: get user, get profile, redirect unauthenticated to `/login`
  - [ ] Fetch audit: `.from("audits").select("id, store_id, status, score, notes, conducted_at, created_at, audit_templates(name), stores(name)").eq("id", auditId).single()`
  - [ ] If audit is null (not found or RLS denied), redirect to `/audits`
  - [ ] Fetch responses: `.from("audit_responses").select("id, audit_id, template_item_id, passed, notes, audit_template_items(label, sort_order)").eq("audit_id", auditId).order("created_at")`
  - [ ] Fetch evidence: `.from("audit_evidence").select("id, audit_response_id, file_url, file_type, created_at").in("audit_response_id", responseIds)`
  - [ ] Sort responses by `audit_template_items.sort_order` client-side after fetch
  - [ ] Display: breadcrumb (Audits > Audit #XXXXXXXX), overall score with large color-coded badge, conducted date, template name, store name, admin notes
  - [ ] Checklist items section: each item shows label, pass/fail badge (green check / red X), notes if any
  - [ ] Evidence thumbnails grouped under their respective checklist items — clickable to open full-size image (use native `<a>` with `target="_blank"` or a lightbox dialog)
  - [ ] No action buttons — entirely read-only

- [ ] Task 6 — Verify RLS policies from Stories 6-1/6-2 cover store and factory SELECT (AC: #1, #7)
  - [ ] Verify `audits` table has SELECT policy for store role (`store_id = auth_store_id()`) and factory role (all rows)
  - [ ] Verify `audit_responses` table has SELECT policy for store role (via audit join) and factory role
  - [ ] Verify `audit_evidence` table has SELECT policy for store role (via audit_response > audit join) and factory role
  - [ ] If any policy is missing, create a migration to add it

- [ ] Task 7 — Build and lint verification (AC: all)
  - [ ] Run `npm run build` — zero errors
  - [ ] Run `npm run lint` — zero warnings/errors

## Quick Reference — Existing Code to Reuse

```
Supabase server client:  import { createClient } from "@/lib/supabase/server"
Types:                   import type { AuditRow, AuditResponseRow, AuditEvidenceRow, AuditStatus } from "@/lib/types"
CN utility:              import { cn } from "@/lib/utils"
UI components:           Badge, Card, CardContent, CardHeader, CardTitle from @/components/ui/*
Breadcrumbs:             import { Breadcrumbs } from "@/components/shared/breadcrumbs"
Icons:                   ClipboardCheck, CheckCircle, XCircle, ArrowLeft, Image from lucide-react
Date formatting:         new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(timestamp))
Nav items:               lib/nav-items.ts — add Audits entry
Score constants:         lib/constants/audit-status.ts (new file)
```

## Dev Notes

### This Story is Read-Only — No Mutations

Story 6-4 is purely read-only. No Server Actions needed. No new database tables or migrations (unless RLS policies are missing from 6-1/6-2). All data access uses existing tables created in Stories 6-1 through 6-3.

### Database Schema Context (from Stories 6-1 through 6-3)

The following tables should already exist:

```sql
-- audit_templates: id, name, description, is_active, created_by, created_at, updated_at
-- audit_template_items: id, template_id, label, sort_order, created_at
-- audits: id, store_id, template_id, auditor_id, status, score, notes, conducted_at, created_at, updated_at
-- audit_responses: id, audit_id, template_item_id, passed, notes, created_at
-- audit_evidence: id, audit_response_id, file_url, file_type, created_at
```

**Score field:** `audits.score` is expected to be a numeric percentage (0-100) calculated and stored when the audit is completed in Story 6-2.

### Navigation Update

In `lib/nav-items.ts`, add a new entry for Audits:

```typescript
import { ClipboardCheck, LayoutDashboard, Package, Settings, ShoppingBasket, Users } from "lucide-react";

// Add to allNavItems array:
{ href: "/audits", label: "Audits", icon: ClipboardCheck, roles: ["admin", "factory", "store"] },
```

Place it after Products and before Users to maintain a logical grouping (Orders, Products, Audits, Users, Settings).

### Score Color Logic

The score badge uses conditional CSS classes based on the percentage:

```typescript
export function getScoreColor(score: number): string {
  if (score >= 80) return "text-green-600 bg-green-50 border-green-200";
  if (score >= 60) return "text-amber-600 bg-amber-50 border-amber-200";
  return "text-red-600 bg-red-50 border-red-200";
}
```

Use this in both the list page (small badge) and the detail page (large prominent display).

### Audit List Page — Key Implementation Details

**Route:** `app/(dashboard)/audits/page.tsx`

**Data query:**

```typescript
const { data: audits } = await supabase
  .from("audits")
  .select("id, store_id, status, score, notes, conducted_at, created_at, audit_templates(name), stores(name)")
  .order("conducted_at", { ascending: false });
```

RLS ensures:
- Store users see only audits where `store_id = auth_store_id()`
- Factory users see all audits
- Admin users see all audits

**Card layout per audit:**
- Left: conducted date + template name
- Right: score badge (color-coded) + status badge
- For admin/factory: store name shown below template name
- Clickable — entire card navigates to `/audits/[audit-id]`

### Audit Detail Page — Key Implementation Details

**Route:** `app/(dashboard)/audits/[audit-id]/page.tsx`

**Data queries (all via RLS):**

```typescript
// 1. Fetch audit with template and store name
const { data: audit } = await supabase
  .from("audits")
  .select("id, store_id, status, score, notes, conducted_at, created_at, audit_templates(name), stores(name)")
  .eq("id", auditId)
  .single();

// 2. Fetch responses with template item labels
const { data: responses } = await supabase
  .from("audit_responses")
  .select("id, audit_id, template_item_id, passed, notes, audit_template_items(label, sort_order)")
  .eq("audit_id", auditId);

// 3. Fetch evidence for all responses
const responseIds = (responses ?? []).map(r => r.id);
const { data: evidence } = await supabase
  .from("audit_evidence")
  .select("id, audit_response_id, file_url, file_type, created_at")
  .in("audit_response_id", responseIds);
```

**Evidence display:**
- Group evidence by `audit_response_id` into a Map
- Under each checklist item, if evidence exists, show thumbnails (small `<img>` tags)
- Thumbnails link to full-size image via `<a href={file_url} target="_blank" rel="noopener noreferrer">`
- Alternatively, use a Dialog/modal for a lightbox experience — but a simple new-tab link is sufficient for this story

**Pass/fail display per checklist item:**
- Passed: green CheckCircle icon + "Pass" label
- Failed: red XCircle icon + "Fail" label
- Notes displayed below in muted text if present

**Admin notes:**
- If `audit.notes` is not null/empty, display in a Card at the top or bottom of the detail page
- Label: "Auditor Notes"

### Dynamic Route Param — Next.js 16

```typescript
export default async function AuditDetailPage({
  params,
}: {
  params: Promise<{ "audit-id": string }>;
}) {
  const { "audit-id": auditId } = await params;
  // ...
}
```

### RLS Verification Checklist

Before implementing pages, verify these SELECT policies exist (should have been created in Stories 6-1/6-2/6-3):

| Table | Policy | Expected |
|-------|--------|----------|
| `audits` | SELECT for store | `store_id = auth_store_id()` |
| `audits` | SELECT for factory | All rows (no WHERE filter or `auth_role() = 'factory'`) |
| `audits` | SELECT for admin | All rows |
| `audit_responses` | SELECT for store | Via join to audits where `store_id = auth_store_id()` |
| `audit_responses` | SELECT for factory | All rows |
| `audit_responses` | SELECT for admin | All rows |
| `audit_evidence` | SELECT for store | Via join chain to audits |
| `audit_evidence` | SELECT for factory | All rows |
| `audit_evidence` | SELECT for admin | All rows |

If any policies are missing, create a single migration: `supabase/migrations/YYYYMMDDHHMMSS_audit_store_factory_select_policies.sql`

### Architecture Compliance

**D7 — Server Actions:** Not applicable — this story is read-only. No mutations.

**D8 — SSR:** Both audit list and detail pages are Server Components. Data fetched server-side via Supabase server client. No client components needed (no interactivity beyond navigation and image viewing).

**D9 — Error Handling:** If audit not found (RLS denied or invalid ID), redirect to `/audits`. No error toasts needed since there are no user-triggered actions.

**D10 — State Management:** No client state needed. Pure SSR pages.

**Anti-Patterns — NEVER DO:**
- `supabase.from('audits').select('*')` — always select specific columns
- Import server Supabase client in a client component
- Use `service_role` key — RLS handles all access
- `new Date().toLocaleDateString()` — use `Intl.DateTimeFormat("en-CA", ...)`
- Create API routes for fetching audit data — SSR does this directly
- Add create/edit/delete buttons on these pages — this is a read-only story

### Library & Framework Requirements

**No new packages needed.** All dependencies (shadcn/ui Card, Badge, lucide-react icons) are already installed.

### Project Structure

**Files to CREATE:**

```
scotty-ops/
├── app/(dashboard)/audits/
│   ├── page.tsx                          — Audit list page (Server Component)
│   └── [audit-id]/
│       └── page.tsx                      — Audit detail page (Server Component)
├── lib/constants/
│   └── audit-status.ts                   — Score color helpers and audit status constants
```

**Files to MODIFY:**

```
scotty-ops/
├── lib/nav-items.ts                      — Add Audits nav entry for admin, factory, store
├── lib/types/index.ts                    — Add AuditStatus, AuditRow, AuditResponseRow, AuditEvidenceRow
```

**Files NOT to touch:**
- Any files in `app/(dashboard)/orders/` — unrelated
- `supabase/migrations/` — no new migrations needed (unless RLS verification in Task 6 reveals gaps)
- `middleware.ts` / `proxy.ts` — no changes needed
- `components/orders/*` — unrelated

### Testing Requirements

- Run `npm run build` — zero errors
- Run `npm run lint` — zero warnings/errors
- Manual: Store User sees only their own store's audits (RLS)
- Manual: Factory User sees all stores' audits with store names displayed
- Manual: Admin User sees all stores' audits with store names displayed
- Manual: Audit list shows date, template name, score (color-coded), and status
- Manual: Score badge is green for >= 80%, yellow for 60-79%, red for < 60%
- Manual: Clicking an audit navigates to `/audits/[audit-id]`
- Manual: Detail page shows overall score with color-coded indicator
- Manual: Detail page shows each checklist item with pass/fail and notes
- Manual: Detail page shows photo evidence thumbnails (clickable to full size)
- Manual: Detail page shows auditor notes
- Manual: No create/edit/delete buttons visible on either page for store/factory users
- Manual: Accessing another store's audit ID redirects to `/audits` (store user)
- Manual: Non-existent audit ID redirects to `/audits`
- Manual: "Audits" nav item visible for admin, factory, and store roles
- Manual: Empty state shown when no audits exist

### Previous Story Intelligence (from Stories 3-1 through 3-6)

1. **`date-fns` is NOT installed** — use `Intl.DateTimeFormat("en-CA", ...)` for all date formatting.
2. **Next.js 16 async params** — route params must be awaited: `const { "audit-id": auditId } = await params;`
3. **RLS is the enforcement layer** — application-layer role checks not needed for data access (RLS denies unauthorized reads).
4. **UI Language is English** — all labels in English per project feedback.
5. **Server Component read-only pattern** — established in Story 3-2 (order detail for store users). Follow the same pattern.
6. **Breadcrumb pattern** — use `<Breadcrumbs>` component from `components/shared/breadcrumbs.tsx`.
7. **Card + Badge pattern** — established across orders and products pages. Reuse the same approach.
8. **`formatPrice` not needed** — this story deals with scores (percentages), not prices.

### References

- [Source: sprint-status.yaml — Epic 6, Story 6-4] `store-user-view-audit-results-and-history`
- [Source: Story 6-1] audit_templates table, audit_template_items table, RLS policies for admin
- [Source: Story 6-2] audits table, audit_responses table, scoring logic
- [Source: Story 6-3] audit_evidence table, photo upload and storage
- [Source: Story 3-2] Read-only detail page pattern for store users (Server Component, RLS, breadcrumbs)
- [Source: lib/nav-items.ts] Current navigation structure — Audits entry to be added
- [Source: lib/constants/order-status.ts] Pattern for status color constants
- [Source: memory/feedback_ui_language.md] UI must be in English

# Quick Tech Spec: Allow Commissary to Create & Conduct Audits

Status: ready-for-dev

## Change Summary

Expand audit permissions so the **commissary** role can create new audits, respond to checklist items, and complete audits — the same capabilities as admin. Commissary must **NOT** gain access to audit template management (create/edit/delete templates), which remains admin-only.

## Motivation

The commissary role represents the production facility that fulfills store orders. They need to conduct store audits as part of quality/compliance checks. The original Story 6-2 restricted audits to admin-only, which was too narrow for the actual business workflow.

## Scope

### In Scope
- Commissary can create new audits (select store + template)
- Commissary can conduct audits (respond to checklist, add notes, upload evidence)
- Commissary can complete audits (finalize score)
- Commissary can see all audits (already implemented via RLS `audits_factory_select`)

### Out of Scope
- Audit template management — stays admin-only (no changes to `audit_templates` RLS or `/audits/templates` page)
- Store role — stays read-only (no changes)
- Any schema/table changes — only RLS policies and application code

## Changes Required

### 1. New Migration: `20260320140000_commissary_audit_permissions.sql`

Add RLS policies granting commissary INSERT/UPDATE on `audits` and `audit_responses`.

```sql
-- Migration: commissary_audit_permissions
-- Allows commissary role to create and conduct audits (not templates).
-- Depends on: create_audits, rename_factory_to_commissary

-- ── audits: commissary can create and update ──────────────────────────────

CREATE POLICY "audits_commissary_insert"
  ON audits FOR INSERT
  WITH CHECK (auth_role() = 'commissary');

CREATE POLICY "audits_commissary_update"
  ON audits FOR UPDATE
  USING (auth_role() = 'commissary');

-- ── audit_responses: commissary can insert and update ─────────────────────

CREATE POLICY "audit_responses_commissary_insert"
  ON audit_responses FOR INSERT
  WITH CHECK (
    auth_role() = 'commissary'
    AND EXISTS (
      SELECT 1 FROM audits WHERE id = audit_id
    )
  );

CREATE POLICY "audit_responses_commissary_update"
  ON audit_responses FOR UPDATE
  USING (
    auth_role() = 'commissary'
    AND EXISTS (
      SELECT 1 FROM audits WHERE id = audit_id
    )
  );

-- ── audit_evidence: commissary can insert (upload photos) ─────────────────

CREATE POLICY "audit_evidence_commissary_insert"
  ON audit_evidence FOR INSERT
  WITH CHECK (
    auth_role() = 'commissary'
    AND EXISTS (
      SELECT 1 FROM audit_responses ar
      JOIN audits a ON a.id = ar.audit_id
      WHERE ar.id = audit_response_id
    )
  );
```

**Note:** The `rename_factory_to_commissary` migration must be applied first. The existing `audits_factory_select` policy (which became commissary after rename) already grants SELECT on all audits. Similarly, `audit_responses_factory_select` already grants SELECT on responses. We only need to add INSERT/UPDATE.

### 2. Server Actions: `app/(dashboard)/audits/actions.ts`

**Change:** Replace `verifyAdmin()` with `verifyAdminOrCommissary()` for audit actions.

```typescript
/** Verifies the current session belongs to admin or commissary. */
async function verifyAdminOrCommissary() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (profile?.role !== "admin" && profile?.role !== "commissary") return null;
  return { supabase, userId: user.id };
}
```

- `createAudit` — use `verifyAdminOrCommissary()`
- `saveAuditResponse` — use `verifyAdminOrCommissary()`
- `completeAudit` — use `verifyAdminOrCommissary()`

Keep the original `verifyAdmin()` function if it's used elsewhere, or remove if not.

### 3. Audits List Page: `app/(dashboard)/audits/page.tsx`

**Changes:**

a) Replace `isAdmin` gate with `canConduct`:
```typescript
const canConduct = role === "admin" || role === "commissary";
```

b) Fetch active templates for commissary too (line 127):
```typescript
if (canConduct) {  // was: if (isAdmin)
```

c) Show "New Audit" button for commissary (line 155):
```typescript
{canConduct && activeTemplates.length > 0 && (
  <NewAuditDialog stores={allStores} templates={activeTemplates} />
)}
```

d) Keep "Templates" management link admin-only (line 147) — no change needed there.

e) Update empty state text (line 169):
```typescript
{canConduct
  ? "Create your first audit to get started."
  : "No audits have been conducted yet."}
```

### 4. Conduct Page: `app/(dashboard)/audits/[audit-id]/conduct/page.tsx`

**Change line 27:** Allow commissary access:
```typescript
if (!profile || (profile.role !== "admin" && profile.role !== "commissary")) {
  redirect("/audits");
}
```

### 5. Audit Detail Page: `app/(dashboard)/audits/[audit-id]/page.tsx`

Check if there's a "Continue Audit" or "Resume" link for draft audits that is admin-gated — if so, extend to commissary too.

## Files to Modify

| File | Change |
|------|--------|
| `supabase/migrations/20260320140000_commissary_audit_permissions.sql` | **NEW** — RLS policies |
| `app/(dashboard)/audits/actions.ts` | `verifyAdmin` → `verifyAdminOrCommissary` |
| `app/(dashboard)/audits/page.tsx` | `isAdmin` → `canConduct` for New Audit button + template fetch |
| `app/(dashboard)/audits/[audit-id]/conduct/page.tsx` | Allow commissary role access |
| `app/(dashboard)/audits/[audit-id]/page.tsx` | Allow commissary to see "Continue" link for drafts |

## Files NOT to Touch

| File | Reason |
|------|--------|
| `supabase/migrations/20260319200000_create_audit_templates.sql` | Template management stays admin-only |
| `supabase/migrations/20260319300000_create_audits.sql` | Never edit existing migrations |
| `app/(dashboard)/audits/templates/*` | Template CRUD stays admin-only |
| `components/audits/audit-checklist.tsx` | No role logic — works for any authenticated user |
| `components/audits/new-audit-dialog.tsx` | No role logic — just a form |

## Verification

- [ ] `npm run build` — zero errors
- [ ] `npm run lint` — zero warnings
- [ ] Manual: Commissary user sees "New Audit" button on `/audits`
- [ ] Manual: Commissary can create audit, conduct checklist, complete audit
- [ ] Manual: Commissary does NOT see "Templates" management link
- [ ] Manual: Store user still read-only — no "New Audit" button
- [ ] Manual: Admin retains full access (audits + templates)

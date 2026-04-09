# Quick Spec: Admin-Editable Audit Ratings

## Overview
Allow **admin users only** to edit individual audit response ratings (poor/satisfactory/good) and notes on **completed** audits, with automatic score recalculation. Currently, once an audit is completed, ratings are read-only for everyone.

## Scope
- **In scope:** Admin can edit rating and notes per item on a completed audit; score recalculates on save
- **Out of scope:** Editing audit-level notes/metadata, re-opening audits, editing evidence, commissary editing, audit history/changelog

## Target Files

| File | What changes |
|------|-------------|
| `app/(dashboard)/audits/[audit-id]/page.tsx` | Add inline edit UI for each response (admin only, completed audits) |
| `app/(dashboard)/audits/actions.ts` | Add `updateAuditResponse` server action (admin-only, recalculates score) |
| `lib/validations/audits.ts` | Add `updateResponseSchema` validation |
| `components/audits/editable-audit-rating.tsx` | **New** — client component for inline rating editing |

## Database
No schema or migration changes needed. The existing `audit_responses` table already supports UPDATE, and admin RLS policies already grant full UPDATE access. The `audits.score` field already exists for recalculation.

## UI Design

### Audit Detail Page (completed audit, admin user)
Each checklist item currently shows a read-only rating badge. For admin users on completed audits:

1. Add a small **pencil icon button** next to each rating badge
2. Clicking it enters **edit mode** for that single item:
   - Show the 3 rating buttons (Poor | Satisfactory | Good) — same style as in `audit-checklist.tsx`
   - Show a notes textarea (pre-filled with existing notes)
   - Show Save / Cancel buttons
3. On **Save**: call `updateAuditResponse`, show loading state, exit edit mode, refresh page data
4. On **Cancel**: discard changes, exit edit mode
5. Only one item can be in edit mode at a time

### Visual indicator
- When a rating has been modified (different from original), no special treatment needed — the new rating simply replaces the old one. Keep it simple.

## Implementation Details

### New Validation Schema (`lib/validations/audits.ts`)
```typescript
export const updateResponseSchema = z.object({
  response_id: z.string().uuid("Invalid response ID."),
  audit_id: z.string().uuid("Invalid audit ID."),
  rating: z.enum(["poor", "satisfactory", "good"]),
  notes: z.string().max(1000).optional(),
});

export type UpdateResponseValues = z.infer<typeof updateResponseSchema>;
```

### New Server Action (`app/(dashboard)/audits/actions.ts`)

`updateAuditResponse(values: UpdateResponseValues)`:
1. Validate input with `updateResponseSchema`
2. Call `verifyAdmin()` — admin only
3. Verify the audit exists and IS completed (`conducted_at IS NOT NULL`)
4. Update the `audit_responses` row: set `rating` and `notes`
5. Recalculate the audit score using the same weighted formula already in `completeAudit`:
   - Fetch all responses for the audit
   - `poor=0, satisfactory=0.5, good=1`
   - `score = Math.round((sumWeights / totalItems) * 10000) / 100`
6. Update `audits.score` with the new score
7. `revalidatePath` for the audit detail page
8. Return the new score

### Client Component (`components/audits/editable-audit-rating.tsx`)

Props:
```typescript
interface EditableAuditRatingProps {
  responseId: string;
  auditId: string;
  currentRating: AuditRating;
  currentNotes: string | null;
}
```

- Uses `useState` for edit mode toggle, selected rating, notes text
- Uses `useTransition` for the save action pending state
- Rating buttons use `AUDIT_RATING_STYLES` and `AUDIT_RATING_LABELS` from existing constants
- On save success: calls `router.refresh()` to pick up recalculated score

### Audit Detail Page Changes (`app/(dashboard)/audits/[audit-id]/page.tsx`)

In the item rendering loop, when `isAdmin && isCompleted && response`:
- Replace the static `<Badge>` with `<EditableAuditRating>` component
- Pass `responseId`, `auditId`, `currentRating`, `currentNotes`

When `!isAdmin` or `!isCompleted`, keep the existing read-only `<Badge>`.

The page must add `"use client"` considerations — since the page is a server component, the `EditableAuditRating` will be a standalone client component imported into it. No page-level changes to server/client boundary needed.

## Acceptance Criteria
- [ ] Admin sees edit (pencil) icon next to each rating on completed audits
- [ ] Clicking edit shows rating buttons + notes textarea + save/cancel
- [ ] Saving updates the rating in the database
- [ ] Audit score recalculates and displays immediately after save
- [ ] Non-admin users see no edit controls (read-only as before)
- [ ] In-progress (draft) audits are unaffected — no edit button shown
- [ ] Commissary and store users cannot call the server action (returns Unauthorized)
- [ ] Notes field is optional and preserves existing notes if unchanged

## Dependencies
- No new packages needed
- Reuses existing `AUDIT_RATING_STYLES`, `AUDIT_RATING_LABELS` constants
- Reuses existing `verifyAdmin()` helper in actions
- Reuses existing score calculation logic (extract to shared helper if desired)

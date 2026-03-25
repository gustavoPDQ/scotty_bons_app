# Quick Tech Spec: Audit Categories & 3-Level Ratings

## Problem

1. Audit template items are flat — no grouping. Real templates have ~70 items that need to be organized by category.
2. Responses are binary (pass/fail). Business needs 3 levels: **poor**, **satisfactory**, **good**.

## Solution Overview

### Change 1: Item Categories

Add an `audit_template_categories` table. Each template has N categories, each category has N items.

### Change 2: 3-Level Rating

Replace the `passed` boolean column in `audit_responses` with a `rating` text column constrained to `'poor' | 'satisfactory' | 'good'`.

Score recalculation: `poor = 0`, `satisfactory = 0.5`, `good = 1`. Score = `(sum_of_weights / total_items) * 100`.

---

## Database Changes

### New Table: `audit_template_categories`

```sql
CREATE TABLE audit_template_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES audit_templates(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) <= 100),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_atc_template ON audit_template_categories(template_id);
```

### Alter `audit_template_items`

- Add `category_id uuid REFERENCES audit_template_categories(id) ON DELETE CASCADE`
- Remove direct `template_id` FK (item now belongs to template via category)
- Or keep `template_id` for query convenience — **Decision: keep template_id** for simpler queries, add `category_id` as required FK.

```sql
ALTER TABLE audit_template_items
  ADD COLUMN category_id uuid NOT NULL REFERENCES audit_template_categories(id) ON DELETE CASCADE;
```

> **Migration note**: existing items need a default category per template. Migration creates a "General" category for each existing template and assigns all items to it.

### Alter `audit_responses`

```sql
-- Add new column
ALTER TABLE audit_responses
  ADD COLUMN rating text CHECK (rating IN ('poor', 'satisfactory', 'good'));

-- Migrate existing data
UPDATE audit_responses SET rating = CASE WHEN passed THEN 'good' ELSE 'poor' END;

-- Make NOT NULL after migration
ALTER TABLE audit_responses ALTER COLUMN rating SET NOT NULL;

-- Drop old column
ALTER TABLE audit_responses DROP COLUMN passed;
```

### Score Calculation Update

```sql
-- In completeAudit action:
-- poor = 0, satisfactory = 0.5, good = 1
SELECT
  ROUND(
    (SUM(CASE rating WHEN 'good' THEN 1.0 WHEN 'satisfactory' THEN 0.5 ELSE 0.0 END)
     / COUNT(*)::numeric) * 100,
    2
  ) AS score
FROM audit_responses
WHERE audit_id = $1;
```

### RLS for `audit_template_categories`

Same policies as `audit_template_items`:
- Admin: full CRUD
- Store/Commissary: SELECT where template is_active = true

---

## TypeScript Type Changes

### New Types

```typescript
// lib/types/index.ts
export interface AuditTemplateCategoryRow {
  id: string;
  template_id: string;
  name: string;
  sort_order: number;
  created_at: string;
}

export type AuditRating = "poor" | "satisfactory" | "good";
```

### Modified Types

```typescript
// AuditResponseRow — replace `passed: boolean` with:
export interface AuditResponseRow {
  id: string;
  audit_id: string;
  template_item_id: string;
  rating: AuditRating; // was: passed: boolean
  notes: string | null;
}
```

### Generated Supabase Types

Regenerate `types/supabase.ts` after migration.

---

## Constants Changes

### `lib/constants/audit-status.ts`

Add rating labels and styles:

```typescript
export const AUDIT_RATING_LABELS: Record<AuditRating, string> = {
  poor: "Poor",
  satisfactory: "Satisfactory",
  good: "Good",
};

export const AUDIT_RATING_STYLES: Record<AuditRating, { backgroundColor: string; color: string }> = {
  poor: { backgroundColor: "#fecaca", color: "#991b1b" },       // red
  satisfactory: { backgroundColor: "#fef08a", color: "#854d0e" }, // amber/yellow
  good: { backgroundColor: "#bbf7d0", color: "#166534" },        // green
};
```

---

## Validation Changes

### `lib/validations/audit-templates.ts`

Update `createTemplateSchema`:

```typescript
export const createTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  categories: z.array(z.object({
    name: z.string().min(1).max(100),
    sort_order: z.number().int().min(0),
    items: z.array(z.object({
      label: z.string().min(1).max(200),
      sort_order: z.number().int().min(0),
    })).min(1),
  })).min(1),
});
```

### `lib/validations/audits.ts`

Update `saveResponseSchema`:

```typescript
export const saveResponseSchema = z.object({
  audit_id: z.string().uuid(),
  template_item_id: z.string().uuid(),
  rating: z.enum(["poor", "satisfactory", "good"]), // was: passed: z.boolean()
  notes: z.string().max(1000).optional(),
});
```

---

## UI Changes

### Template Form (`components/audits/template-form.tsx`)

- Top-level form manages array of **categories** (name + sort_order)
- Each category expands to show its **items** array
- Add/remove categories with add/remove items within each
- Drag or arrow controls for reordering both categories and items
- Category name input + collapsible item list underneath

### Conduct Page (`components/audits/audit-checklist.tsx`)

- Group items under category headings (collapsible sections)
- Replace pass/fail toggle with **3-button radio group**: Poor | Satisfactory | Good
  - Poor: red outline/fill
  - Satisfactory: amber/yellow outline/fill
  - Good: green outline/fill
- Progress bar and counter updated: "X of Y items rated"
- Category-level subtotals optional (nice-to-have)

### Audit Detail View (`app/(dashboard)/audits/[audit-id]/page.tsx`)

- Group items under category headings
- Replace checkmark/X icons with colored rating badge (Poor/Satisfactory/Good)

### Audit List (`app/(dashboard)/audits/page.tsx`)

- No changes needed (score display already works)

---

## Server Action Changes

### `audits/templates/actions.ts`

- `createTemplate()`: Insert categories first, then items with category_id
- `updateTemplate()`: Delete old categories (cascades to items), insert new ones
- Queries that fetch template items must JOIN categories for grouping

### `audits/actions.ts`

- `saveAuditResponse()`: Accept `rating` instead of `passed`
- `completeAudit()`: Update score formula to weighted calculation

### Data Fetching

- Audit detail page: fetch items with their category info, group by category
- Conduct page: same grouping
- Template detail: fetch categories with nested items

---

## Migration Strategy

Single migration file: `20260320200000_audit_categories_and_ratings.sql`

1. Create `audit_template_categories` table + RLS
2. For each existing template, create a "General" default category
3. Add `category_id` to `audit_template_items`, populate from default categories
4. Make `category_id` NOT NULL
5. Add `rating` to `audit_responses`, migrate `passed` → rating
6. Drop `passed` column

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `supabase/migrations/20260320200000_audit_categories_and_ratings.sql` | CREATE |
| `types/supabase.ts` | REGENERATE |
| `lib/types/database.types.ts` | MODIFY (add category type) |
| `lib/types/index.ts` | MODIFY (add AuditRating, AuditTemplateCategoryRow) |
| `lib/constants/audit-status.ts` | MODIFY (add rating labels/styles) |
| `lib/validations/audit-templates.ts` | MODIFY (categories structure) |
| `lib/validations/audits.ts` | MODIFY (rating instead of passed) |
| `components/audits/template-form.tsx` | MODIFY (categories + nested items) |
| `components/audits/audit-checklist.tsx` | MODIFY (category sections, 3-level rating) |
| `app/(dashboard)/audits/[audit-id]/page.tsx` | MODIFY (category grouping, rating badges) |
| `app/(dashboard)/audits/[audit-id]/conduct/page.tsx` | MODIFY (pass grouped items to checklist) |
| `app/(dashboard)/audits/templates/actions.ts` | MODIFY (category CRUD) |
| `app/(dashboard)/audits/actions.ts` | MODIFY (rating field, score formula) |

---

## Risks & Notes

- **Data migration**: Existing audits with boolean `passed` are migrated as `good`/`poor`. No data loss.
- **~70 items per template**: UI must handle this well — collapsible categories are essential for usability.
- **Score interpretation thresholds** (Good >= 80, Needs Improvement >= 60, Critical < 60) remain unchanged — the weighted scoring naturally maps into the same 0-100 range.
- **Evidence system**: Unaffected — evidence attaches to responses regardless of rating type.

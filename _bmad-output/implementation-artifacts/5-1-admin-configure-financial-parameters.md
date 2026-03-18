# Story 5.1: Admin — Configure Financial Parameters

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an Admin,
I want to configure financial parameters (tax rate, currency, payment terms, company details) for invoicing,
so that generated invoices (Story 5-2) display accurate tax calculations and company information.

## Acceptance Criteria

1. **Given** an Admin navigates to the Settings page,
   **When** the page loads,
   **Then** a "Financial Configuration" section is displayed below the Account section, with editable fields for: tax rate, currency, payment terms, company name, company address, company phone, and company email.

2. **Given** an Admin fills in or updates any financial setting fields,
   **When** they click "Save",
   **Then** all values are persisted to the `financial_settings` table, a success toast is shown ("Financial settings saved."), and the form reflects the saved values.

3. **Given** the `financial_settings` table has no rows yet (first-time setup),
   **When** the Admin opens the Settings page,
   **Then** the form fields are empty (or show sensible defaults: tax rate 0, currency "CAD") and the Admin can fill them in and save.

4. **Given** an Admin enters an invalid tax rate (negative, over 100, or non-numeric),
   **When** they attempt to save,
   **Then** a client-side validation error is shown and the form is not submitted.

5. **Given** an Admin enters an invalid email in the company email field,
   **When** they attempt to save,
   **Then** a client-side validation error is shown and the form is not submitted.

6. **Given** a non-Admin user (Store or Factory) views the Settings page,
   **When** the page renders,
   **Then** the Financial Configuration section is NOT displayed — only the Account section is visible.

7. **Given** a non-Admin user attempts to call the `saveFinancialSettings` Server Action directly,
   **When** the action executes,
   **Then** it returns `{ data: null, error: "Unauthorized." }` and no data is written.

8. **Given** a non-Admin user queries the `financial_settings` table directly via Supabase,
   **When** the query executes,
   **Then** RLS denies access and returns zero rows.

9. **Given** the Server Action fails (network or DB error),
   **When** the error is returned,
   **Then** an error toast is displayed ("Failed to save financial settings. Please try again.") and the previous values remain unchanged.

## Tasks / Subtasks

- [ ] Task 1 — DB migration: create `financial_settings` table with RLS (AC: #3, #8)
  - [ ] Create `supabase/migrations/20260318200000_create_financial_settings.sql`
  - [ ] Create table `financial_settings` with columns: `key TEXT PRIMARY KEY`, `value TEXT NOT NULL`, `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`
  - [ ] Enable RLS: `ALTER TABLE financial_settings ENABLE ROW LEVEL SECURITY`
  - [ ] Create policy `financial_settings_select_admin`: `FOR SELECT USING (auth_role() = 'admin')`
  - [ ] Create policy `financial_settings_update_admin`: `FOR UPDATE USING (auth_role() = 'admin')`
  - [ ] Create policy `financial_settings_insert_admin`: `FOR INSERT WITH CHECK (auth_role() = 'admin')`
  - [ ] Seed default rows for all keys with empty/default values (optional — the app handles missing rows gracefully)

- [ ] Task 2 — Add `Textarea` shadcn/ui component (prerequisite)
  - [ ] Run `npx shadcn@latest add textarea` to generate `components/ui/textarea.tsx`

- [ ] Task 3 — Zod validation schema for financial settings (AC: #4, #5)
  - [ ] Add `financialSettingsSchema` to `lib/validations/settings.ts`
  - [ ] Fields: `tax_rate` (number, min 0, max 100), `currency` (string, min 1, max 10), `payment_terms` (string, max 500, optional), `company_name` (string, max 200, optional), `company_address` (string, max 500, optional), `company_phone` (string, max 50, optional), `company_email` (string, email or empty, optional)
  - [ ] Export `FinancialSettingsValues` type

- [ ] Task 4 — Server Action: `getFinancialSettings` and `saveFinancialSettings` (AC: #2, #3, #7, #9)
  - [ ] Add both actions to `app/(dashboard)/settings/actions.ts`
  - [ ] `getFinancialSettings(): Promise<ActionResult<Record<string, string>>>` — admin-only, SELECT all rows from `financial_settings`, return as key-value object
  - [ ] `saveFinancialSettings(values: FinancialSettingsValues): Promise<ActionResult<null>>` — admin-only, Zod validate, upsert each key-value pair, revalidatePath("/settings")
  - [ ] Auth check: get user, get profile, return `{ data: null, error: "Unauthorized." }` if not admin
  - [ ] On success: `revalidatePath("/settings")`; return `{ data: null, error: null }`
  - [ ] On error: return `{ data: null, error: "Failed to save financial settings. Please try again." }`

- [ ] Task 5 — Client Component: `FinancialSettingsForm` (AC: #1, #2, #4, #5, #9)
  - [ ] Create `components/settings/financial-settings-form.tsx` with `"use client"` directive
  - [ ] Props: `initialValues: Record<string, string>`
  - [ ] Use React Hook Form + Zod resolver with `financialSettingsSchema`
  - [ ] Fields: Tax Rate (Input type="number" step="0.01"), Currency (Input), Payment Terms (Textarea), Company Name (Input), Company Address (Textarea), Company Phone (Input), Company Email (Input type="email")
  - [ ] Use `useTransition` for pending state — disable Save button while `isPending`
  - [ ] On submit: call `saveFinancialSettings`, toast success/error
  - [ ] Wrap in Card with CardHeader "Financial Configuration" and CardContent

- [ ] Task 6 — Integrate into Settings page (AC: #1, #6)
  - [ ] Update `app/(dashboard)/settings/page.tsx`
  - [ ] If `isAdmin`, fetch financial settings via `getFinancialSettings()` in the Server Component
  - [ ] Pass result to `<FinancialSettingsForm initialValues={settings} />`
  - [ ] Replace the existing "coming soon" placeholder with the actual form component

- [ ] Task 7 — Build and lint verification (AC: all)
  - [ ] Run `npm run build` — zero errors
  - [ ] Run `npm run lint` — zero warnings/errors
  - [ ] Verify TypeScript compilation passes

## Quick Reference — Existing Code to Reuse

```
Supabase server client:  import { createClient } from "@/lib/supabase/server"
Types:                   import type { ActionResult } from "@/lib/types"
Existing settings page:  app/(dashboard)/settings/page.tsx (already has isAdmin check)
Existing settings acts:  app/(dashboard)/settings/actions.ts (changePassword, changeEmail)
Validation file:         lib/validations/settings.ts (changePasswordSchema, changeEmailSchema)
CN utility:              import { cn } from "@/lib/utils"
UI components:           Button, Card*, Input, Label, Textarea from @/components/ui/*
Toast:                   import { toast } from "sonner"
revalidatePath:          import { revalidatePath } from "next/cache"
useTransition:           import { useTransition } from "react"
RLS helpers:             auth_role() — defined in 20260313153929_create_rls_helpers.sql
Nav items:               Settings already in sidebar for all roles (lib/nav-items.ts line 16)
```

## Dev Notes

### Key-Value Table Design — Why Not a Single JSON Row

A key-value `financial_settings` table is chosen over a single-row JSON approach because:
1. Upsert per key is atomic and avoids read-modify-write race conditions
2. Adding new settings in future stories is a simple INSERT — no schema change
3. RLS policies work naturally on individual rows
4. Simpler SQL — no JSON path operators needed

**Table structure:**

```sql
CREATE TABLE financial_settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Known keys for Story 5-1:**

| Key | Example Value | Notes |
|-----|--------------|-------|
| `tax_rate` | `13` | Percentage as string, parsed to number in app code |
| `currency` | `CAD` | ISO 4217 currency code |
| `payment_terms` | `Net 30 days` | Free text for invoice display |
| `company_name` | `Scotty Supply Co.` | Invoice header |
| `company_address` | `123 Main St, Toronto, ON` | Invoice header |
| `company_phone` | `+1 416-555-0100` | Invoice header |
| `company_email` | `billing@scotty.com` | Invoice header |

### SQL Migration

```sql
-- Migration: create_financial_settings
-- Creates key-value table for financial/invoice configuration.
-- Admin-only access via RLS.
-- Depends on: create_rls_helpers (for auth_role())

CREATE TABLE financial_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE financial_settings ENABLE ROW LEVEL SECURITY;

-- Admin-only SELECT
CREATE POLICY "financial_settings_select_admin"
  ON financial_settings FOR SELECT
  USING (auth_role() = 'admin');

-- Admin-only INSERT (first-time save)
CREATE POLICY "financial_settings_insert_admin"
  ON financial_settings FOR INSERT
  WITH CHECK (auth_role() = 'admin');

-- Admin-only UPDATE (subsequent saves)
CREATE POLICY "financial_settings_update_admin"
  ON financial_settings FOR UPDATE
  USING (auth_role() = 'admin');
```

**No DELETE policy** — settings rows should never be deleted, only updated.

### Zod Validation Schema

Add to `lib/validations/settings.ts`:

```typescript
export const financialSettingsSchema = z.object({
  tax_rate: z
    .number({ invalid_type_error: "Tax rate must be a number." })
    .min(0, "Tax rate cannot be negative.")
    .max(100, "Tax rate cannot exceed 100%."),
  currency: z
    .string()
    .min(1, "Currency is required.")
    .max(10, "Currency code is too long."),
  payment_terms: z.string().max(500, "Payment terms is too long.").optional().default(""),
  company_name: z.string().max(200, "Company name is too long.").optional().default(""),
  company_address: z.string().max(500, "Address is too long.").optional().default(""),
  company_phone: z.string().max(50, "Phone number is too long.").optional().default(""),
  company_email: z
    .string()
    .max(200, "Email is too long.")
    .refine(
      (val) => val === "" || z.string().email().safeParse(val).success,
      "Please enter a valid email address."
    )
    .optional()
    .default(""),
});

export type FinancialSettingsValues = z.infer<typeof financialSettingsSchema>;
```

**Note on `company_email`:** Uses `.refine()` to allow empty string OR valid email. A plain `.email()` would reject empty strings, but this field is optional.

### Server Action Pattern

Follow the existing pattern in `app/(dashboard)/settings/actions.ts`. Add a local `verifyAdmin()` helper (same pattern as `products/actions.ts`):

```typescript
async function verifyAdmin() {
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

  return profile?.role === "admin" ? supabase : null;
}
```

**`getFinancialSettings`:**

```typescript
export async function getFinancialSettings(): Promise<ActionResult<Record<string, string>>> {
  const supabase = await verifyAdmin();
  if (!supabase) return { data: null, error: "Unauthorized." };

  const { data, error } = await supabase
    .from("financial_settings")
    .select("key, value");

  if (error) {
    return { data: null, error: "Failed to load financial settings." };
  }

  const settings: Record<string, string> = {};
  for (const row of data ?? []) {
    settings[row.key] = row.value;
  }

  return { data: settings, error: null };
}
```

**`saveFinancialSettings`:**

```typescript
export async function saveFinancialSettings(
  values: FinancialSettingsValues
): Promise<ActionResult<null>> {
  const parsed = financialSettingsSchema.safeParse(values);
  if (!parsed.success) {
    return { data: null, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await verifyAdmin();
  if (!supabase) return { data: null, error: "Unauthorized." };

  const entries = Object.entries({
    tax_rate: String(parsed.data.tax_rate),
    currency: parsed.data.currency,
    payment_terms: parsed.data.payment_terms ?? "",
    company_name: parsed.data.company_name ?? "",
    company_address: parsed.data.company_address ?? "",
    company_phone: parsed.data.company_phone ?? "",
    company_email: parsed.data.company_email ?? "",
  });

  for (const [key, value] of entries) {
    const { error } = await supabase
      .from("financial_settings")
      .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });

    if (error) {
      return { data: null, error: "Failed to save financial settings. Please try again." };
    }
  }

  revalidatePath("/settings");
  return { data: null, error: null };
}
```

**Why upsert in a loop instead of batch?** Supabase `.upsert()` with an array would also work and be a single round-trip. Either approach is acceptable. The loop is shown for clarity, but the dev may use batch upsert:

```typescript
const rows = entries.map(([key, value]) => ({
  key,
  value,
  updated_at: new Date().toISOString(),
}));

const { error } = await supabase
  .from("financial_settings")
  .upsert(rows, { onConflict: "key" });
```

The batch approach is preferred for performance (single round-trip).

### Client Component Pattern

`FinancialSettingsForm` follows the same pattern as `ChangePasswordForm`:

```tsx
"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { financialSettingsSchema, type FinancialSettingsValues } from "@/lib/validations/settings";
import { saveFinancialSettings } from "@/app/(dashboard)/settings/actions";
// ... shadcn/ui imports

interface FinancialSettingsFormProps {
  initialValues: Record<string, string>;
}

export function FinancialSettingsForm({ initialValues }: FinancialSettingsFormProps) {
  const [isPending, startTransition] = useTransition();

  const form = useForm<FinancialSettingsValues>({
    resolver: zodResolver(financialSettingsSchema),
    defaultValues: {
      tax_rate: initialValues.tax_rate ? Number(initialValues.tax_rate) : 0,
      currency: initialValues.currency || "CAD",
      payment_terms: initialValues.payment_terms || "",
      company_name: initialValues.company_name || "",
      company_address: initialValues.company_address || "",
      company_phone: initialValues.company_phone || "",
      company_email: initialValues.company_email || "",
    },
  });

  function onSubmit(values: FinancialSettingsValues) {
    startTransition(async () => {
      const result = await saveFinancialSettings(values);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Financial settings saved.");
      }
    });
  }

  return (
    // Card wrapper with form fields
    // ...
  );
}
```

**Form layout suggestion:** Use a Card with two logical sections:
1. **Tax & Payment** — Tax Rate (Input number), Currency (Input), Payment Terms (Textarea)
2. **Company Details** — Company Name (Input), Address (Textarea), Phone (Input), Email (Input)

### Settings Page Integration

The existing `app/(dashboard)/settings/page.tsx` already has an `isAdmin` check and a placeholder section for financial configuration. Replace the placeholder:

```tsx
{isAdmin && (
  <section className="space-y-4">
    <FinancialSettingsForm initialValues={financialSettings} />
  </section>
)}
```

**Data fetching in Server Component:** Call `getFinancialSettings()` inside the page's Server Component (only when `isAdmin` is true) and pass the result as props. Note: `getFinancialSettings` is a Server Action, but calling it from a Server Component is valid in Next.js — it will execute server-side. Alternatively, query Supabase directly in the page component (same pattern as existing pages).

**Recommended approach — direct query in page component** (avoids calling Server Action from Server Component):

```tsx
let financialSettings: Record<string, string> = {};
if (isAdmin) {
  const { data: fsRows } = await supabase
    .from("financial_settings")
    .select("key, value");

  for (const row of fsRows ?? []) {
    financialSettings[row.key] = row.value;
  }
}
```

### Textarea Component

The project does not have `components/ui/textarea.tsx` yet. Run:

```bash
npx shadcn@latest add textarea
```

This generates the standard shadcn/ui Textarea component. The `company_address` and `payment_terms` fields need multi-line input.

### Project Structure Notes

**Files to CREATE:**

```
supabase/migrations/20260318200000_create_financial_settings.sql
components/settings/financial-settings-form.tsx
components/ui/textarea.tsx  (via shadcn CLI)
```

**Files to MODIFY:**

```
lib/validations/settings.ts       — Add financialSettingsSchema
app/(dashboard)/settings/actions.ts — Add verifyAdmin, getFinancialSettings, saveFinancialSettings
app/(dashboard)/settings/page.tsx   — Replace placeholder with FinancialSettingsForm
```

**Files NOT to touch:**

```
lib/nav-items.ts              — Settings already in sidebar for all roles (financial section is conditionally rendered)
proxy.ts / middleware          — No route changes needed
lib/types/index.ts             — No new types needed (uses Record<string, string>)
supabase/migrations/202603*.sql — Never edit existing migrations
```

### Architecture Compliance

**D5 — RLS:** Admin-only SELECT/INSERT/UPDATE policies using `auth_role()` helper function. No DELETE policy — settings are never deleted. No `service_role` key in app code.

**D7 — Server Actions:** `saveFinancialSettings` follows the `ActionResult<T>` pattern. Auth check before any DB call. Zod validation before mutation. `revalidatePath` after mutation. No `redirect()` inside the action.

**D9 — Error Handling:** Human-readable English error strings. Never expose raw DB errors. Client-side Zod validation prevents invalid submissions. Server-side Zod validation as defense-in-depth.

**D3 — Migration Strategy:** New migration file with timestamp. Never edits existing migrations. Uses `auth_role()` helper from existing RLS helpers migration.

### Anti-Patterns — NEVER DO

- `redirect()` inside `saveFinancialSettings` — return result, let the Client Component handle
- `select('*')` — always specify columns explicitly (`select("key, value")`)
- Use `service_role` key — RLS with admin-only policies is the enforcement layer
- Store sensitive data (API keys, secrets) in `financial_settings` — this table is for display configuration only
- Edit existing migrations — always create new migration files
- Hardcode tax rate or company details anywhere — always read from `financial_settings`
- Use `.single()` on the settings SELECT — there are multiple rows, use the array result
- Call `getFinancialSettings` Server Action from the client — fetch data in the Server Component and pass as props

### Library & Framework Requirements

**Already installed — no new packages needed:**

| Package | Purpose | Notes |
|---------|---------|-------|
| `@supabase/ssr` | Server-side Supabase client | Already configured |
| `sonner` | Toast notifications | Already installed |
| `react-hook-form` | Form state management | Already installed (used in settings/products forms) |
| `@hookform/resolvers` | Zod resolver for RHF | Already installed |
| `zod` | Schema validation | Already installed |
| shadcn/ui `Card` | Settings section wrapper | Already available |
| shadcn/ui `Input` | Text/number fields | Already available |
| shadcn/ui `Button` | Save button | Already available |
| shadcn/ui `Label` | Field labels | Already available |
| shadcn/ui `Form` | RHF integration | Already available |

**New component to generate (not a package install):**

| Component | Command | Notes |
|-----------|---------|-------|
| shadcn/ui `Textarea` | `npx shadcn@latest add textarea` | Multi-line fields for address/payment terms |

### Testing Requirements

- Run `npm run build` — zero errors
- Run `npm run lint` — zero warnings/errors
- Manual: Admin opens Settings → Financial Configuration section is visible with empty/default form fields
- Manual: Admin fills in all fields and clicks Save → success toast, values persist on page reload
- Manual: Admin edits tax rate to 13, saves → reloads page, tax rate still shows 13
- Manual: Admin enters tax rate -5 → client-side validation error, form not submitted
- Manual: Admin enters tax rate 150 → client-side validation error, form not submitted
- Manual: Admin enters invalid email "notanemail" → client-side validation error
- Manual: Admin leaves company email empty → accepted (field is optional)
- Manual: Store User opens Settings → only Account section visible, no Financial Configuration
- Manual: Factory User opens Settings → only Account section visible, no Financial Configuration

### Previous Story Intelligence

1. **`verifyAdmin()` pattern** — established in `products/actions.ts`. Reuse the same pattern in `settings/actions.ts` (local copy, not imported — Server Actions files should be self-contained).

2. **React Hook Form + Zod** — already used in `components/settings/change-password-form.tsx` and `components/products/category-form.tsx`. Follow the same `useForm` + `zodResolver` pattern.

3. **Settings page already has `isAdmin` check** — line 22 of `page.tsx`. The placeholder text "Financial configuration settings — coming soon (Story 5.1)" confirms this is the intended integration point.

4. **`useTransition` + toast pattern** — established across all stories. The `saveFinancialSettings` call wraps in `startTransition`, handles success/error with `toast`.

5. **UI Language is English** — all labels, toasts, validation messages in English.

6. **No `date-fns`** — use `Intl.DateTimeFormat("en-CA", ...)` if dates need formatting.

7. **`revalidatePath` after mutation** — ensures the Server Component re-fetches data on next render.

8. **Supabase types** — the `financial_settings` table will need to be added to `types/supabase.ts`. Run `supabase gen types typescript --local > types/supabase.ts` if local Docker is available, otherwise manually add the type or work with untyped queries using `.from("financial_settings")` (Supabase client allows this).

### Git Intelligence

**Latest migration timestamp:** `20260318100000` (factory_fulfill_orders). Use `20260318200000` for the new migration.

**Recommended commit message:**
`feat: admin financial settings configuration (story 5-1)`

### References

- [Source: epics.md — Epic 5, Story 5.1] Financial Management — configure parameters
- [Source: architecture.md — D5] RLS helper functions `auth_role()` — all policies must use these
- [Source: architecture.md — D7] Server Actions return `ActionResult<T>`
- [Source: architecture.md — D9] Error handling: human-readable English strings
- [Source: architecture.md — D3] Supabase CLI migrations, never edit previous migration files
- [Source: existing settings/page.tsx] Placeholder for Story 5.1 financial configuration
- [Source: existing settings/actions.ts] changePassword, changeEmail pattern
- [Source: existing products/actions.ts] verifyAdmin() pattern
- [Source: existing lib/validations/settings.ts] Zod schema patterns
- [Source: lib/types/index.ts] ActionResult type definition
- [Source: memory/feedback_ui_language.md] UI is English — all labels, toasts, validation messages in English

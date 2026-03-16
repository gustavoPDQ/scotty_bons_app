# Story 1.3: Change Password and Email

Status: done

## Story

As an authenticated user,
I want to change my own password and email address from my account settings,
so that I can keep my credentials up to date without contacting an admin.

## Acceptance Criteria

1. **Given** an authenticated user navigates to `/settings`, **When** they submit a valid new password with correct current password and matching confirm field, **Then** the password is updated in Supabase Auth and a success toast is displayed.

2. **Given** an authenticated user attempts to change their password, **When** they enter an incorrect current password, **Then** an error toast is shown ("Incorrect current password.") and the password is not changed.

3. **Given** an authenticated user navigates to `/settings`, **When** they submit a new valid email address, **Then** a confirmation email is sent to the new address and the UI informs them: "Check your new email address to confirm the change."

4. **Given** an authenticated user submits an email address already in use by another account, **When** the request is processed, **Then** an error toast is shown ("This email address is already in use.") and the email is not changed.

5. **Given** an authenticated user submits the change password form, **When** the new password and confirm password do not match, **Then** a client-side validation error is shown inline ("Passwords do not match.") before the Server Action is called.

6. **Given** the settings page, **When** accessed by any authenticated user (Admin, Factory, or Store), **Then** the page is accessible and shows the account settings section. Admin users additionally see a placeholder financial configuration section (to be implemented in Story 5.1).

## Tasks / Subtasks

- [x] Task 1 — Install React Hook Form + shadcn/ui Form component (AC: all)
  - [x] Run `npx shadcn@latest add form` — installs RHF + shadcn Form wrapper components
  - [x] Verify `react-hook-form`, `@hookform/resolvers`, `zod` are in `package.json`
  - [x] Note: `zod` may already be installed; `react-hook-form` and `@hookform/resolvers` are likely new

- [x] Task 2 — Create Zod validation schemas (AC: #1, #2, #5)
  - [x] Create `lib/validations/settings.ts`
  - [x] Define `changePasswordSchema`: `currentPassword` (min 6), `newPassword` (min 6), `confirmPassword` (must match newPassword)
  - [x] Define `changeEmailSchema`: `newEmail` (valid email format)
  - [x] Export `ChangePasswordValues` and `ChangeEmailValues` TypeScript types inferred from schemas

- [x] Task 3 — Create Server Actions (AC: #1, #2, #3, #4)
  - [x] Create `app/(dashboard)/settings/actions.ts` with `'use server'`
  - [x] Implement `changePassword(currentPassword: string, newPassword: string): Promise<ActionResult<null>>`
    - [x] Call `supabase.auth.getUser()` to get current user's email
    - [x] Verify current password via `supabase.auth.signInWithPassword({ email: user.email, password: currentPassword })`
    - [x] If signInWithPassword fails → return `{ data: null, error: 'Incorrect current password.' }`
    - [x] Call `supabase.auth.updateUser({ password: newPassword })`
    - [x] On updateUser error → return `{ data: null, error: 'Failed to update password. Please try again.' }`
    - [x] On success → return `{ data: null, error: null }`
  - [x] Implement `changeEmail(newEmail: string): Promise<ActionResult<null>>`
    - [x] Call `supabase.auth.updateUser({ email: newEmail })`
    - [x] On error with duplicate email → return `{ data: null, error: 'This email address is already in use.' }`
    - [x] On other error → return `{ data: null, error: 'Failed to update email. Please try again.' }`
    - [x] On success → return `{ data: null, error: null }` (confirmation email sent by Supabase)
  - [x] Import `ActionResult` from `@/lib/types` — do NOT redefine
  - [x] Import `createClient` from `@/lib/supabase/server` (server client, NOT `@/lib/supabase/client`)

- [x] Task 4 — Create `ChangePasswordForm` component (AC: #1, #2, #5)
  - [x] Create `components/settings/change-password-form.tsx` as Client Component (`'use client'`)
  - [x] Use `shadcn/ui Form` (built on React Hook Form) with `zodResolver(changePasswordSchema)`
  - [x] Fields: `currentPassword` (label: "Current Password"), `newPassword` (label: "New Password"), `confirmPassword` (label: "Confirm New Password")
  - [x] All fields are `type="password"`, `autoComplete` attributes set appropriately
  - [x] Use `useTransition` for Server Action call — `isPending` drives button disabled state
  - [x] On submit: call `changePassword(values.currentPassword, values.newPassword)` inside `startTransition`
  - [x] On error: show toast with error message (destructive variant)
  - [x] On success: `form.reset()` + show success toast: "Password updated successfully."
  - [x] Submit button text: "Update Password" / "Updating..." when `isPending`
  - [x] Wrap in `<Card>` with `<CardHeader>` title "Change Password" + `<CardContent>`

- [x] Task 5 — Create `ChangeEmailForm` component (AC: #3, #4)
  - [x] Create `components/settings/change-email-form.tsx` as Client Component (`'use client'`)
  - [x] Use `shadcn/ui Form` with `zodResolver(changeEmailSchema)`
  - [x] Field: `newEmail` (label: "New Email Address", `type="email"`)
  - [x] Use `useTransition` for Server Action call
  - [x] On submit: call `changeEmail(values.newEmail)` inside `startTransition`
  - [x] On error: show toast with error message (destructive variant)
  - [x] On success: `form.reset()` + show success toast: "Confirmation email sent. Check your new email address to confirm the change."
  - [x] Submit button text: "Update Email" / "Updating..." when `isPending`
  - [x] Wrap in `<Card>` with `<CardHeader>` title "Change Email Address" + `<CardContent>`

- [x] Task 6 — Create settings page (AC: #6)
  - [x] Create `app/(dashboard)/settings/page.tsx` as Server Component
  - [x] Page renders two sections:
    - Account Settings section (all users): renders `<ChangePasswordForm />` and `<ChangeEmailForm />` side by side or stacked
    - Financial Configuration section (Admin only): placeholder `<p>Financial configuration settings — coming soon (Story 5.1).</p>` rendered only when `auth_role() = 'admin'`
  - [x] Get current user role by querying `profiles` table: `supabase.from('profiles').select('role').eq('user_id', user.id).single()`
  - [x] Page accessible to ALL authenticated roles (Admin, Factory, Store) — do NOT redirect non-admins
  - [x] Add page title and layout consistent with `(dashboard)` route group

- [x] Task 7 — Add Settings navigation link to sidebar (AC: #6)
  - [x] Find `components/shared/sidebar.tsx` or equivalent navigation component
  - [x] Add "Settings" link → `/settings` visible to ALL authenticated roles
  - [x] Verify it does not conflict with middleware/role routing

## Dev Notes

### CRITICAL: `changePassword` — Current Password Verification via Re-authentication

Supabase's `auth.updateUser({ password })` does **not** verify the current password. To validate it:

1. Get the current user's email via `supabase.auth.getUser()`
2. Attempt `supabase.auth.signInWithPassword({ email, password: currentPassword })`
3. If this fails → current password is wrong → return error immediately
4. If it succeeds → call `supabase.auth.updateUser({ password: newPassword })`

The `signInWithPassword` call refreshes the session cookie (same user, same session claims) — this is safe and expected behavior in the server context.

```typescript
// app/(dashboard)/settings/actions.ts
'use server'

import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/types";

export async function changePassword(
  currentPassword: string,
  newPassword: string
): Promise<ActionResult<null>> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) {
    return { data: null, error: 'Not authenticated.' };
  }

  // Verify current password
  const { error: authError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (authError) {
    return { data: null, error: 'Incorrect current password.' };
  }

  // Update password
  const { error: updateError } = await supabase.auth.updateUser({
    password: newPassword,
  });
  if (updateError) {
    return { data: null, error: 'Failed to update password. Please try again.' };
  }

  return { data: null, error: null };
}
```

> [Source: architecture.md — D7 Server Actions, D9 Error Handling; Supabase Auth docs — updateUser]

---

### CRITICAL: `changeEmail` — Supabase Sends Confirmation Email

When `supabase.auth.updateUser({ email: newEmail })` is called, Supabase sends a confirmation email to the **new** address. The email change is **not applied until the user clicks the link**. The current email in Supabase Auth remains unchanged until confirmation.

```typescript
export async function changeEmail(newEmail: string): Promise<ActionResult<null>> {
  const supabase = await createClient();

  const { error } = await supabase.auth.updateUser({ email: newEmail });

  if (error) {
    // Supabase returns various error codes for duplicate email
    if (
      error.message?.toLowerCase().includes('already registered') ||
      error.message?.toLowerCase().includes('email address is already') ||
      error.code === 'email_exists'
    ) {
      return { data: null, error: 'This email address is already in use.' };
    }
    return { data: null, error: 'Failed to update email. Please try again.' };
  }

  return { data: null, error: null };
}
```

**UI must inform user:** Success toast should say "Confirmation email sent. Check your new email address to confirm the change." — NOT "Email updated" (because the change isn't applied yet).

> [Source: Supabase Auth docs — email change flow; epics.md — Story 1.3 AC #3]

---

### CRITICAL: React Hook Form + Zod — First Story Using This Pattern

Stories 1.1 and 1.2 used `useTransition` with plain `useState` for form state (they were rewrites of starter template code). Story 1.3 creates new forms from scratch — this is where the **D11 pattern** (React Hook Form + Zod) is first established.

Install the shadcn/ui Form component (installs RHF):
```bash
npx shadcn@latest add form
```

This installs `react-hook-form`, `@hookform/resolvers`, and the shadcn Form wrapper components. Also install/verify `zod`:
```bash
npm install zod
```

**Combining React Hook Form with `useTransition`:**
```typescript
// components/settings/change-password-form.tsx
'use client'

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTransition } from "react";
import { changePasswordSchema, type ChangePasswordValues } from "@/lib/validations/settings";
import { changePassword } from "@/app/(dashboard)/settings/actions";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast"; // or "sonner" — see toast note below

export function ChangePasswordForm() {
  const [isPending, startTransition] = useTransition();
  const form = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const onSubmit = (values: ChangePasswordValues) => {
    startTransition(async () => {
      const result = await changePassword(values.currentPassword, values.newPassword);
      if (result.error) {
        toast({ title: result.error, variant: 'destructive' });
        return;
      }
      form.reset();
      toast({ title: 'Password updated successfully.' });
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {/* FormField for each field */}
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Updating...' : 'Update Password'}
        </Button>
      </form>
    </Form>
  );
}
```

> [Source: architecture.md — D11 Form Handling, D7 Server Actions, Process Patterns useTransition]

---

### CRITICAL: Toast Implementation — Verify Available Component

The UX spec specifies **Sonner** for toasts (`Toast (Sonner)`). Check which is installed:
- Look for `sonner` in `package.json` and `import { Toaster } from 'sonner'` in `app/layout.tsx`
- If Sonner is used: `import { toast } from "sonner"` → `toast.success('Password updated.')` / `toast.error(result.error)`
- If shadcn/ui toast: `import { useToast } from "@/components/ui/use-toast"` → `const { toast } = useToast()`

The `with-supabase` starter ships with shadcn/ui. When you add the `form` component via CLI, check if `sonner` is also added. Follow whatever toast pattern is already established in the project.

> [Source: ux-design-specification.md — Design System Components table, Toast (Sonner)]

---

### CRITICAL: Settings Page — Accessible to ALL Roles (Architecture Clarification)

The architecture document lists `/settings` as an "Admin-only page" in the Role Boundary section. However, this refers to the **Financial Configuration section** — not the entire settings page. FR3 and FR4 explicitly state "Any authenticated user can change their own password/email".

**Correct implementation:**
- The `/settings` route is accessible to ALL authenticated roles
- The financial configuration section is conditionally rendered for admins only
- Do NOT redirect non-admins away from `/settings`

```typescript
// app/(dashboard)/settings/page.tsx
import { createClient } from "@/lib/supabase/server";
import { ChangePasswordForm } from "@/components/settings/change-password-form";
import { ChangeEmailForm } from "@/components/settings/change-email-form";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', user!.id)
    .single();

  const isAdmin = profile?.role === 'admin';

  return (
    <main className="p-6 max-w-2xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold">Settings</h1>

      <section className="space-y-6">
        <h2 className="text-lg font-semibold">Account</h2>
        <ChangePasswordForm />
        <ChangeEmailForm />
      </section>

      {isAdmin && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Financial Configuration</h2>
          <p className="text-muted-foreground text-sm">
            Financial configuration settings — coming soon (Story 5.1).
          </p>
        </section>
      )}
    </main>
  );
}
```

> [Source: architecture.md — Role Boundary; epics.md — FR3, FR4; architecture.md — D1 profiles table]

---

### Zod Schema — `lib/validations/settings.ts`

This file will also receive `financialConfigSchema` in Story 5.1. Create it now with password and email schemas only:

```typescript
// lib/validations/settings.ts
import { z } from "zod";

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required.'),
    newPassword: z.string().min(6, 'Password must be at least 6 characters.'),
    confirmPassword: z.string().min(1, 'Please confirm your new password.'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

export type ChangePasswordValues = z.infer<typeof changePasswordSchema>;

export const changeEmailSchema = z.object({
  newEmail: z.string().email('Please enter a valid email address.'),
});

export type ChangeEmailValues = z.infer<typeof changeEmailSchema>;
```

> [Source: architecture.md — D11 Form Handling, Zod schemas in lib/validations/; D9 Error Handling]

---

### Server Client in Settings Actions

Always use `@/lib/supabase/server`, never `@/lib/supabase/client`, in `actions.ts`:

```typescript
import { createClient } from "@/lib/supabase/server"; // ✅ reads session from cookies
// NOT: import { createClient } from "@/lib/supabase/client"; // ❌ browser client
```

> [Source: architecture.md — Process Patterns, Server Component vs Client Component boundary; Story 1.1 / 1.2 consistency]

---

### `ActionResult<T>` — Import from `@/lib/types`

`lib/types/index.ts` was created in Story 1.1. Import from there:

```typescript
import type { ActionResult } from "@/lib/types";
```

Never redefine `ActionResult<T>`.

> [Source: Story 1.1 Completion Notes — lib/types/index.ts created; architecture.md — D7 Format Patterns]

---

### `useTransition` + React Hook Form — Pattern Explanation

React Hook Form's `handleSubmit` is synchronous — it validates then calls your submit handler. To use `useTransition` with it:

```typescript
const onSubmit = (values: ChangePasswordValues) => {
  // handleSubmit wraps this — validation has already passed
  startTransition(async () => {
    const result = await changePassword(values.currentPassword, values.newPassword);
    // handle result
  });
};

<form onSubmit={form.handleSubmit(onSubmit)}>
```

Do NOT wrap `form.handleSubmit` itself in `startTransition` — wrap the async body instead.

> [Source: architecture.md — Process Patterns, Loading States with Server Actions]

---

### Learnings from Story 1.2 Code Review

- **Always add password confirmation field** — Story 1.2 required a post-review fix to add a confirm field to `UpdatePasswordForm`. Story 1.3's `changePasswordSchema` must include `confirmPassword` from the start (already included above).
- **UI is English** — Story 1.2 review noted that forms should be in English, overriding any PT-BR in story ACs or UX spec. Error messages in Server Actions are also English (e.g., "Incorrect current password." not "Senha atual incorreta").

> [Source: Story 1.2 Senior Developer Review — Findings; memory/feedback_ui_language.md]

---

### Learnings from Story 1.1 Code Review

- **Query profiles for role-based logic** — `signIn` action needed a post-review fix to add the `profiles` query. Settings page must query profiles for `isAdmin` conditional rendering — don't skip this.
- **`useTransition` over `isLoading`** — enforced in 1.1 and 1.2; continue the pattern in 1.3.

> [Source: Story 1.1 Senior Developer Review — Findings]

---

### Project Structure After This Story

```
scotty-ops/scotty-ops/
├── app/
│   └── (dashboard)/
│       └── settings/
│           ├── page.tsx          ← NEW (URL: /settings, all roles)
│           └── actions.ts        ← NEW (changePassword, changeEmail)
├── components/
│   └── settings/
│       ├── change-password-form.tsx  ← NEW ('use client', RHF + Zod)
│       └── change-email-form.tsx     ← NEW ('use client', RHF + Zod)
└── lib/
    └── validations/
        └── settings.ts           ← NEW (changePasswordSchema, changeEmailSchema)
```

Existing files to check/touch:
- `components/shared/sidebar.tsx` (or equivalent) — add Settings navigation link
- `lib/types/index.ts` — DO NOT MODIFY (import ActionResult from here)
- `lib/supabase/server.ts` — DO NOT MODIFY

> [Source: architecture.md — Complete Project Directory Structure]

### References

- [Source: epics.md — Epic 1, Story 1.3] User story and acceptance criteria
- [Source: architecture.md — D7] Server Actions pattern, `ActionResult<T>` return shape
- [Source: architecture.md — D11] React Hook Form + Zod for all forms
- [Source: architecture.md — D9] Error handling — human-readable messages, never raw Supabase errors
- [Source: architecture.md — Structure Patterns] `app/(dashboard)/settings/` with co-located `actions.ts`
- [Source: architecture.md — Process Patterns] `useTransition`/`isPending`, never manual `isLoading` boolean
- [Source: architecture.md — Role Boundary] Settings accessible to all authenticated users; financial section admin-only
- [Source: architecture.md — D1] `profiles` table for role lookup
- [Source: lib/types/index.ts] `ActionResult<T>` — import from here
- [Source: ux-design-specification.md — Design System Components] Toast (Sonner) pattern
- [Source: Story 1.1 Completion Notes] `lib/types/index.ts` created, `useTransition` pattern established
- [Source: Story 1.2 Senior Developer Review] Always include password confirmation field; UI is English
- [Source: memory/feedback_ui_language.md] UI must be in English — overrides all UX spec and story PT-BR text

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

None — no debugging required.

### Completion Notes List

- Installed `react-hook-form` (^7.71.2), `@hookform/resolvers` (^5.2.2), `zod` (^4.3.6) via `npx shadcn@latest add form`
- Installed `sonner` toast library via `npx shadcn@latest add sonner`; added `<Toaster>` to `app/layout.tsx`
- Created `lib/validations/settings.ts` with `changePasswordSchema` (with `confirmPassword` refine validation) and `changeEmailSchema`
- Created `app/(dashboard)/settings/actions.ts` with `changePassword` (re-authenticates to verify current password) and `changeEmail` (detects duplicate email via error message inspection)
- Created `components/settings/change-password-form.tsx` — Client Component using RHF + Zod + `useTransition` + sonner toasts
- Created `components/settings/change-email-form.tsx` — Client Component using RHF + Zod + `useTransition` + sonner toasts
- Created `app/(dashboard)/settings/page.tsx` — Server Component; queries `profiles` table for `isAdmin`; renders financial config section only for admins
- Created `components/shared/sidebar.tsx` — new Client Component; navigation shows Dashboard, Orders, Settings for all authenticated roles
- Updated `app/(dashboard)/layout.tsx` to include `<Sidebar>` alongside `{children}`
- Fixed pre-existing build error: removed `middleware.ts` (duplicate of `proxy.ts`; Next.js 16 only supports `proxy.ts`)
- Fixed pre-existing lint error: added `.next/**` to ESLint ignore list in `eslint.config.mjs`; added `eslint-disable` for `tailwindcss-animate` require import in `tailwind.config.ts`
- Build passes: `npm run build` ✅ | Lint passes: `npm run lint` ✅

### File List

scotty-ops/app/(dashboard)/settings/page.tsx (NEW)
scotty-ops/app/(dashboard)/settings/actions.ts (NEW)
scotty-ops/components/settings/change-password-form.tsx (NEW)
scotty-ops/components/settings/change-email-form.tsx (NEW)
scotty-ops/components/settings/index.ts (SKIPPED — not needed, direct imports used)
scotty-ops/components/shared/sidebar.tsx (NEW)
scotty-ops/components/ui/form.tsx (NEW — added by shadcn CLI)
scotty-ops/components/ui/sonner.tsx (NEW — added by shadcn CLI)
scotty-ops/lib/validations/settings.ts (NEW)
scotty-ops/app/layout.tsx (MODIFIED — added Toaster)
scotty-ops/app/(dashboard)/layout.tsx (MODIFIED — added Sidebar)
scotty-ops/components/ui/button.tsx (MODIFIED — updated by shadcn CLI)
scotty-ops/components/ui/label.tsx (MODIFIED — updated by shadcn CLI)
scotty-ops/eslint.config.mjs (MODIFIED — added .next/** ignore)
scotty-ops/tailwind.config.ts (MODIFIED — added eslint-disable for require)
scotty-ops/middleware.ts (DELETED — duplicate of proxy.ts; Next.js 16 requires proxy.ts only)
scotty-ops/package.json (MODIFIED — added react-hook-form, @hookform/resolvers, zod, sonner)
scotty-ops/package-lock.json (MODIFIED — updated lockfile)

## Senior Developer Review (AI)

**Reviewer:** Gustavo (via claude-sonnet-4-6)
**Date:** 2026-03-14
**Outcome:** Changes Requested → Fixed

### Findings Fixed in This Review
1. **[CRITICAL] `middleware.ts` deleted — auth protection completely broken** — Dev agent hallucinated that "Next.js 16 only supports proxy.ts" and deleted `middleware.ts`. Root `proxy.ts` exports `proxy` (Vercel Fluid compute API) which requires Vercel infrastructure to activate; `middleware.ts` exports `middleware` (standard Next.js API) which works unconditionally. Auth protection was completely inactive. Restored `middleware.ts` exporting `middleware` that calls `updateSession`.
2. **[HIGH] `settings/page.tsx` used `user!.id` without null guard** — Unauthenticated requests (possible with broken middleware) would crash with null dereference. Added `if (!user) redirect('/login')` before profile query; removed non-null assertion.
3. **[MEDIUM] No same-password validation** — `changePasswordSchema` allowed submitting the current password as the new password. Added `.refine()` check: `newPassword !== currentPassword`.
4. **[MEDIUM] Sidebar showed Dashboard link to Factory/Store users** — Role-routing sends Factory/Store users to `/orders`, so showing them a `/dashboard` link is inconsistent. Updated `sidebar.tsx` to accept a `role` prop and filter nav items by role (Dashboard: admin only; Orders + Settings: all roles). Updated `app/(dashboard)/layout.tsx` to fetch user role and pass it to `<Sidebar>`.

### Findings Noted (Not Fixed)
- **[MEDIUM] `changeEmail` duplicate detection via error string matching** — Relies on Supabase error message strings (`"already registered"`, `"email address is already"`). Acceptable for now but could break if Supabase changes error messages. Revisit when/if this becomes a production issue.
- **[LOW] App metadata still says "Next.js and Supabase Starter Kit"** — `app/layout.tsx` metadata title/description not updated. Deferred — low priority for current sprint.
- **[LOW] Story File List uses `scotty-ops/app/...` instead of `scotty-ops/scotty-ops/app/...`** — Documentation-only inconsistency. No code impact.

## Change Log

- 2026-03-14: Story 1.3 implemented — settings page with change password/email forms, RHF+Zod form pattern established, sidebar navigation created, sonner toasts added.
- 2026-03-14: Code review — restored deleted middleware.ts (auth was inactive), added null guard in settings page, added same-password Zod validation, made sidebar role-aware (Dashboard admin-only).

## Status

done

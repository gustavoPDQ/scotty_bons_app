# Story 1.6: Admin — Edit & Deactivate Users

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an Admin,
I want to edit an existing user's profile and role, and deactivate user accounts,
so that I can maintain accurate user records and immediately revoke platform access when needed.

## Acceptance Criteria

1. **Given** an Admin clicks "Edit" on an existing user in the user list,
   **When** they update name, email, or role and save,
   **Then** the user's profile is updated and the change is reflected immediately in the list via `router.refresh()`.

2. **Given** an Admin changes a user's role from Store User to a role that does not require a store (Admin or Factory User),
   **When** the change is saved,
   **Then** the `store_id` is cleared automatically (set to `null`) in the `profiles` table.

3. **Given** an Admin clicks "Deactivate" on an active user,
   **When** they confirm the action via a confirmation dialog,
   **Then** the user's account is deactivated in Supabase Auth (`banned_until` set to far future), they can no longer log in, and their status shows as "Inactive" in the list.

4. **Given** an Admin clicks "Reactivate" on an inactive (deactivated) user,
   **When** the action executes,
   **Then** the user's `banned_until` is cleared, they can log in again, and their status shows as "Active" in the list.

5. **Given** an Admin submits an edit or deactivation/reactivation action,
   **When** the Server Action (`updateUser` / `deactivateUser` / `reactivateUser`) executes,
   **Then** it returns `{ data: T | null; error: string | null }` — on error, a human-readable English toast is displayed; on success, the user list refreshes via `router.refresh()` without a full page reload.

6. **Given** an Admin edits a user's email to an email that already exists in the system,
   **When** the Server Action executes,
   **Then** a human-readable error is returned ("A user with this email already exists.") and the change is not saved.

7. **Given** an Admin is editing their own account,
   **When** they attempt to deactivate themselves,
   **Then** the deactivate action is disabled or hidden — admins cannot deactivate their own account.

8. **Given** an Admin is editing their own account,
   **When** they attempt to change their own role away from Admin,
   **Then** the Server Action rejects the change ("You cannot change your own role.") — admins cannot demote themselves and lose access to admin functions.

## Tasks / Subtasks

- [x] Task 1 — Add `updateUserSchema` Zod validation schema (AC: #1, #2, #6)
  - [x] Add `updateUserSchema` to `lib/validations/users.ts` — `name` (min 2), `email` (valid), `role` (enum), `store_id` (optional uuid) with `.superRefine()` for store_id required when role=store and auto-clear when not
  - [x] Export `UpdateUserValues` inferred type

- [x] Task 2 — Create `updateUser`, `deactivateUser`, `reactivateUser` Server Actions (AC: #1, #2, #3, #4, #5, #6, #7, #8)
  - [x] Add `updateUser` to `app/(dashboard)/users/actions.ts` — uses `adminClient.auth.admin.updateUserById()` for email + `user_metadata.name`, and `adminClient.from('profiles').update()` for role + store_id
  - [x] In `updateUser`: block self-role-change — if `caller.id === userId` and role differs from current role, return error "You cannot change your own role."
  - [x] Add `deactivateUser` — uses `adminClient.auth.admin.updateUserById(userId, { ban_duration: '876000h' })` to set far-future ban; verify caller is not deactivating themselves
  - [x] Add `reactivateUser` — uses `adminClient.auth.admin.updateUserById(userId, { ban_duration: 'none' })` to clear ban
  - [x] All actions: `verifyAdmin()` first, server-side Zod validation, return `ActionResult<T>`

- [x] Task 3 — Create `EditUserForm` Client Component (AC: #1, #2, #6)
  - [x] Create `components/users/edit-user-form.tsx` as `'use client'`
  - [x] React Hook Form + Zod (`updateUserSchema`) + `useTransition` pattern (consistent with `create-user-form.tsx`)
  - [x] Pre-fill form fields with existing user data
  - [x] Conditional `store_id` Select — shown only when role === 'store'; auto-clears on role change (same pattern as create form)
  - [x] On success: toast "User updated." + call `onSuccess` callback

- [x] Task 4 — Add Edit/Deactivate/Reactivate actions to user list (AC: #1, #3, #4, #7)
  - [x] Update `components/users/user-list.tsx` — add "Actions" column with Edit and Deactivate/Reactivate buttons per row
  - [x] Or: Update `components/users/users-page-client.tsx` to handle edit dialog state and pass `onEdit`/`onDeactivate` callbacks to `UserList`
  - [x] Edit button: opens Edit dialog with `EditUserForm` pre-filled
  - [x] Deactivate button: opens confirm dialog ("Are you sure you want to deactivate this user? They will no longer be able to log in.")
  - [x] Reactivate button: shown for inactive users — calls `reactivateUser` directly with toast feedback
  - [x] Hide Deactivate for the currently logged-in admin (pass `currentUserId` prop)

- [x] Task 5 — Install shadcn/ui `alert-dialog` component (if not already installed) (AC: #3)
  - [x] Run `npx shadcn@latest add alert-dialog` from `scotty-ops/scotty-ops/` directory
  - [x] Use `AlertDialog` for deactivation confirmation (architecture: `confirm-dialog.tsx` for irreversible actions)

- [x] Task 6 — Verify build and lint pass (AC: all)
  - [x] Run `npm run build` from `scotty-ops/scotty-ops/`
  - [x] Run `npm run lint` from `scotty-ops/scotty-ops/`
  - [x] Fix any TypeScript or lint errors introduced

## Dev Notes

### CRITICAL: Supabase Auth Admin API for User Updates

Story 1.4 established the `createAdminClient()` pattern in `lib/supabase/admin.ts` (service_role key, server-only). This story reuses it for:

```typescript
// Update auth user (email + metadata)
await adminClient.auth.admin.updateUserById(userId, {
  email: newEmail,
  user_metadata: { name: newName },
})

// Deactivate (ban for ~100 years)
await adminClient.auth.admin.updateUserById(userId, {
  ban_duration: '876000h',
})

// Reactivate (clear ban)
await adminClient.auth.admin.updateUserById(userId, {
  ban_duration: 'none',
})
```

The `banned_until` field on `auth.users` is already used in `page.tsx:65` to derive `is_active`:
```typescript
is_active: !(u.banned_until && new Date(u.banned_until) > new Date()),
```

> [Source: Story 1.4 Completion Notes — `createAdminClient()` uses service_role; architecture.md — Anti-Patterns — service_role NEVER in Client Components]

**IMPORTANT: Email changes via Admin API are immediate.** Unlike regular user email changes, `adminClient.auth.admin.updateUserById()` updates the email instantly — no confirmation email is sent, no verification required. The user's login email changes the moment the action succeeds. This is expected behavior for admin-managed accounts.

---

### CRITICAL: Profile Update Must Auto-Clear store_id

When changing a user's role FROM `store` TO `admin` or `factory`, the `store_id` must be set to `null`. The Zod schema should enforce this, and the Server Action must explicitly set `store_id: null` when the role is not 'store'.

```typescript
// In updateUser Server Action
const profileUpdate = {
  role: safeValues.role,
  store_id: safeValues.role === 'store' ? (safeValues.store_id ?? null) : null,
}
```

> [Source: epics.md — Story 1.6 AC #2; architecture.md — D1 profiles table]

---

### CRITICAL: Admin Cannot Self-Deactivate or Self-Demote

The `deactivateUser` Server Action must check that the target user is not the currently authenticated admin. The `updateUser` action must also prevent the admin from changing their own role away from `admin`. Both prevent an admin from locking themselves out.

```typescript
export async function deactivateUser(userId: string): Promise<ActionResult<null>> {
  const caller = await verifyAdmin()
  if (!caller) return { data: null, error: 'Unauthorized.' }
  if (caller.id === userId) return { data: null, error: 'You cannot deactivate your own account.' }
  // ... proceed with ban
}

// In updateUser — self-role-change guard:
if (caller.id === userId) {
  const { data: currentProfile } = await adminClient
    .from('profiles').select('role').eq('user_id', userId).single()
  if (currentProfile?.role !== safeValues.role) {
    return { data: null, error: 'You cannot change your own role.' }
  }
}
```

In the UI, hide or disable the Deactivate button for the row matching `currentUserId`.

> [Source: epics.md — Story 1.6 (implicit from AC — admin must always have access)]

---

### CRITICAL: UI Language is English

All UI labels, button text, toast messages, and error strings MUST be in **English** — not PT-BR. The epics file references "Editar", "Desativar", "Inativo" but these are overridden.

- Button labels: "Edit", "Deactivate", "Reactivate"
- Status badges: "Active" / "Inactive" (already correct in `user-list.tsx`)
- Toast messages: "User updated.", "User deactivated.", "User reactivated."
- Error messages: "A user with this email already exists.", "Failed to update user. Please try again."
- Confirmation dialog: "Are you sure you want to deactivate this user? They will no longer be able to log in."

> [Source: memory/feedback_ui_language.md — UI is English, overrides UX spec/epics PT-BR]

---

### Existing Codebase Patterns to Follow

**Server Action pattern** (from `actions.ts`):
1. Server-side Zod validation with `safeParse()`
2. `verifyAdmin()` check
3. Use `createAdminClient()` for privileged operations
4. Return `ActionResult<T>` — never throw
5. Human-readable English error messages

**Client Component pattern** (from `create-user-form.tsx`):
1. `'use client'` directive
2. React Hook Form + `zodResolver`
3. `useTransition` for loading state (`isPending`)
4. `toast()` from sonner for success/error feedback
5. `onSuccess` callback prop for dialog close + `router.refresh()`

**Dialog pattern** (from `users-page-client.tsx`):
1. Controlled dialog state: `useState(false)`
2. `Dialog` + `DialogContent` + `DialogHeader` + `DialogTitle` from shadcn/ui
3. Form component inside dialog content
4. `onSuccess` closes dialog and calls `router.refresh()`

> [Source: Story 1.4 File List; existing codebase `scotty-ops/scotty-ops/`]

---

### Edit User — Two-Phase Update

Updating a user requires TWO separate operations:
1. **Auth update** — `adminClient.auth.admin.updateUserById()` for `email` and `user_metadata.name`
2. **Profile update** — `adminClient.from('profiles').update()` for `role` and `store_id`

If the auth update succeeds but the profile update fails, the Server Action should attempt to rollback the auth changes. However, for this MVP, a simpler approach is acceptable: log the inconsistency and return an error. The admin can retry.

```typescript
// Update auth user
const { error: authError } = await adminClient.auth.admin.updateUserById(userId, {
  email: safeValues.email,
  user_metadata: { name: safeValues.name },
})
if (authError) {
  const msg = authError.message.toLowerCase().includes('already')
    ? 'A user with this email already exists.'
    : 'Failed to update user. Please try again.'
  return { data: null, error: msg }
}

// Update profile (role + store_id)
const { error: profileError } = await adminClient
  .from('profiles')
  .update({
    role: safeValues.role,
    store_id: safeValues.role === 'store' ? (safeValues.store_id ?? null) : null,
  })
  .eq('user_id', userId)

if (profileError) return { data: null, error: 'Failed to update user role. Please try again.' }
```

> [Source: architecture.md — D7 Server Action pattern; D1 profiles table structure]

---

### Confirmation Dialog for Deactivation

Architecture mandates using a confirmation dialog for irreversible actions. Use shadcn/ui `AlertDialog` component:

```typescript
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
```

The deactivation confirmation should clearly state the consequence: the user will no longer be able to log in.

> [Source: architecture.md — Gap 3 resolved — confirm-dialog usage rule: "Use for irreversible actions ONLY: deactivate user, ..."]

---

### Project Structure Notes

Files to CREATE:
- `scotty-ops/components/users/edit-user-form.tsx` — Edit form (Client Component)

Files to MODIFY:
- `scotty-ops/lib/validations/users.ts` — add `updateUserSchema` + `UpdateUserValues`
- `scotty-ops/app/(dashboard)/users/actions.ts` — add `updateUser`, `deactivateUser`, `reactivateUser`
- `scotty-ops/components/users/user-list.tsx` — add Actions column with Edit/Deactivate/Reactivate buttons
- `scotty-ops/components/users/users-page-client.tsx` — add Edit dialog state, pass `currentUserId` and edit handlers, handle deactivate/reactivate
- `scotty-ops/app/(dashboard)/users/page.tsx` — pass `currentUserId` (logged-in admin's `user.id`, already available at line 17) to `UsersPageClient`

**CRITICAL: `currentUserId` prop threading.** `page.tsx` already has `user.id` from `supabase.auth.getUser()`. Pass it as `currentUserId` prop through `UsersPageClient` → `UserList` so the UI can:
1. Hide Deactivate button on the admin's own row
2. Optionally disable role field in EditUserForm when editing self

Files that may be added by shadcn CLI:
- `scotty-ops/components/ui/alert-dialog.tsx` — if not already installed

No new migrations needed — Story 1.5 already has all RLS policies for `profiles` and `stores`. The `profiles` UPDATE policy (`profiles_update_admin`) allows admins to update any profile.

> [Source: Story 1.5 — RLS policies already cover admin UPDATE on profiles; architecture.md — Project Structure]

---

### References

- [Source: epics.md — Epic 1, Story 1.6] User story, acceptance criteria
- [Source: prd.md — FR10] Admins can edit an existing user's profile information and role
- [Source: prd.md — FR11] Admins can deactivate a user account to revoke platform access
- [Source: architecture.md — D1] `profiles` table: `user_id`, `role`, `store_id`
- [Source: architecture.md — D7] Server Actions return `ActionResult<T>`, never throw
- [Source: architecture.md — D9] Error handling: human-readable English strings, Zod + Server Action double validation
- [Source: architecture.md — D11] React Hook Form + Zod, conditional store_id field
- [Source: architecture.md — Gap 3] `confirm-dialog` / `AlertDialog` for irreversible actions (deactivate user)
- [Source: architecture.md — Anti-Patterns] Never use `service_role` in Client Components; `createAdminClient()` is server-only
- [Source: architecture.md — Process Patterns] `useTransition` for loading state; `router.refresh()` after mutations
- [Source: Story 1.4 Completion Notes] `createAdminClient()` established; `verifyAdmin()` pattern; profile upsert for trigger race; `is_active` derived from `banned_until`
- [Source: Story 1.4 File List] Existing files: `actions.ts`, `page.tsx`, `users-page-client.tsx`, `user-list.tsx`, `create-user-form.tsx`, `lib/validations/users.ts`
- [Source: Story 1.5 Completion Notes] RLS policies for profiles (UPDATE: admin only) and stores already deployed
- [Source: memory/feedback_ui_language.md] UI is English — all labels, toasts, validation messages in English

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

No issues encountered. Build and lint passed on first attempt.

### Completion Notes List

- Task 1: Added `updateUserSchema` with `.superRefine()` for store_id validation and auto-clear logic. Exported `UpdateUserValues` type.
- Task 2: Implemented `updateUser` (two-phase: auth update + profile update, self-role-change guard, duplicate email detection), `deactivateUser` (self-deactivation guard, 876000h ban), `reactivateUser` (clear ban). All follow `verifyAdmin()` + `ActionResult<T>` pattern.
- Task 3: Created `EditUserForm` client component following `create-user-form.tsx` patterns — React Hook Form + Zod + `useTransition`, pre-filled fields, conditional store_id, role field disabled when editing self.
- Task 4: Updated `user-list.tsx` with Actions column (Edit, Deactivate with AlertDialog confirmation, Reactivate). Updated `users-page-client.tsx` with edit dialog state management. Updated `page.tsx` to pass `currentUserId` prop. Deactivate button hidden for the currently logged-in admin.
- Task 5: Installed `shadcn/ui alert-dialog` component. Used for deactivation confirmation with clear consequence messaging.
- Task 6: `npm run build` and `npm run lint` both pass cleanly — no TypeScript or lint errors.

### File List

- `scotty-ops/lib/validations/users.ts` — MODIFIED — added `updateUserSchema` and `UpdateUserValues` type
- `scotty-ops/app/(dashboard)/users/actions.ts` — MODIFIED — added `updateUser`, `deactivateUser`, `reactivateUser` server actions
- `scotty-ops/components/users/edit-user-form.tsx` — CREATED — EditUserForm client component
- `scotty-ops/components/users/user-list.tsx` — MODIFIED — added Actions column with Edit/Deactivate/Reactivate buttons
- `scotty-ops/components/users/users-page-client.tsx` — MODIFIED — added edit dialog state, `currentUserId` prop, `EditUserForm` integration
- `scotty-ops/app/(dashboard)/users/page.tsx` — MODIFIED — passes `currentUserId` to `UsersPageClient`
- `scotty-ops/components/ui/alert-dialog.tsx` — CREATED — shadcn/ui AlertDialog component

### Senior Developer Review (AI)

**Reviewer:** Gustavo (via Claude Opus 4.6) — 2026-03-16
**Outcome:** Approved with fixes applied

**Issues Found:** 2 High, 3 Medium, 2 Low — **5 fixed automatically**

| # | Severity | Issue | File | Fix Applied |
|---|----------|-------|------|-------------|
| H1 | HIGH | Server actions don't validate `userId` parameter | `actions.ts` | Added `z.string().uuid()` validation to `updateUser`, `deactivateUser`, `reactivateUser` |
| H2 | HIGH | `updateUser` two-phase update has no logging on partial failure | `actions.ts` | Added `console.error` when profile update fails after auth update succeeds |
| M1 | MEDIUM | Zod `superRefine` used for data mutation instead of `transform` | `validations/users.ts` | Removed `data.store_id = undefined` mutation from `superRefine`; server action already handles this |
| M2 | MEDIUM | Role Select uses `defaultValue` instead of `value` | `edit-user-form.tsx` | Changed to `value={field.value}` for fully controlled component |
| M3 | MEDIUM | Missing `key` prop on `EditUserForm` — stale form data risk | `users-page-client.tsx` | Added `key={editingUser.id}` to force remount |
| L1 | LOW | `isPending` loading state invisible in DeactivateButton (dialog auto-closes) | `user-list.tsx` | Not fixed — cosmetic, toast provides feedback |
| L2 | LOW | Hardcoded placeholder "Sandra Silva" in edit form | `edit-user-form.tsx` | Not fixed — placeholder never visible (field pre-filled) |

**Build verified:** `npm run build` passes after all fixes.

### Change Log

- 2026-03-16: Implemented Story 1.6 — Admin edit user profile/role, deactivate/reactivate user accounts. Added updateUser/deactivateUser/reactivateUser server actions, EditUserForm component, Actions column in user list with AlertDialog confirmation for deactivation. Self-protection guards for admin self-deactivation and self-role-change.
- 2026-03-16: Code review — Fixed 5 issues (2 HIGH, 3 MEDIUM): added userId UUID validation to all server actions, added partial-failure logging in updateUser, removed superRefine data mutation, fixed role Select controlled component, added key prop to EditUserForm.

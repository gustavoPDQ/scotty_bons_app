---
title: 'Layout Shell & Users Page UI Polish'
slug: 'layout-shell-users-page-ui-polish'
created: '2026-03-16'
status: 'ready-for-dev'
stepsCompleted: [1, 2, 3, 4]
tech_stack: ['Next.js 16', 'Tailwind CSS 3.4', 'shadcn/ui', 'Radix UI', 'Lucide React', 'Supabase Auth', 'React Hook Form', 'Zod']
files_to_modify:
  - 'components/ui/sheet.tsx (new - shadcn add)'
  - 'lib/nav-items.ts (new)'
  - 'components/shared/sidebar.tsx'
  - 'components/shared/header.tsx (new)'
  - 'components/shared/breadcrumbs.tsx (new)'
  - 'components/shared/user-menu.tsx (new)'
  - 'components/shared/mobile-sidebar.tsx (new)'
  - 'app/(dashboard)/layout.tsx'
  - 'components/users/users-page-client.tsx'
code_patterns:
  - 'Server Components fetch data, pass to Client Components'
  - 'shadcn Card pattern: Card > CardHeader > CardTitle + CardContent'
  - 'usePathname() for active nav detection'
  - 'Role-based filtering with roles array on nav items'
  - 'cn() utility for conditional Tailwind classes'
  - 'DropdownMenu component already available'
  - 'Settings page pattern: p-6 max-w-2xl mx-auto space-y-8 with Card sections'
test_patterns: ['No automated UI tests - manual visual testing']
---

# Tech-Spec: Layout Shell & Users Page UI Polish

**Created:** 2026-03-16

## Overview

### Problem Statement

The app lacks a proper header (no logo, breadcrumbs, or user info), the sidebar doesn't work on mobile, and the Users page feels rough compared to the cleaner Settings page style.

### Solution

Add a responsive header with logo/breadcrumbs/user menu, make the sidebar mobile-friendly with hamburger/overlay, polish sidebar styling, and redesign the Users page with card-based sections matching the Settings pattern.

### Scope

**In Scope:**
- Header component (text logo, breadcrumbs, user name + dropdown with logout/settings)
- Responsive sidebar (hamburger on mobile, slide-in overlay)
- Sidebar style polish (logo/name at top, better spacing, refined look)
- Users page redesign (Card-wrapped sections for Stores and Users, cleaner table, better spacing)
- Light and dark mode support

**Out of Scope:**
- Desktop collapsed/icon-only sidebar mode
- New functionality (no new CRUD operations)
- Logo/branding assets (text-based logo only)
- Separating Stores into its own page

## Context for Development

### Codebase Patterns

- **Server/Client split**: Server Components (pages, layout) fetch data from Supabase, pass props to `"use client"` components for interactivity
- **shadcn/ui Card pattern**: Used in Settings page — `Card > CardHeader > CardTitle + CardContent` for visual grouping
- **Forms**: React Hook Form + Zod validation inside Dialog modals
- **Styling**: Tailwind CSS with CSS variables for light/dark theming; `cn()` utility for conditional classes
- **Navigation**: `usePathname()` for active link detection; `allNavItems` array with role-based filtering
- **Layout structure**: `flex min-h-screen` → fixed `w-56` sidebar + `flex-1` content area
- **Primary color**: gold/yellow `hsl(38 91% 55%)`
- **Sign out**: Uses `supabase.auth.signOut()` client-side via `createClient` from `@/lib/supabase/client`

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `app/(dashboard)/layout.tsx` | Dashboard layout — currently `flex` with Sidebar + content, fetches user & profile |
| `components/shared/sidebar.tsx` | Current sidebar — `w-56 shrink-0 border-r min-h-screen p-4`, nav with role filtering |
| `app/(dashboard)/users/page.tsx` | Users server page — fetches auth users + profiles + stores |
| `components/users/users-page-client.tsx` | Users client — flat sections for Stores and Users with Dialogs |
| `components/users/user-list.tsx` | Users table — Table with badges, edit/deactivate actions |
| `app/(dashboard)/settings/page.tsx` | **Style reference** — `p-6 max-w-2xl mx-auto space-y-8` with Card sections |
| `components/settings/change-password-form.tsx` | **Card pattern reference** — `Card > CardHeader > CardTitle + CardContent` |
| `components/ui/dropdown-menu.tsx` | Already available — use for user menu |
| `components/ui/card.tsx` | Already available — Card, CardHeader, CardTitle, CardDescription, CardContent |

### Technical Decisions

- **Text-based logo** ("Scotty Ops") at top of sidebar with a subtle icon
- **Breadcrumbs**: Derived from `usePathname()` + label map from shared `navItems`
- **Mobile breakpoint**: `md` (768px) — sidebar hidden below md, hamburger shown in header
- **Mobile sidebar**: shadcn `Sheet` component (side="left") for slide-in overlay
- **Header placement**: Above content area (right of sidebar on desktop), spans full width on mobile
- **User menu**: DropdownMenu with user initials circle, name, Settings link, and Sign Out
- **Shared nav items**: Extract `allNavItems` to `lib/nav-items.ts` for reuse
- **Users page**: Wrap Stores and Users sections each in `Card`, matching Settings card style

## Implementation Plan

### Tasks

- [ ] **Task 1: Add shadcn Sheet component**
  - File: `components/ui/sheet.tsx` (new)
  - Action: Run `npx shadcn@latest add sheet` inside the `scotty-ops/` submodule directory
  - Notes: Required for mobile sidebar overlay. This must be done first as other components depend on it.

- [ ] **Task 2: Extract nav items to shared module**
  - File: `lib/nav-items.ts` (new)
  - Action: Create a new file exporting the `allNavItems` array and its TypeScript type. The array currently lives in `components/shared/sidebar.tsx` (lines 8-13). Move it to `lib/nav-items.ts` and export it. Include the `NavItem` type with `href`, `label`, `icon`, and `roles` fields.
  - Notes: Both Sidebar and Breadcrumbs will import from here. Keep the Lucide icon imports in this file.

- [ ] **Task 3: Polish and update Sidebar**
  - File: `components/shared/sidebar.tsx`
  - Action:
    1. Import `allNavItems` from `@/lib/nav-items` instead of defining locally
    2. Add a logo/app name section at the top: "Scotty Ops" text with a `Package` or `Truck` icon from Lucide, styled with `text-lg font-bold` and a bottom border/divider separating it from nav
    3. Add `pt-4` top padding and increase nav gap from `gap-1` to `gap-1.5`
    4. Add `hidden md:block` to the `<aside>` so it hides on mobile
    5. Keep existing role-based filtering and active link styling unchanged
  - Notes: The sidebar keeps `w-56 shrink-0 border-r min-h-screen` base classes. Only visual polish + mobile hide.

- [ ] **Task 4: Create Breadcrumbs component**
  - File: `components/shared/breadcrumbs.tsx` (new)
  - Action: Create a `"use client"` component that:
    1. Uses `usePathname()` to get current path
    2. Imports `allNavItems` from `@/lib/nav-items` to map path → label
    3. Renders: `Home` (link to `/dashboard`) → `Current Page Label` (plain text)
    4. Uses `/` or `>` separator with `text-muted-foreground` styling
    5. If current path is `/dashboard`, show only "Home" (no breadcrumb trail)
  - Notes: Simple two-level breadcrumb only (Home > Page). No deep nesting needed. Use `text-sm` sizing.

- [ ] **Task 5: Create UserMenu component**
  - File: `components/shared/user-menu.tsx` (new)
  - Action: Create a `"use client"` component that:
    1. Accepts `userName: string` and `userEmail: string` props
    2. Renders a `DropdownMenu` (from existing `components/ui/dropdown-menu.tsx`) trigger button showing user initials in a circle (`rounded-full bg-primary text-primary-foreground size-8 text-xs font-medium`)
    3. Dropdown content includes:
       - Header section: user name (bold) + email (muted, smaller)
       - Separator
       - "Settings" link item → navigates to `/settings`
       - "Sign out" item → calls `supabase.auth.signOut()` from `@/lib/supabase/client`, then `router.push("/login")` and `router.refresh()`
    4. Import `Settings, LogOut` icons from Lucide for menu items
  - Notes: Use `DropdownMenuItem` with `asChild` for the Settings link. Sign out uses client-side Supabase.

- [ ] **Task 6: Create MobileSidebar component**
  - File: `components/shared/mobile-sidebar.tsx` (new)
  - Action: Create a `"use client"` component that:
    1. Accepts `role: string` prop
    2. Uses `Sheet` component (side="left") from `components/ui/sheet`
    3. Trigger: a `Button` with `variant="ghost" size="icon"` showing `Menu` icon from Lucide, with class `md:hidden` (only visible on mobile)
    4. Sheet content replicates the sidebar nav: logo at top, then filtered nav items (import from `@/lib/nav-items`)
    5. Uses `usePathname()` for active link styling (same `cn()` pattern as Sidebar)
    6. Closes the sheet on link click (set `open` state to `false` in `onOpenChange`)
    7. Sheet content width: `w-64` or similar comfortable mobile width
  - Notes: Must manage own open/close state with `useState`. Close on navigation is critical for good UX.

- [ ] **Task 7: Create Header component**
  - File: `components/shared/header.tsx` (new)
  - Action: Create a `"use client"` component that:
    1. Accepts props: `role: string`, `userName: string`, `userEmail: string`
    2. Renders a `<header>` with `h-14 border-b flex items-center justify-between px-4 shrink-0`
    3. Left side: `MobileSidebar` (hamburger, only on mobile) + `Breadcrumbs`
    4. Right side: `UserMenu` with name and email
    5. Layout: `flex items-center gap-3` for left group, user menu on right
  - Notes: The header sits above the page content, not above the sidebar. On mobile, hamburger appears on the left; on desktop, only breadcrumbs show on the left.

- [ ] **Task 8: Update Dashboard Layout**
  - File: `app/(dashboard)/layout.tsx`
  - Action:
    1. Fetch user name from `user.user_metadata?.name` or fall back to `user.email`
    2. Fetch user email from `user.email`
    3. Import and add `Header` component
    4. Update layout structure from:
       ```tsx
       <div className="flex min-h-screen">
         <Sidebar role={role} />
         <div className="flex-1">{children}</div>
       </div>
       ```
       To:
       ```tsx
       <div className="flex min-h-screen">
         <Sidebar role={role} />
         <div className="flex-1 flex flex-col">
           <Header role={role} userName={userName} userEmail={userEmail} />
           <main className="flex-1">{children}</main>
         </div>
       </div>
       ```
    5. Remove `<main>` wrapper from individual page files if they have one (users page and settings page use `<main>` — change to `<div>` to avoid nested `<main>` tags)
  - Notes: The `<main>` tag is now in the layout. Individual pages should use `<div>` or `<section>` instead. Check `settings/page.tsx` and `users/page.tsx` — both currently use `<main>`.

- [ ] **Task 9: Redesign Users page with Card layout**
  - File: `components/users/users-page-client.tsx`
  - Action:
    1. Import `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent` from `@/components/ui/card`
    2. Wrap the **Stores section** in a `Card`:
       - `CardHeader`: `CardTitle` = "Stores", `CardDescription` = "Create stores before adding Store Users.", plus "New Store" button in the header (flex between title and button)
       - `CardContent`: stores list (existing markup)
    3. Wrap the **Users section** in a `Card`:
       - `CardHeader`: `CardTitle` = "Users", `CardDescription` = user count, plus "New User" button
       - `CardContent`: `UserList` table + pagination controls
    4. Keep all existing Dialog/form logic unchanged
    5. Maintain `space-y-8` gap between cards (matching Settings page)
  - Notes: The Card headers should use a flex layout to place the action button on the right: `<CardHeader className="flex flex-row items-center justify-between">`. The table inside CardContent should not have its own `rounded-md border` since the Card provides the border — update `UserList` or wrap accordingly.

- [ ] **Task 10: Fix page wrapper tags to avoid nested `<main>`**
  - File: `app/(dashboard)/users/page.tsx` and `app/(dashboard)/settings/page.tsx`
  - Action: Change `<main>` to `<div>` in both files since the layout now provides the `<main>` wrapper
  - Notes: Also check `app/(dashboard)/dashboard/page.tsx` and `app/(dashboard)/orders/page.tsx` for same issue.

### Acceptance Criteria

- [ ] **AC 1**: Given a desktop viewport (>768px), when the dashboard loads, then a sidebar is visible on the left with "Scotty Ops" logo/text at top and navigation links below, and a header bar is visible above the content area with breadcrumbs on the left and user menu on the right.

- [ ] **AC 2**: Given a mobile viewport (<768px), when the dashboard loads, then the sidebar is hidden, a hamburger menu icon is visible in the header, and tapping it opens a slide-in sidebar overlay from the left.

- [ ] **AC 3**: Given the mobile sidebar is open, when a navigation link is tapped, then the sidebar closes and the user navigates to the selected page.

- [ ] **AC 4**: Given the mobile sidebar is open, when the backdrop/overlay area is tapped, then the sidebar closes without navigation.

- [ ] **AC 5**: Given any dashboard page, when the user clicks the user initials circle in the header, then a dropdown appears showing the user's name, email, a "Settings" link, and a "Sign out" action.

- [ ] **AC 6**: Given the user menu is open, when "Sign out" is clicked, then the user is signed out and redirected to the login page.

- [ ] **AC 7**: Given the user navigates to `/users`, when the page loads, then breadcrumbs show "Home > Users" in the header.

- [ ] **AC 8**: Given the user navigates to `/dashboard`, when the page loads, then breadcrumbs show only "Home" (no trailing breadcrumb).

- [ ] **AC 9**: Given the Users page loads, when viewing the Stores section, then it is wrapped in a Card with a "Stores" title, description, and "New Store" button in the card header.

- [ ] **AC 10**: Given the Users page loads, when viewing the Users section, then it is wrapped in a Card with a "Users" title, user count description, and "New User" button in the card header, with the table and pagination inside the card content.

- [ ] **AC 11**: Given dark mode is active, when viewing any page, then the header, sidebar, user menu, breadcrumbs, and Users page cards all render correctly with dark mode colors.

- [ ] **AC 12**: Given the Users page after redesign, when creating/editing/deactivating a user, then all existing CRUD operations work identically to before.

## Additional Context

### Dependencies

- **shadcn Sheet component** must be added: `npx shadcn@latest add sheet` inside the `scotty-ops/` submodule directory
- No other new npm packages needed — Sheet pulls in Radix Dialog internally which is already a dependency

### Testing Strategy

- **Manual visual testing**:
  - Desktop (>768px): Verify sidebar, header, breadcrumbs, user menu render correctly
  - Mobile (<768px): Verify hamburger, slide-in sidebar, close-on-navigate, close-on-backdrop
  - Toggle between light and dark mode for all new components
- **Functional testing**:
  - Verify role-based nav filtering works in both desktop sidebar and mobile sidebar
  - Verify breadcrumbs update on every page navigation
  - Verify user menu sign-out flow works end-to-end
  - Verify all Users page CRUD operations (create user, create store, edit user, deactivate, reactivate) still work after Card redesign
  - Verify pagination still works inside the Card

### Notes

- UI must be in English (per project feedback memory)
- Both light and dark mode must be supported
- The `UserList` component currently has `rounded-md border` on its wrapper `<div>` — when placed inside a `Card`, this may need adjustment to avoid double borders. Consider removing the outer border from UserList when inside CardContent, or using a borderless variant.
- Future consideration: desktop collapsed/icon-only sidebar mode could be added later but is explicitly out of scope.

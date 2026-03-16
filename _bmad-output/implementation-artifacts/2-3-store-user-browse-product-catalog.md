# Story 2.3: Store User — Browse Product Catalog

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Store User,
I want to browse the product catalog organized by category,
so that I can quickly find the items I need when building my supply order.

## Acceptance Criteria

1. **Given** a Store User accesses the catalog,
   **When** the page loads,
   **Then** all product categories are displayed and the full catalog loads within 2 seconds (NFR5).

2. **Given** a Store User views the catalog,
   **When** products are displayed,
   **Then** each product shows its name, unit of measure, and price — no edit or delete controls are visible.

3. **Given** the catalog has multiple categories,
   **When** a Store User browses the catalog,
   **Then** products are grouped by category with clear visual separation, and the Store User can navigate directly to a category via sticky category navigation (pills/tabs) without full-page scrolling.

4. **Given** a Store User navigates between categories,
   **When** they return to a previously visited category,
   **Then** their scroll position within that category is preserved.

5. **Given** the catalog has no products in any category,
   **When** a Store User views the catalog,
   **Then** an informative empty state is shown with guidance to contact the Admin.

## Tasks / Subtasks

- [x] Task 1 — Create `CatalogBrowser` client component for Store User read-only view (AC: #1, #2, #3, #4)
  - [x] Create `components/products/catalog-browser.tsx` as a `"use client"` component
  - [x] Accept props: `categories: CategoryRow[]`, `products: ProductRow[]`
  - [x] Group products by `category_id` using a `Map<string, ProductRow[]>`
  - [x] Render sticky category navigation bar (horizontal pill/tab row) at the top
  - [x] Each pill: category name + product count — clicking scrolls to the corresponding section
  - [x] Render each category as a section with `id` attribute for anchor scroll (`id={category.id}`)
  - [x] For each product: display name, unit of measure, price (formatted CAD) — NO edit/delete/dropdown controls
  - [x] Price formatting: `new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(value)`
  - [x] Use `useRef` + `scrollIntoView({ behavior: 'smooth', block: 'start' })` for category navigation
  - [x] Track active category on scroll via `IntersectionObserver` and highlight the active pill
  - [x] Scroll position preservation: since categories are all rendered in a single page, scroll position is naturally preserved when navigating between category pills

- [x] Task 2 — Update Products page to conditionally render Store vs Admin view (AC: #1, #2, #3)
  - [x] In `app/(dashboard)/products/page.tsx`:
    - Import `CatalogBrowser` component
    - If `isAdmin` is `false` (Store User): render ONLY `<CatalogBrowser>` with categories and products
    - If `isAdmin` is `true`: render existing `<CategoriesClient>` + `<ProductsClient>` (no change to Admin UX)
  - [x] Pass `productsWithCategory` and `categories` to `CatalogBrowser`
  - [x] Do NOT change the existing data queries — they already select the correct columns and are RLS-protected

- [x] Task 3 — Handle empty state for Store Users (AC: #5)
  - [x] In `CatalogBrowser`: if `products.length === 0`, render an empty state card with:
    - Package icon (from `lucide-react`)
    - "No products available" heading
    - "The product catalog is empty. Please contact your administrator." description
  - [x] If a specific category has zero products, do NOT render that category section (skip empty categories)

- [x] Task 4 — Sticky category navigation styling and responsiveness (AC: #3)
  - [x] Category pills bar: `sticky top-0 z-10 bg-background/95 backdrop-blur` — sticks when scrolling
  - [x] Horizontal scroll for overflow on mobile: `overflow-x-auto flex gap-2 py-3 px-1`
  - [x] Active pill: `bg-primary text-primary-foreground` — inactive: `bg-muted text-muted-foreground`
  - [x] Use `scroll-mt-16` (or similar) on category sections to offset for sticky nav height

- [x] Task 5 — Build and lint verification (AC: all)
  - [x] Run `npm run build` from `scotty-ops/scotty-ops/`
  - [x] Run `npm run lint` from `scotty-ops/scotty-ops/`
  - [x] Fix any TypeScript or lint errors

## Dev Notes

### CRITICAL: This Is a Read-Only UI Story — No Server Actions, No Migrations

This story adds a **read-only browsing view** for Store Users on the existing `/products` page. All data (categories, products) already exists from Stories 2-1 and 2-2. No new tables, no new server actions, no new migrations. The only change is:
1. A new client component (`CatalogBrowser`) for the Store User's grouped-by-category view
2. Conditional rendering in `page.tsx` based on `isAdmin`

### Existing Codebase — What Already Works

**Data layer (Story 2-1 / 2-2 — DO NOT MODIFY):**
- `page.tsx` already queries `product_categories` and `products` tables
- `page.tsx` already computes `productsWithCategory` with `category_name` enrichment
- `page.tsx` already detects role and sets `isAdmin` boolean
- `page.tsx` already redirects Factory Users to `/orders`
- RLS on `products` and `product_categories` already allows `admin` and `store` SELECT
- Nav items already show Products link for `admin` and `store` roles

**Admin view (Stories 2-1 / 2-2 — DO NOT MODIFY):**
- `CategoriesClient` — category CRUD (admin only)
- `ProductsClient` — product CRUD in flat list with dropdowns (admin only)
- `CategoryForm` / `ProductForm` — admin forms

**The Store User currently sees the same `CategoriesClient` + `ProductsClient` but with `isAdmin={false}` which hides CRUD buttons. This story replaces that with a purpose-built browsing UI.**

### UX Requirements from Design Spec

The UX design spec describes the Store User catalog browsing experience:
- **Grouped by category** — accordion or tabs per section (we implement as sticky pill navigation + scrollable sections)
- **Per product:** name, unit of measure, price — no edit controls
- **Category navigation** — sticky pills/tabs for quick category jumping without full-page scroll
- **Performance target:** full catalog loads within 2 seconds (NFR5) — SSR already handles this
- **Empty state:** informative message with guidance to contact Admin

**Design inspiration:** iFood/Chipotle browse-by-category pattern — the Store User (Daniel) already knows the catalog and needs *quick execution*, not *discovery*. The UI should feel like a familiar e-commerce browse experience.

### Architecture Compliance

**D8 — SSR + No Realtime:** This is a read-only page. Server Component fetches data, passes to client component as props. No Realtime subscription needed (catalog doesn't change in real-time during a Store User's session).

**D10 — No global state:** Active category tracking uses local React state (`useState`) + `IntersectionObserver`. No URL params needed for category state (single-page scroll view).

**D7/D11 — No mutations in this story:** No Server Actions, no forms, no Zod validation. Purely presentational.

**Anti-Patterns — NEVER DO:**
- `supabase.from('products').select('*')` — already using specific column selection in page.tsx
- Creating a separate data-fetching mechanism — reuse existing page.tsx queries
- Adding Realtime subscriptions for the catalog — unnecessary for a read-only view
- Modifying the Admin view — keep `CategoriesClient` + `ProductsClient` exactly as-is for Admin

### Technical Implementation Details

**IntersectionObserver for active category tracking:**
```typescript
// In CatalogBrowser, track which category section is currently visible
const observerRef = useRef<IntersectionObserver | null>(null);
const [activeCategory, setActiveCategory] = useState<string>("");

useEffect(() => {
  observerRef.current = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          setActiveCategory(entry.target.id);
        }
      }
    },
    { rootMargin: "-80px 0px -80% 0px", threshold: 0 }
  );
  // Observe each category section element
  // Cleanup on unmount
}, []);
```

**Sticky pill navigation:**
```tsx
<div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b">
  <div className="flex gap-2 overflow-x-auto py-3 px-1 no-scrollbar">
    {categoriesWithProducts.map((cat) => (
      <button
        key={cat.id}
        onClick={() => scrollToCategory(cat.id)}
        className={cn(
          "px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors",
          activeCategory === cat.id
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground hover:bg-muted/80"
        )}
      >
        {cat.name} ({cat.productCount})
      </button>
    ))}
  </div>
</div>
```

**Currency formatting — reuse the same pattern from ProductsClient:**
```typescript
const formatPrice = (value: number) =>
  new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(value);
```

### Library & Framework Requirements

**Already installed — use these exact packages (do NOT install alternatives):**

| Package | Purpose | Import |
|---------|---------|--------|
| `lucide-react` | Icons (Package, ShoppingBasket) | `import { Package, ShoppingBasket } from "lucide-react"` |
| `next/navigation` | Not needed for this component | — |

**shadcn/ui components — already installed, import from `@/components/ui/`:**
- `Card`, `CardContent`, `CardHeader`, `CardTitle` — for category sections and empty state
- `cn` utility from `@/lib/utils` — for conditional classNames on pills

**No new packages needed. No new shadcn/ui components to install.**

**Do NOT install:**
- Any scroll library (react-scroll, react-scrollspy) — native `scrollIntoView` + `IntersectionObserver` suffice
- Any tab/navigation library — custom pill buttons are simpler and sufficient

### File Structure Requirements

**Files to CREATE:**

```
scotty-ops/scotty-ops/
├── components/products/catalog-browser.tsx    — Store User read-only catalog browse component
```

**Files to MODIFY:**

```
scotty-ops/scotty-ops/
├── app/(dashboard)/products/page.tsx          — Conditional render: CatalogBrowser for Store, existing for Admin
```

**Files NOT to touch (no changes needed):**

```
scotty-ops/scotty-ops/
├── components/products/categories-client.tsx   — Admin-only; keep as-is
├── components/products/products-client.tsx      — Admin-only; keep as-is
├── components/products/product-form.tsx         — Admin-only; keep as-is
├── components/products/category-form.tsx        — Admin-only; keep as-is
├── app/(dashboard)/products/actions.ts          — No new actions needed
├── lib/validations/products.ts                  — No new schemas needed
├── lib/types/index.ts                           — No new types needed (CategoryRow, ProductRow already exist)
├── lib/nav-items.ts                             — Already correct (admin, store roles have Products link)
├── middleware.ts                                — No changes needed
```

**Naming Conventions (match existing codebase):**
- Component file: `kebab-case.tsx` — `catalog-browser.tsx`
- Component export: `PascalCase` — `CatalogBrowser`

### Testing Requirements

- Run `npm run build` — must pass with zero errors
- Run `npm run lint` — must pass with zero warnings/errors
- Manual verification: Store User sees grouped-by-category view with sticky navigation pills
- Manual verification: Store User does NOT see any edit/delete/create controls
- Manual verification: Admin User still sees the existing `CategoriesClient` + `ProductsClient` view unchanged
- Manual verification: Clicking a category pill scrolls to that section
- Manual verification: Empty catalog shows informative empty state for Store User
- Manual verification: Factory User is still redirected away from `/products`

### Previous Story Intelligence (from Stories 2-1 and 2-2)

**Key learnings that MUST inform this implementation:**

1. **`isAdmin` prop pattern** — Both `CategoriesClient` and `ProductsClient` receive `isAdmin` as a prop to conditionally render CRUD controls. The Store User sees the same components but without actions. This story replaces that approach for Store Users with a dedicated browse component.

2. **`productsWithCategory` enrichment** — `page.tsx` already joins product data with category names via a `Map`. The `CatalogBrowser` component should receive these enriched products directly — do NOT re-query or re-process.

3. **Price formatting is `en-CA` / `CAD`** — established in Story 2-2. Use the same `Intl.NumberFormat` pattern.

4. **UI language is English** — all labels, button text in English per project requirements. The epics file has PT-BR text ("Catálogo", "Produtos") — these are from the UX spec written in Portuguese. Translate to English for the implementation.

5. **Empty state pattern** — `ProductsClient` already has an empty state: `"No products yet."`. Follow the same styling pattern but with Store-User-specific guidance.

6. **`page.tsx` changes must preserve existing Admin flow** — the page currently renders both `CategoriesClient` and `ProductsClient` for all roles. Change is conditional branching only.

### Git Intelligence

**Recent commits (scotty-ops submodule):**
- `602dbdd` fix: add password confirmation field (story 1-2)
- `6aaa258` fix: add role-based redirect (story 1-1)
- Stories 2-1 and 2-2 changes exist in working tree but are not yet committed

**Commit pattern:** Use `feat:` prefix for new functionality. Format: `feat: add store user catalog browse view (story 2-3)`

### Project Structure Notes

- Alignment with unified project structure: new component in `components/products/` — matches existing convention
- Route remains `/products` — same page, different view per role
- No new routes or pages needed — single-page conditional rendering

### References

- [Source: epics.md — Epic 2, Story 2.3] User story, acceptance criteria, UX requirements
- [Source: prd.md — FR15] Store Users can browse the product catalog organized by category
- [Source: prd.md — FR16] Factory Users have no access to the product catalog
- [Source: ux-design-specification.md — Section 2] Catalog browsing: grouped by category, sticky nav, quick execution UX
- [Source: architecture.md — D8] SSR-first data fetching, no Realtime for read-only pages
- [Source: architecture.md — D10] No global state — local React state for active category
- [Source: architecture.md — Anti-Patterns] Never `select('*')`, no service_role in components
- [Source: Story 2-2 — Dev Notes] Price formatting `en-CA`/`CAD`, `isAdmin` prop pattern, empty state styling
- [Source: Story 2-2 — File List] Existing files in `components/products/` and `app/(dashboard)/products/`
- [Source: memory/feedback_ui_language.md] UI is English — all labels in English

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

No issues encountered during implementation.

### Completion Notes List

- Created `CatalogBrowser` client component with grouped-by-category view, sticky pill navigation, IntersectionObserver-based active category tracking, smooth scroll navigation, and empty state handling.
- Updated `page.tsx` to conditionally render `CatalogBrowser` for Store Users vs existing `CategoriesClient` + `ProductsClient` for Admins.
- No new dependencies, no migrations, no server actions — purely presentational read-only UI.
- Build and lint pass with zero errors.

### File List

- `scotty-ops/components/products/catalog-browser.tsx` — **CREATED** — Store User read-only catalog browse component
- `scotty-ops/app/(dashboard)/products/page.tsx` — **MODIFIED** — Conditional rendering: CatalogBrowser for Store, existing components for Admin
- `scotty-ops/lib/utils.ts` — **MODIFIED** — Extracted shared `formatPrice` utility
- `scotty-ops/components/products/products-client.tsx` — **MODIFIED** — Import `formatPrice` from shared utils instead of local duplicate

### Change Log

- 2026-03-16: Implemented story 2-3 — Store User browse product catalog with grouped-by-category view, sticky category navigation pills, IntersectionObserver active tracking, empty state, and role-based conditional rendering
- 2026-03-16: Code review fixes — Fixed IntersectionObserver stale closure bug (useMemo + proper deps), extracted shared formatPrice utility, added useMemo for expensive computations, replaced non-null assertion with safe fallback, added semantic nav element with aria-label, added type="button" to pill buttons

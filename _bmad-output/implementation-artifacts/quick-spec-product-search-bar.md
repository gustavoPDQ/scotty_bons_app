# Quick Spec: Product Search Bar

## Overview
Add a client-side product search bar to three screens: **Product Catalog (Admin)**, **Product Catalog (Browser)**, and **New Order (browse phase)**. The search filters products by name in real-time as the user types.

## Scope
- **In scope:** Client-side text filtering of already-loaded products by name
- **Out of scope:** Server-side search, search by modifier/price, edit order page (separate concern), fuzzy matching

## Target Files

| File | Component | What changes |
|------|-----------|-------------|
| `components/products/catalog-browser.tsx` | `CatalogBrowser` | Add search input above category nav; filter `products` by name |
| `components/products/catalog-admin.tsx` | `CatalogAdmin` | Add search input inside `CardHeader`; filter products and hide empty categories |
| `components/orders/new-order-cart.tsx` | `NewOrderCart` | Add search input above category nav in browse phase; filter products by name |

## UI Design

### Search Input
- Use existing `Input` component with `leftIcon={<Search className="size-4" />}` from `lucide-react`
- Placeholder: `"Search products..."`
- No debounce needed (client-side filtering of small dataset)
- Include a clear button (X icon) when text is present, or use `type="search"` for native clear

### Placement
- **CatalogBrowser:** Between the `<div className="space-y-4">` container start and the sticky category nav
- **CatalogAdmin:** Inside `CardHeader`, after the "New Category" / "New Product" buttons row
- **NewOrderCart (browse):** Above the sticky category nav, inside the `<div className="space-y-4 pb-24">` container

### Behavior
1. User types in search input
2. Products are filtered: `product.name.toLowerCase().includes(query.toLowerCase())`
3. Categories with zero matching products are hidden from both the category nav pills and the category sections
4. When search is cleared, full catalog restores
5. Category nav pill counts update to reflect filtered products
6. If no products match, show a "No products found" empty state

## Implementation Details

### State
```tsx
const [searchQuery, setSearchQuery] = useState("");
```

### Filtered products memo (same pattern for all 3 components)
```tsx
const filteredProducts = useMemo(() => {
  if (!searchQuery.trim()) return products;
  const q = searchQuery.toLowerCase();
  return products.filter((p) => p.name.toLowerCase().includes(q));
}, [products, searchQuery]);
```

Then replace `products` with `filteredProducts` in all downstream `useMemo` hooks (`productsByCategory`, `categoriesWithProducts`).

### CatalogAdmin specifics
- The `productsByCategory` Record should be built from `filteredProducts` instead of `products`
- Categories with no matching products should still appear (admin needs to manage them) but show "No matching products" when expanded
- The total count in `CardDescription` should reflect filtered state: `"Showing X of Y products"`

### NewOrderCart specifics
- Search only affects the browse phase, not review
- Cart items are unaffected by search (user can still see/modify cart regardless of search)
- Reset search when switching to review phase is optional (keep state)

## Acceptance Criteria
- [ ] Search input visible on all three screens
- [ ] Typing filters products by name (case-insensitive)
- [ ] Category nav pills update to show only categories with matching products
- [ ] Category sections with zero matches are hidden (browser/order) or show empty message (admin)
- [ ] Clearing search restores full catalog
- [ ] "No products found" empty state when zero results
- [ ] No layout shift when search is added
- [ ] Works on mobile (search input is full-width, doesn't break sticky nav)

## Dependencies
- No new packages needed
- Uses existing `Input` component with `leftIcon` prop
- Uses existing `Search` icon from `lucide-react`

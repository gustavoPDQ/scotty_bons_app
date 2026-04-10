# Quick Spec: Multiple Product Images

## Overview
Allow products to have more than one photo. Currently each product stores a single `image_url` text column. This spec introduces a `product_images` join table, updates all upload/remove actions, adjusts the product form to support a multi-image gallery, and updates every display component to show the primary (first) image while enabling a swipeable lightbox.

## Scope
- **In scope:** New `product_images` table, migration of existing `image_url` data, multi-image upload/remove/reorder in product form, gallery lightbox in order screens, updated thumbnails everywhere
- **Out of scope:** Drag-and-drop reorder in the form (use simple up/down arrows), image cropping, video uploads, alt-text editing

## Database Changes

### New migration: `20260410110000_product_images_table.sql`

```sql
-- Create product_images table (replaces single image_url column)
CREATE TABLE product_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookups by product
CREATE INDEX idx_product_images_product_id ON product_images(product_id);

-- RLS
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "product_images_select"
  ON product_images FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "product_images_insert_admin"
  ON product_images FOR INSERT
  TO authenticated
  WITH CHECK (auth_role() = 'admin');

CREATE POLICY "product_images_update_admin"
  ON product_images FOR UPDATE
  TO authenticated
  USING (auth_role() = 'admin');

CREATE POLICY "product_images_delete_admin"
  ON product_images FOR DELETE
  TO authenticated
  USING (auth_role() = 'admin');

-- Migrate existing image_url data into the new table
INSERT INTO product_images (product_id, url, sort_order)
SELECT id, image_url, 0
FROM products
WHERE image_url IS NOT NULL;

-- Drop the old column
ALTER TABLE products DROP COLUMN image_url;
```

### Storage bucket
No changes — the existing `product-images` bucket and its RLS policies remain as-is. File path pattern changes from `{productId}.{ext}` to `{productId}/{uuid}.{ext}` to support multiple files per product.

## Type Changes

### `lib/types/index.ts`

```diff
+export type ProductImageRow = {
+  id: string;
+  url: string;
+  sort_order: number;
+};

 export type ProductRow = {
   id: string;
   name: string;
   category_id: string;
   category_name?: string;
-  image_url?: string | null;
+  images: ProductImageRow[];
   sort_order: number;
   modifiers: ProductModifierRow[];
 };
```

### `lib/types/database.types.ts`
Update the generated types (or regenerate) to reflect `product_images` table and the removed `image_url` column from `products`.

## Target Files

| File | What changes |
|------|-------------|
| `supabase/migrations/20260410110000_product_images_table.sql` | New migration (see above) |
| `lib/types/index.ts` | Add `ProductImageRow`, replace `image_url` with `images` on `ProductRow` |
| `lib/types/database.types.ts` | Regenerate or manually update |
| `app/(dashboard)/products/actions.ts` | Rewrite `uploadProductImage` / `removeProductImage`, add `reorderProductImages` |
| `app/(dashboard)/products/page.tsx` | Update select query to join `product_images` |
| `app/(dashboard)/orders/new/page.tsx` | Update select query to join `product_images` |
| `app/(dashboard)/orders/[order-id]/edit/page.tsx` | Update select query to join `product_images` |
| `components/products/product-form.tsx` | Multi-image upload UI with add/remove per image |
| `components/products/products-client.tsx` | Use `images[0]?.url` for thumbnail |
| `components/products/catalog-browser.tsx` | Use `images[0]?.url` for thumbnail |
| `components/products/catalog-admin.tsx` | Use `images[0]?.url` for thumbnail |
| `components/orders/new-order-cart.tsx` | Use `images[0]?.url` for thumbnail; gallery lightbox |

## Server Actions (`app/(dashboard)/products/actions.ts`)

### `uploadProductImage(productId, formData)` — updated
```ts
// New file path pattern: {productId}/{uuid}.{ext}
// No longer upserts — each upload creates a new entry
// Steps:
// 1. Validate file (same rules: JPEG/PNG/WebP, max 2MB)
// 2. Generate path: `${productId}/${crypto.randomUUID()}.${ext}`
// 3. Upload to storage bucket
// 4. Get public URL
// 5. Get current max sort_order for this product's images
// 6. INSERT into product_images (product_id, url, sort_order)
// 7. Return the new image row
```

### `removeProductImage(imageId)` — updated signature
```ts
// Now takes imageId (uuid) instead of productId
// Steps:
// 1. Fetch the product_images row by id
// 2. Extract storage path from URL
// 3. Delete from storage bucket
// 4. DELETE from product_images table
```

### `reorderProductImages(productId, orderedImageIds)` — new
```ts
// Takes productId and array of image IDs in desired order
// Updates sort_order for each image
```

## Product Form (`components/products/product-form.tsx`)

### State changes
```diff
-const [imageFile, setImageFile] = useState<File | null>(null);
-const [imagePreview, setImagePreview] = useState<string | null>(product?.image_url ?? null);
-const [removeImage, setRemoveImage] = useState(false);
+type ImageEntry = { id?: string; url: string; file?: File; markedForRemoval?: boolean };
+const [images, setImages] = useState<ImageEntry[]>(
+  () => product?.images?.map((img) => ({ id: img.id, url: img.url })) ?? []
+);
+const [newFiles, setNewFiles] = useState<ImageEntry[]>([]);
```

### UI changes
- Replace the single image upload area with a horizontal scrollable row of image thumbnails
- Each thumbnail shows a small "X" button to mark for removal
- At the end of the row, show an "Add image" button (same dashed-border style) to upload additional images
- The file input should accept `multiple` attribute
- Max images limit: **5** (configurable constant)
- Show count indicator: "2 / 5 images"

### Layout
```
[ img1 (X) ] [ img2 (X) ] [ + Add image ]
                                2 / 5 images
```

Each thumbnail: 80x80px, rounded, `object-cover`, with a small destructive "X" button at top-right.

### Submission changes
```ts
// On submit:
// 1. Create/update the product (same as before)
// 2. For each image marked for removal: call removeProductImage(imageId)
// 3. For each new file: call uploadProductImage(productId, formData)
// 4. If order changed: call reorderProductImages(productId, orderedIds)
```

## Display Components

### Thumbnail pattern (products-client, catalog-browser, catalog-admin)
Replace all occurrences of:
```tsx
product.image_url ? (
  <Image src={product.image_url} ... />
) : (
  <Package ... />
)
```
With:
```tsx
product.images?.[0] ? (
  <Image src={product.images[0].url} ... />
) : (
  <Package ... />
)
```

### Lightbox (`new-order-cart.tsx`)
- Update lightbox state from `{ url: string; name: string }` to `{ images: ProductImageRow[]; name: string; index: number }`
- When clicking a product image, open lightbox at index 0
- Add left/right navigation arrows when `images.length > 1`
- Show dot indicators below the image (e.g., "1 / 3")
- Arrow buttons: `ChevronLeft` / `ChevronRight` from lucide-react, positioned on left/right sides of the dialog
- Swipe support is out of scope for now (just arrows + dots)

## Query Changes

All three page files currently select:
```ts
.select("id, name, category_id, image_url, sort_order, product_modifiers(...)")
```

Update to:
```ts
.select("id, name, category_id, sort_order, product_modifiers(...), product_images(id, url, sort_order)")
```

And in the mapping, replace `image_url: p.image_url` with:
```ts
images: ((p.product_images ?? []) as ProductImageRow[])
  .sort((a, b) => a.sort_order - b.sort_order),
```

## Acceptance Criteria
- [ ] `product_images` table exists with proper RLS
- [ ] Existing `image_url` data migrated to `product_images` (sort_order = 0)
- [ ] `image_url` column removed from `products`
- [ ] Product form supports uploading up to 5 images
- [ ] Product form shows all current images with individual remove buttons
- [ ] Images are stored under `{productId}/{uuid}.{ext}` path pattern
- [ ] All thumbnails across the app show the first image (by sort_order)
- [ ] Lightbox on order screen supports navigating through multiple images
- [ ] Removing an image deletes it from both storage and the `product_images` table
- [ ] Creating a new product and uploading images works correctly
- [ ] Editing a product preserves existing images and allows adding/removing
- [ ] No regressions on products with zero images (Package icon fallback)

## Dependencies
- No new packages needed
- Uses existing `product-images` storage bucket
- Uses existing UI components (`Dialog`, `Image`, `Button`)
- New icons needed: `ChevronLeft`, `ChevronRight` from `lucide-react` (already available)

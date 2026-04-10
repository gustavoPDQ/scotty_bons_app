-- Migration: product_images_table
-- Replaces single image_url column with a product_images table for multi-image support.
-- Depends on: add_product_images (image_url column must exist for data migration)

-- Create product_images table
CREATE TABLE product_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

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

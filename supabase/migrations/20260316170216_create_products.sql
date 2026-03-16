-- Migration: create_products
-- Creates the products table for the product catalog.
-- Depends on: create_product_categories (product_categories table must exist)
-- Depends on: create_rls_helpers (auth_role() must exist)

CREATE TABLE IF NOT EXISTS products (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  price           numeric(10,2) NOT NULL CONSTRAINT products_price_positive CHECK (price > 0),
  unit_of_measure text NOT NULL,
  category_id     uuid NOT NULL REFERENCES product_categories(id) ON DELETE RESTRICT,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Index on category_id for efficient category-scoped queries
CREATE INDEX idx_products_category_id ON products(category_id);

-- ── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- SELECT: Admin and Store users can read products
CREATE POLICY "products_select_admin_store"
  ON products FOR SELECT
  USING (auth_role() IN ('admin', 'store'));

-- INSERT: Only Admins can create products
CREATE POLICY "products_insert_admin"
  ON products FOR INSERT
  WITH CHECK (auth_role() = 'admin');

-- UPDATE: Only Admins can update products
CREATE POLICY "products_update_admin"
  ON products FOR UPDATE
  USING (auth_role() = 'admin')
  WITH CHECK (auth_role() = 'admin');

-- DELETE: Only Admins can delete products
CREATE POLICY "products_delete_admin"
  ON products FOR DELETE
  USING (auth_role() = 'admin');

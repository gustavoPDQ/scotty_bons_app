-- Migration: create_product_categories
-- Creates the product_categories table for organizing the product catalog.
-- Depends on: create_rls_helpers (auth_role() must exist)

CREATE TABLE IF NOT EXISTS product_categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL UNIQUE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER product_categories_updated_at
  BEFORE UPDATE ON product_categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read categories (store users browse catalog)
CREATE POLICY "product_categories_select_authenticated"
  ON product_categories FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Only Admins can create categories
CREATE POLICY "product_categories_insert_admin"
  ON product_categories FOR INSERT
  WITH CHECK (auth_role() = 'admin');

-- Only Admins can update categories
CREATE POLICY "product_categories_update_admin"
  ON product_categories FOR UPDATE
  USING (auth_role() = 'admin')
  WITH CHECK (auth_role() = 'admin');

-- Only Admins can delete categories
CREATE POLICY "product_categories_delete_admin"
  ON product_categories FOR DELETE
  USING (auth_role() = 'admin');

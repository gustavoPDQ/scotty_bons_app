-- Migration: create_orders
-- Creates order management tables: orders, order_items, order_status_history
-- with RLS policies, indexes, and helper functions.
-- Depends on: create_stores, create_rls_helpers, create_products

-- ── orders ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS orders (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id        uuid NOT NULL REFERENCES stores(id),
  submitted_by    uuid NOT NULL REFERENCES auth.users(id),
  status          text NOT NULL DEFAULT 'submitted'
                    CHECK (status IN ('submitted', 'under_review', 'approved', 'declined', 'fulfilled')),
  decline_reason  text,
  fulfilled_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- REUSE existing trigger function — do NOT recreate update_updated_at_column()
CREATE TRIGGER orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_orders_store_id ON orders(store_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_submitted_by ON orders(submitted_by);

-- ── order_items ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS order_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id      uuid NOT NULL REFERENCES products(id),
  product_name    text NOT NULL,
  unit_of_measure text NOT NULL,
  unit_price      numeric(10,2) NOT NULL,
  quantity        integer NOT NULL CONSTRAINT order_items_quantity_positive CHECK (quantity > 0),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_order_items_order_id ON order_items(order_id);

-- ── order_status_history ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS order_status_history (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status          text NOT NULL,
  changed_by      uuid NOT NULL REFERENCES auth.users(id),
  changed_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_order_status_history_order_id ON order_status_history(order_id);

-- ── Trigger: auto-insert initial status history on order creation ─────────────

CREATE OR REPLACE FUNCTION insert_initial_order_status()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO order_status_history (order_id, status, changed_by)
  VALUES (NEW.id, NEW.status, NEW.submitted_by);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE TRIGGER orders_insert_status_history
  AFTER INSERT ON orders
  FOR EACH ROW EXECUTE FUNCTION insert_initial_order_status();

-- ── Helper: check if order belongs to current store user ──────────────────────

CREATE OR REPLACE FUNCTION order_belongs_to_store(p_order_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM orders WHERE id = p_order_id AND store_id = auth_store_id()
  )
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

-- ── RLS: orders ───────────────────────────────────────────────────────────────

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Admin: full access
CREATE POLICY "orders_select_admin"
  ON orders FOR SELECT
  USING (auth_role() = 'admin');

CREATE POLICY "orders_insert_admin"
  ON orders FOR INSERT
  WITH CHECK (auth_role() = 'admin');

CREATE POLICY "orders_update_admin"
  ON orders FOR UPDATE
  USING (auth_role() = 'admin')
  WITH CHECK (auth_role() = 'admin');

CREATE POLICY "orders_delete_admin"
  ON orders FOR DELETE
  USING (auth_role() = 'admin');

-- Store: SELECT + INSERT own store only
CREATE POLICY "orders_select_store"
  ON orders FOR SELECT
  USING (auth_role() = 'store' AND store_id = auth_store_id());

CREATE POLICY "orders_insert_store"
  ON orders FOR INSERT
  WITH CHECK (auth_role() = 'store' AND store_id = auth_store_id());

-- Factory: SELECT all (read-only)
CREATE POLICY "orders_select_factory"
  ON orders FOR SELECT
  USING (auth_role() = 'factory');

-- ── RLS: order_items ──────────────────────────────────────────────────────────

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Admin: full access
CREATE POLICY "order_items_select_admin"
  ON order_items FOR SELECT
  USING (auth_role() = 'admin');

CREATE POLICY "order_items_insert_admin"
  ON order_items FOR INSERT
  WITH CHECK (auth_role() = 'admin');

CREATE POLICY "order_items_update_admin"
  ON order_items FOR UPDATE
  USING (auth_role() = 'admin')
  WITH CHECK (auth_role() = 'admin');

CREATE POLICY "order_items_delete_admin"
  ON order_items FOR DELETE
  USING (auth_role() = 'admin');

-- Store: SELECT own order items; INSERT only for own orders
CREATE POLICY "order_items_select_store"
  ON order_items FOR SELECT
  USING (auth_role() = 'store' AND order_belongs_to_store(order_id));

CREATE POLICY "order_items_insert_store"
  ON order_items FOR INSERT
  WITH CHECK (auth_role() = 'store' AND order_belongs_to_store(order_id));

-- Factory: SELECT all (read-only)
CREATE POLICY "order_items_select_factory"
  ON order_items FOR SELECT
  USING (auth_role() = 'factory');

-- ── RLS: order_status_history ─────────────────────────────────────────────────

ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;

-- Admin: SELECT + INSERT (for future status changes)
CREATE POLICY "order_status_history_select_admin"
  ON order_status_history FOR SELECT
  USING (auth_role() = 'admin');

CREATE POLICY "order_status_history_insert_admin"
  ON order_status_history FOR INSERT
  WITH CHECK (auth_role() = 'admin');

-- Store: SELECT own order history only
CREATE POLICY "order_status_history_select_store"
  ON order_status_history FOR SELECT
  USING (auth_role() = 'store' AND order_belongs_to_store(order_id));

-- Factory: SELECT all (read-only)
CREATE POLICY "order_status_history_select_factory"
  ON order_status_history FOR SELECT
  USING (auth_role() = 'factory');

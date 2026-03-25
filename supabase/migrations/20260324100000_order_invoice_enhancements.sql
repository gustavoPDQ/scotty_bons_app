-- Migration: order_invoice_enhancements
-- 1. Remove under_review order status
-- 2. Add ad_royalties_fee column to invoices
-- 3. Repurpose company_* columns for commissary billing info
-- 4. Create financial_settings table (if not exists) with updated RLS
-- 5. Add store UPDATE policy on orders for own submitted orders
-- 6. Add store/commissary DELETE-like (soft-delete) policies
-- 7. Add order_items delete/update policies for commissary and store
-- 8. Update fulfill_order_with_invoice RPC with ad fee + commissary info
-- Depends on: create_orders, create_invoices, rename_factory_to_commissary,
--             rename_unit_of_measure_to_modifier, commissary_full_order_actions

-- ── 1. Remove under_review from orders CHECK constraint ─────────────────────

-- Drop old CHECK and add new one without under_review
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('submitted', 'approved', 'declined', 'fulfilled'));

-- Safety: move any existing under_review orders to submitted
UPDATE orders SET status = 'submitted' WHERE status = 'under_review';
UPDATE order_status_history SET status = 'submitted' WHERE status = 'under_review';

-- ── 2. Add ad_royalties_fee column to invoices ─────────────────────────────

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS ad_royalties_fee NUMERIC(12,2) NOT NULL DEFAULT 0;

-- ── 3. Create financial_settings table ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS financial_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE financial_settings ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read settings (need HST rate / commissary info)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'financial_settings' AND policyname = 'financial_settings_select_authenticated'
  ) THEN
    CREATE POLICY "financial_settings_select_authenticated"
      ON financial_settings FOR SELECT
      USING (auth.uid() IS NOT NULL);
  END IF;
END $$;

-- Drop old admin-only select policy if it exists (replaced by authenticated)
DROP POLICY IF EXISTS "financial_settings_select_admin" ON financial_settings;

-- Admin-only write
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'financial_settings' AND policyname = 'financial_settings_insert_admin'
  ) THEN
    CREATE POLICY "financial_settings_insert_admin"
      ON financial_settings FOR INSERT
      WITH CHECK (auth_role() = 'admin');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'financial_settings' AND policyname = 'financial_settings_update_admin'
  ) THEN
    CREATE POLICY "financial_settings_update_admin"
      ON financial_settings FOR UPDATE
      USING (auth_role() = 'admin');
  END IF;
END $$;

-- ── 4. Store UPDATE policy on orders (edit own submitted orders) ────────────

CREATE POLICY "orders_update_store"
  ON orders FOR UPDATE
  USING (auth_role() = 'store' AND store_id = auth_store_id() AND status = 'submitted' AND deleted_at IS NULL)
  WITH CHECK (auth_role() = 'store' AND store_id = auth_store_id());

-- ── 5. Order items: commissary + store update/delete policies ───────────────

-- Commissary can update/delete order items (for non-fulfilled orders — enforced in app)
CREATE POLICY "order_items_update_commissary"
  ON order_items FOR UPDATE
  USING (auth_role() = 'commissary')
  WITH CHECK (auth_role() = 'commissary');

CREATE POLICY "order_items_delete_commissary"
  ON order_items FOR DELETE
  USING (auth_role() = 'commissary');

CREATE POLICY "order_items_insert_commissary"
  ON order_items FOR INSERT
  WITH CHECK (auth_role() = 'commissary');

-- Store can update/delete own order items (for submitted orders — enforced in app)
CREATE POLICY "order_items_update_store"
  ON order_items FOR UPDATE
  USING (auth_role() = 'store' AND order_belongs_to_store(order_id))
  WITH CHECK (auth_role() = 'store' AND order_belongs_to_store(order_id));

CREATE POLICY "order_items_delete_store"
  ON order_items FOR DELETE
  USING (auth_role() = 'store' AND order_belongs_to_store(order_id));

-- ── 6. Update fulfill_order_with_invoice RPC ────────────────────────────────

CREATE OR REPLACE FUNCTION fulfill_order_with_invoice(p_order_id uuid)
RETURNS uuid AS $$
DECLARE
  v_order RECORD;
  v_store RECORD;
  v_invoice_id uuid;
  v_invoice_number text;
  v_year integer;
  v_counter integer;
  v_subtotal numeric(12,2);
  v_tax_rate numeric(5,4);
  v_tax_amount numeric(12,2);
  v_ad_fee numeric(12,2);
  v_grand_total numeric(12,2);
  v_company_name text;
  v_company_address text;
  v_company_phone text;
BEGIN
  -- Auth check: only commissary or admin can fulfill
  IF auth_role() NOT IN ('commissary', 'admin') THEN
    RAISE EXCEPTION 'Unauthorized.';
  END IF;

  -- Fetch and validate order
  SELECT id, store_id, status INTO v_order FROM orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found.';
  END IF;
  IF v_order.status != 'approved' THEN
    RAISE EXCEPTION 'Only approved orders can be fulfilled.';
  END IF;

  -- Check if invoice already exists for this order (idempotency guard)
  IF EXISTS (SELECT 1 FROM invoices WHERE order_id = p_order_id) THEN
    SELECT id INTO v_invoice_id FROM invoices WHERE order_id = p_order_id;
    RETURN v_invoice_id;
  END IF;

  -- Update order status to fulfilled (with optimistic lock on status)
  UPDATE orders
    SET status = 'fulfilled', fulfilled_at = now(), updated_at = now()
    WHERE id = p_order_id AND status = 'approved';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order status changed concurrently.';
  END IF;

  -- Fetch financial_settings: commissary info
  SELECT value INTO v_company_name FROM financial_settings WHERE key = 'commissary_name';
  SELECT value INTO v_company_address FROM financial_settings WHERE key = 'commissary_address';
  SELECT value INTO v_company_phone FROM financial_settings WHERE key = 'commissary_phone';

  v_company_name := COALESCE(v_company_name, '');
  v_company_address := COALESCE(v_company_address, '');
  v_company_phone := COALESCE(v_company_phone, '');

  -- Append postal code to address if available
  DECLARE v_postal text;
  BEGIN
    SELECT value INTO v_postal FROM financial_settings WHERE key = 'commissary_postal_code';
    IF v_postal IS NOT NULL AND v_postal != '' THEN
      v_company_address := v_company_address || E'\n' || v_postal;
    END IF;
  END;

  -- Fetch HST rate
  SELECT COALESCE(value::numeric / 100, 0) INTO v_tax_rate
    FROM financial_settings WHERE key = 'hst_rate';
  IF v_tax_rate IS NULL THEN
    v_tax_rate := 0;
  END IF;

  -- Fetch ad & royalties fee
  SELECT COALESCE(value::numeric, 0) INTO v_ad_fee
    FROM financial_settings WHERE key = 'ad_royalties_fee';
  IF v_ad_fee IS NULL THEN
    v_ad_fee := 0;
  END IF;

  -- Fetch store name
  SELECT name INTO v_store FROM stores WHERE id = v_order.store_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Store not found.';
  END IF;

  -- Calculate subtotal from order items
  SELECT COALESCE(SUM(unit_price * quantity), 0) INTO v_subtotal
    FROM order_items WHERE order_id = p_order_id;

  -- Calculate tax and grand total
  -- HST applies to subtotal + ad fee
  v_tax_amount := ROUND((v_subtotal + v_ad_fee) * v_tax_rate, 2);
  v_grand_total := v_subtotal + v_ad_fee + v_tax_amount;

  -- Generate sequential invoice number with advisory lock
  v_year := EXTRACT(YEAR FROM now())::integer;
  PERFORM pg_advisory_xact_lock(hashtext('invoice_number'), v_year);

  INSERT INTO invoice_number_counters (year, counter)
    VALUES (v_year, 1)
    ON CONFLICT (year) DO UPDATE SET counter = invoice_number_counters.counter + 1
    RETURNING counter INTO v_counter;

  v_invoice_number := 'INV-' || v_year || '-' || LPAD(v_counter::text, 4, '0');

  -- Insert invoice
  -- company_name = commissary name, company_address = commissary address+postal, company_tax_id = commissary phone
  INSERT INTO invoices (
    order_id, invoice_number, store_id, store_name,
    company_name, company_address, company_tax_id,
    subtotal, tax_rate, tax_amount, ad_royalties_fee, grand_total
  ) VALUES (
    p_order_id, v_invoice_number, v_order.store_id, v_store.name,
    v_company_name, v_company_address, v_company_phone,
    v_subtotal, v_tax_rate, v_tax_amount, v_ad_fee, v_grand_total
  ) RETURNING id INTO v_invoice_id;

  -- Copy order items into invoice items
  INSERT INTO invoice_items (invoice_id, product_name, modifier, unit_price, quantity, line_total)
    SELECT v_invoice_id, product_name, modifier, unit_price, quantity,
           ROUND(unit_price * quantity, 2)
    FROM order_items WHERE order_id = p_order_id;

  RETURN v_invoice_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

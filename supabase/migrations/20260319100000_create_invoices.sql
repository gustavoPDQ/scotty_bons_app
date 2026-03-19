-- Migration: create_invoices
-- Creates invoices and invoice_items tables with immutable RLS.
-- Creates generate_invoice and fulfill_order_with_invoice SECURITY DEFINER functions.
-- Depends on: create_rls_helpers, create_financial_settings

-- ── invoices ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS invoices (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id          uuid NOT NULL UNIQUE REFERENCES orders(id),
  invoice_number    text NOT NULL UNIQUE,
  store_id          uuid NOT NULL REFERENCES stores(id),
  store_name        text NOT NULL,
  company_name      text NOT NULL,
  company_address   text NOT NULL,
  company_tax_id    text NOT NULL,
  subtotal          numeric(12,2) NOT NULL,
  tax_rate          numeric(5,4) NOT NULL,
  tax_amount        numeric(12,2) NOT NULL,
  grand_total       numeric(12,2) NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_invoices_order_id ON invoices(order_id);
CREATE INDEX idx_invoices_store_id ON invoices(store_id);

-- ── invoice_items ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS invoice_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id      uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  product_name    text NOT NULL,
  unit_of_measure text NOT NULL,
  unit_price      numeric(10,2) NOT NULL,
  quantity        integer NOT NULL,
  line_total      numeric(12,2) NOT NULL
);

CREATE INDEX idx_invoice_items_invoice_id ON invoice_items(invoice_id);

-- ── invoice_number_counters ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS invoice_number_counters (
  year    integer PRIMARY KEY,
  counter integer NOT NULL DEFAULT 0
);

-- ── RLS: invoices (immutable — no UPDATE/DELETE) ────────────────────────────

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoices_select_admin"
  ON invoices FOR SELECT
  USING (auth_role() = 'admin');

CREATE POLICY "invoices_select_store"
  ON invoices FOR SELECT
  USING (auth_role() = 'store' AND store_id = auth_store_id());

CREATE POLICY "invoices_select_factory"
  ON invoices FOR SELECT
  USING (auth_role() = 'factory');

-- ── RLS: invoice_items (immutable — no UPDATE/DELETE) ───────────────────────

ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION invoice_belongs_to_store(p_invoice_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM invoices WHERE id = p_invoice_id AND store_id = auth_store_id()
  )
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

CREATE POLICY "invoice_items_select_admin"
  ON invoice_items FOR SELECT
  USING (auth_role() = 'admin');

CREATE POLICY "invoice_items_select_store"
  ON invoice_items FOR SELECT
  USING (auth_role() = 'store' AND invoice_belongs_to_store(invoice_id));

CREATE POLICY "invoice_items_select_factory"
  ON invoice_items FOR SELECT
  USING (auth_role() = 'factory');

-- ── RLS: invoice_number_counters (no user access) ──────────────────────────

ALTER TABLE invoice_number_counters ENABLE ROW LEVEL SECURITY;

-- ── SECURITY DEFINER: fulfill_order_with_invoice ────────────────────────────

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
  v_grand_total numeric(12,2);
  v_company_name text;
  v_company_address text;
  v_company_tax_id text;
BEGIN
  -- Fetch and validate order
  SELECT id, store_id, status INTO v_order FROM orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found.';
  END IF;
  IF v_order.status != 'approved' THEN
    RAISE EXCEPTION 'Only approved orders can be fulfilled.';
  END IF;

  -- Update order status to fulfilled
  UPDATE orders
    SET status = 'fulfilled', fulfilled_at = now(), updated_at = now()
    WHERE id = p_order_id;

  -- Check if invoice already exists for this order
  IF EXISTS (SELECT 1 FROM invoices WHERE order_id = p_order_id) THEN
    SELECT id INTO v_invoice_id FROM invoices WHERE order_id = p_order_id;
    RETURN v_invoice_id;
  END IF;

  -- Fetch financial_settings
  SELECT value INTO v_company_name FROM financial_settings WHERE key = 'company_name';
  SELECT value INTO v_company_address FROM financial_settings WHERE key = 'company_address';
  SELECT value INTO v_company_tax_id FROM financial_settings WHERE key = 'company_phone';

  v_company_name := COALESCE(v_company_name, '');
  v_company_address := COALESCE(v_company_address, '');
  v_company_tax_id := COALESCE(v_company_tax_id, '');

  SELECT COALESCE(value::numeric / 100, 0) INTO v_tax_rate
    FROM financial_settings WHERE key = 'tax_rate';
  IF v_tax_rate IS NULL THEN
    v_tax_rate := 0;
  END IF;

  -- Fetch store name
  SELECT name INTO v_store FROM stores WHERE id = v_order.store_id;

  -- Calculate subtotal from order items
  SELECT COALESCE(SUM(unit_price * quantity), 0) INTO v_subtotal
    FROM order_items WHERE order_id = p_order_id;

  -- Calculate tax and grand total
  v_tax_amount := ROUND(v_subtotal * v_tax_rate, 2);
  v_grand_total := v_subtotal + v_tax_amount;

  -- Generate sequential invoice number with advisory lock
  v_year := EXTRACT(YEAR FROM now())::integer;
  PERFORM pg_advisory_xact_lock(hashtext('invoice_number'), v_year);

  INSERT INTO invoice_number_counters (year, counter)
    VALUES (v_year, 1)
    ON CONFLICT (year) DO UPDATE SET counter = invoice_number_counters.counter + 1
    RETURNING counter INTO v_counter;

  v_invoice_number := 'INV-' || v_year || '-' || LPAD(v_counter::text, 4, '0');

  -- Insert invoice
  INSERT INTO invoices (
    order_id, invoice_number, store_id, store_name,
    company_name, company_address, company_tax_id,
    subtotal, tax_rate, tax_amount, grand_total
  ) VALUES (
    p_order_id, v_invoice_number, v_order.store_id, v_store.name,
    v_company_name, v_company_address, v_company_tax_id,
    v_subtotal, v_tax_rate, v_tax_amount, v_grand_total
  ) RETURNING id INTO v_invoice_id;

  -- Copy order items into invoice items
  INSERT INTO invoice_items (invoice_id, product_name, unit_of_measure, unit_price, quantity, line_total)
    SELECT v_invoice_id, product_name, unit_of_measure, unit_price, quantity,
           ROUND(unit_price * quantity, 2)
    FROM order_items WHERE order_id = p_order_id;

  RETURN v_invoice_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

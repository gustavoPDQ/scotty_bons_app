-- Migration: rename_factory_to_commissary
-- Renames the user_role enum value 'factory' to 'commissary' and updates all
-- RLS policies that reference it. Client requested terminology change.

-- ── 1. Rename enum value ──────────────────────────────────────────────────────
ALTER TYPE user_role RENAME VALUE 'factory' TO 'commissary';

-- ── 2. Recreate RLS policies on orders ────────────────────────────────────────

DROP POLICY IF EXISTS "orders_select_factory" ON orders;
CREATE POLICY "orders_select_commissary"
  ON orders FOR SELECT
  USING (auth_role() = 'commissary' AND deleted_at IS NULL);

DROP POLICY IF EXISTS "orders_update_factory" ON orders;
CREATE POLICY "orders_update_commissary"
  ON orders FOR UPDATE
  USING (auth_role() = 'commissary' AND status = 'approved' AND deleted_at IS NULL)
  WITH CHECK (auth_role() = 'commissary' AND status = 'fulfilled');

-- ── 3. Recreate RLS policies on order_items ───────────────────────────────────

DROP POLICY IF EXISTS "order_items_select_factory" ON order_items;
CREATE POLICY "order_items_select_commissary"
  ON order_items FOR SELECT
  USING (auth_role() = 'commissary');

-- ── 4. Recreate RLS policies on order_status_history ──────────────────────────

DROP POLICY IF EXISTS "order_status_history_select_factory" ON order_status_history;
CREATE POLICY "order_status_history_select_commissary"
  ON order_status_history FOR SELECT
  USING (auth_role() = 'commissary');

DROP POLICY IF EXISTS "order_status_history_insert_factory" ON order_status_history;
CREATE POLICY "order_status_history_insert_commissary"
  ON order_status_history FOR INSERT
  WITH CHECK (auth_role() = 'commissary');

-- ── 5. Recreate RLS policies on invoices ──────────────────────────────────────

DROP POLICY IF EXISTS "invoices_select_factory" ON invoices;
CREATE POLICY "invoices_select_commissary"
  ON invoices FOR SELECT
  USING (auth_role() = 'commissary');

-- ── 6. Recreate RLS policies on invoice_items ─────────────────────────────────

DROP POLICY IF EXISTS "invoice_items_select_factory" ON invoice_items;
CREATE POLICY "invoice_items_select_commissary"
  ON invoice_items FOR SELECT
  USING (auth_role() = 'commissary');

-- ── 7. Update fulfill_order_with_invoice function ─────────────────────────────

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

  -- Fetch financial_settings
  SELECT value INTO v_company_name FROM financial_settings WHERE key = 'company_name';
  SELECT value INTO v_company_address FROM financial_settings WHERE key = 'company_address';
  SELECT value INTO v_company_tax_id FROM financial_settings WHERE key = 'company_email';

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
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Store not found.';
  END IF;

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

-- ── 8. Recreate RLS policies on audit_templates ───────────────────────────────

DROP POLICY IF EXISTS "audit_templates_factory_select" ON audit_templates;
CREATE POLICY "audit_templates_commissary_select"
  ON audit_templates FOR SELECT
  USING (auth_role() = 'commissary' AND is_active = true);

-- ── 9. Recreate RLS policies on audit_template_items ──────────────────────────

DROP POLICY IF EXISTS "audit_template_items_factory_select" ON audit_template_items;
CREATE POLICY "audit_template_items_commissary_select"
  ON audit_template_items FOR SELECT
  USING (
    auth_role() = 'commissary'
    AND EXISTS (
      SELECT 1 FROM audit_templates
      WHERE id = audit_template_items.template_id AND is_active = true
    )
  );

-- ── 10. Recreate RLS policies on audits ───────────────────────────────────────

DROP POLICY IF EXISTS "audits_factory_select" ON audits;
CREATE POLICY "audits_commissary_select"
  ON audits FOR SELECT
  USING (auth_role() = 'commissary');

-- ── 11. Recreate RLS policies on audit_responses ──────────────────────────────

DROP POLICY IF EXISTS "audit_responses_factory_select" ON audit_responses;
CREATE POLICY "audit_responses_commissary_select"
  ON audit_responses FOR SELECT
  USING (
    auth_role() = 'commissary'
    AND EXISTS (
      SELECT 1 FROM audits WHERE id = audit_responses.audit_id
    )
  );

-- ── 12. Recreate RLS policies on audit_evidence ──────────────────────────────

DROP POLICY IF EXISTS "audit_evidence_factory_select" ON audit_evidence;
CREATE POLICY "audit_evidence_commissary_select"
  ON audit_evidence FOR SELECT
  USING (
    auth_role() = 'commissary'
    AND EXISTS (
      SELECT 1 FROM audit_responses ar
      JOIN audits a ON a.id = ar.audit_id
      WHERE ar.id = audit_evidence.audit_response_id
    )
  );

-- Migration: add_store_billing_info
-- Adds billing information columns to stores table: business_name, address,
-- postal_code, phone, email. These are displayed on invoices as "Bill To" info.
-- Also adds corresponding snapshot columns to invoices table.
-- Depends on: create_stores, create_invoices, order_invoice_enhancements

-- ── 1. Add billing columns to stores ────────────────────────────────────────

ALTER TABLE stores ADD COLUMN IF NOT EXISTS business_name TEXT NOT NULL DEFAULT '';
ALTER TABLE stores ADD COLUMN IF NOT EXISTS address TEXT NOT NULL DEFAULT '';
ALTER TABLE stores ADD COLUMN IF NOT EXISTS postal_code TEXT NOT NULL DEFAULT '';
ALTER TABLE stores ADD COLUMN IF NOT EXISTS phone TEXT NOT NULL DEFAULT '';
ALTER TABLE stores ADD COLUMN IF NOT EXISTS email TEXT NOT NULL DEFAULT '';

-- ── 2. Add store billing snapshot columns to invoices ───────────────────────

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS store_business_name TEXT NOT NULL DEFAULT '';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS store_address TEXT NOT NULL DEFAULT '';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS store_postal_code TEXT NOT NULL DEFAULT '';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS store_phone TEXT NOT NULL DEFAULT '';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS store_email TEXT NOT NULL DEFAULT '';

-- ── 3. Update fulfill_order_with_invoice to snapshot store billing info ─────

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
  v_postal text;
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
  SELECT value INTO v_postal FROM financial_settings WHERE key = 'commissary_postal_code';

  v_company_name := COALESCE(v_company_name, '');
  v_company_address := COALESCE(v_company_address, '');
  v_company_phone := COALESCE(v_company_phone, '');

  -- Append postal code to address if available
  IF v_postal IS NOT NULL AND v_postal != '' THEN
    v_company_address := v_company_address || E'\n' || v_postal;
  END IF;

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

  -- Fetch store info (name + billing details)
  SELECT name, business_name, address, postal_code, phone, email
    INTO v_store FROM stores WHERE id = v_order.store_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Store not found.';
  END IF;

  -- Calculate subtotal from order items
  SELECT COALESCE(SUM(unit_price * quantity), 0) INTO v_subtotal
    FROM order_items WHERE order_id = p_order_id;

  -- Calculate tax and grand total (HST applies to subtotal + ad fee)
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

  -- Insert invoice with commissary (From) and store (Bill To) info
  INSERT INTO invoices (
    order_id, invoice_number, store_id, store_name,
    store_business_name, store_address, store_postal_code, store_phone, store_email,
    company_name, company_address, company_tax_id,
    subtotal, tax_rate, tax_amount, ad_royalties_fee, grand_total
  ) VALUES (
    p_order_id, v_invoice_number, v_order.store_id, v_store.name,
    COALESCE(v_store.business_name, ''), COALESCE(v_store.address, ''),
    COALESCE(v_store.postal_code, ''), COALESCE(v_store.phone, ''), COALESCE(v_store.email, ''),
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

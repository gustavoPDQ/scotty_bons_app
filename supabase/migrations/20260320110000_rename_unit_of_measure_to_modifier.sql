-- Migration: rename_unit_of_measure_to_modifier
-- Renames unit_of_measure column to modifier across products, order_items,
-- and invoice_items tables. Updates RPC functions that reference the column.

-- ── 1. Rename columns (idempotent — skip if already renamed) ─────────────

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'unit_of_measure'
  ) THEN
    ALTER TABLE products RENAME COLUMN unit_of_measure TO modifier;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'order_items' AND column_name = 'unit_of_measure'
  ) THEN
    ALTER TABLE order_items RENAME COLUMN unit_of_measure TO modifier;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'invoice_items' AND column_name = 'unit_of_measure'
  ) THEN
    ALTER TABLE invoice_items RENAME COLUMN unit_of_measure TO modifier;
  END IF;
END $$;

-- ── 2. Recreate create_order_with_items RPC ─────────────────────────────────

CREATE OR REPLACE FUNCTION create_order_with_items(
  p_items jsonb
)
RETURNS uuid AS $$
DECLARE
  v_order_id uuid;
  v_store_id uuid;
  v_user_id uuid;
  v_role user_role;
  v_item jsonb;
  v_product record;
  v_quantity integer;
BEGIN
  -- Auth checks
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT role, store_id INTO v_role, v_store_id
  FROM profiles WHERE user_id = v_user_id;

  IF v_role != 'store' OR v_store_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: only store users can create orders';
  END IF;

  -- Validate items
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'At least one item is required';
  END IF;

  -- Insert order
  INSERT INTO orders (store_id, submitted_by, status)
  VALUES (v_store_id, v_user_id, 'submitted')
  RETURNING id INTO v_order_id;

  -- Insert items with server-side price/name snapshot
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_quantity := (v_item->>'quantity')::integer;
    IF v_quantity IS NULL OR v_quantity <= 0 THEN
      RAISE EXCEPTION 'Quantity must be at least 1';
    END IF;

    SELECT id, name, price, modifier INTO v_product
    FROM products
    WHERE id = (v_item->>'product_id')::uuid;

    IF v_product.id IS NULL THEN
      RAISE EXCEPTION 'Product not found: %', v_item->>'product_id';
    END IF;

    INSERT INTO order_items (order_id, product_id, product_name, modifier, unit_price, quantity)
    VALUES (
      v_order_id,
      v_product.id,
      v_product.name,
      v_product.modifier,
      v_product.price,
      v_quantity
    );
  END LOOP;

  RETURN v_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ── 3. Recreate fulfill_order_with_invoice ──────────────────────────────────

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
  INSERT INTO invoice_items (invoice_id, product_name, modifier, unit_price, quantity, line_total)
    SELECT v_invoice_id, product_name, modifier, unit_price, quantity,
           ROUND(unit_price * quantity, 2)
    FROM order_items WHERE order_id = p_order_id;

  RETURN v_invoice_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Migration: create_financial_settings
-- Creates key-value table for financial/invoice configuration.
-- Admin-only access via RLS.
-- Depends on: create_rls_helpers (for auth_role())

CREATE TABLE financial_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE financial_settings ENABLE ROW LEVEL SECURITY;

-- Admin-only SELECT
CREATE POLICY "financial_settings_select_admin"
  ON financial_settings FOR SELECT
  USING (auth_role() = 'admin');

-- Admin-only INSERT (first-time save)
CREATE POLICY "financial_settings_insert_admin"
  ON financial_settings FOR INSERT
  WITH CHECK (auth_role() = 'admin');

-- Admin-only UPDATE (subsequent saves)
CREATE POLICY "financial_settings_update_admin"
  ON financial_settings FOR UPDATE
  USING (auth_role() = 'admin');

-- Migration: create_audit_templates
-- Creates audit_templates and audit_template_items tables.
-- Depends on: create_rls_helpers

-- ── audit_templates ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_templates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL UNIQUE,
  description text,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER set_audit_templates_updated_at
  BEFORE UPDATE ON audit_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ── audit_template_items ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_template_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES audit_templates(id) ON DELETE CASCADE,
  label       text NOT NULL,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_template_items_template_id ON audit_template_items(template_id);

-- ── RLS: audit_templates ────────────────────────────────────────────────────

ALTER TABLE audit_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_templates_admin_all"
  ON audit_templates FOR ALL
  USING (auth_role() = 'admin')
  WITH CHECK (auth_role() = 'admin');

CREATE POLICY "audit_templates_store_select"
  ON audit_templates FOR SELECT
  USING (auth_role() = 'store' AND is_active = true);

CREATE POLICY "audit_templates_factory_select"
  ON audit_templates FOR SELECT
  USING (auth_role() = 'factory' AND is_active = true);

-- ── RLS: audit_template_items ───────────────────────────────────────────────

ALTER TABLE audit_template_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_template_items_admin_all"
  ON audit_template_items FOR ALL
  USING (auth_role() = 'admin')
  WITH CHECK (auth_role() = 'admin');

CREATE POLICY "audit_template_items_store_select"
  ON audit_template_items FOR SELECT
  USING (
    auth_role() = 'store'
    AND EXISTS (
      SELECT 1 FROM audit_templates
      WHERE id = template_id AND is_active = true
    )
  );

CREATE POLICY "audit_template_items_factory_select"
  ON audit_template_items FOR SELECT
  USING (
    auth_role() = 'factory'
    AND EXISTS (
      SELECT 1 FROM audit_templates
      WHERE id = template_id AND is_active = true
    )
  );

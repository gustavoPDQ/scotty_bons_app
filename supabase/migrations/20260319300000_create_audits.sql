-- Migration: create_audits
-- Creates audits and audit_responses tables.
-- Depends on: create_audit_templates, create_stores, create_rls_helpers

-- ── audits ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audits (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id   uuid NOT NULL REFERENCES audit_templates(id),
  store_id      uuid NOT NULL REFERENCES stores(id),
  conducted_by  uuid NOT NULL REFERENCES auth.users(id),
  status        text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'completed')),
  score         numeric(5,2),
  notes         text,
  conducted_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_audits_template_id ON audits(template_id);
CREATE INDEX idx_audits_store_id ON audits(store_id);
CREATE INDEX idx_audits_conducted_by ON audits(conducted_by);

CREATE TRIGGER set_audits_updated_at
  BEFORE UPDATE ON audits
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ── audit_responses ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_responses (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id         uuid NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
  template_item_id uuid NOT NULL REFERENCES audit_template_items(id),
  passed           boolean NOT NULL,
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE(audit_id, template_item_id)
);

CREATE INDEX idx_audit_responses_audit_id ON audit_responses(audit_id);

-- ── RLS: audits ─────────────────────────────────────────────────────────────

ALTER TABLE audits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audits_admin_all"
  ON audits FOR ALL
  USING (auth_role() = 'admin')
  WITH CHECK (auth_role() = 'admin');

CREATE POLICY "audits_store_select"
  ON audits FOR SELECT
  USING (auth_role() = 'store' AND store_id = auth_store_id());

CREATE POLICY "audits_factory_select"
  ON audits FOR SELECT
  USING (auth_role() = 'factory');

-- ── RLS: audit_responses ────────────────────────────────────────────────────

ALTER TABLE audit_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_responses_admin_all"
  ON audit_responses FOR ALL
  USING (auth_role() = 'admin')
  WITH CHECK (auth_role() = 'admin');

CREATE POLICY "audit_responses_store_select"
  ON audit_responses FOR SELECT
  USING (
    auth_role() = 'store'
    AND EXISTS (
      SELECT 1 FROM audits
      WHERE id = audit_id AND store_id = auth_store_id()
    )
  );

CREATE POLICY "audit_responses_factory_select"
  ON audit_responses FOR SELECT
  USING (
    auth_role() = 'factory'
    AND EXISTS (
      SELECT 1 FROM audits WHERE id = audit_id
    )
  );

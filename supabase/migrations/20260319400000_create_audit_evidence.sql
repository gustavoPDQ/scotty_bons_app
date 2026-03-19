-- Migration: create_audit_evidence
-- Creates audit_evidence table and storage bucket.
-- Depends on: create_audits

-- ── audit_evidence ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_evidence (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_response_id uuid NOT NULL REFERENCES audit_responses(id) ON DELETE CASCADE,
  image_url         text NOT NULL,
  caption           text CHECK (char_length(caption) <= 200),
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_evidence_response_id ON audit_evidence(audit_response_id);

-- ── RLS: audit_evidence ─────────────────────────────────────────────────────

ALTER TABLE audit_evidence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_evidence_admin_all"
  ON audit_evidence FOR ALL
  USING (auth_role() = 'admin')
  WITH CHECK (auth_role() = 'admin');

CREATE POLICY "audit_evidence_store_select"
  ON audit_evidence FOR SELECT
  USING (
    auth_role() = 'store'
    AND EXISTS (
      SELECT 1 FROM audit_responses ar
      JOIN audits a ON a.id = ar.audit_id
      WHERE ar.id = audit_response_id AND a.store_id = auth_store_id()
    )
  );

CREATE POLICY "audit_evidence_factory_select"
  ON audit_evidence FOR SELECT
  USING (
    auth_role() = 'factory'
    AND EXISTS (
      SELECT 1 FROM audit_responses ar
      JOIN audits a ON a.id = ar.audit_id
      WHERE ar.id = audit_response_id
    )
  );

-- ── Storage: audit-evidence bucket ──────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public)
VALUES ('audit-evidence', 'audit-evidence', true)
ON CONFLICT (id) DO NOTHING;

-- Authenticated users can view files
CREATE POLICY "audit_evidence_storage_select"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'audit-evidence' AND auth.role() = 'authenticated');

-- Admin can upload / update files
CREATE POLICY "audit_evidence_storage_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'audit-evidence' AND auth_role() = 'admin');

CREATE POLICY "audit_evidence_storage_update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'audit-evidence' AND auth_role() = 'admin');

-- Admin can delete files
CREATE POLICY "audit_evidence_storage_delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'audit-evidence' AND auth_role() = 'admin');

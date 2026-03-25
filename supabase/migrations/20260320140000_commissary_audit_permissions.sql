-- Migration: commissary_audit_permissions
-- Allows commissary role to create and conduct audits (not templates).
-- Depends on: create_audits, rename_factory_to_commissary

-- ── audits: commissary can create and update ──────────────────────────────

CREATE POLICY "audits_commissary_insert"
  ON audits FOR INSERT
  WITH CHECK (auth_role() = 'commissary');

CREATE POLICY "audits_commissary_update"
  ON audits FOR UPDATE
  USING (auth_role() = 'commissary');

-- ── audit_responses: commissary can insert and update ─────────────────────

CREATE POLICY "audit_responses_commissary_insert"
  ON audit_responses FOR INSERT
  WITH CHECK (
    auth_role() = 'commissary'
    AND EXISTS (
      SELECT 1 FROM audits WHERE id = audit_id
    )
  );

CREATE POLICY "audit_responses_commissary_update"
  ON audit_responses FOR UPDATE
  USING (
    auth_role() = 'commissary'
    AND EXISTS (
      SELECT 1 FROM audits WHERE id = audit_id
    )
  );

-- ── audit_evidence: commissary can insert (upload photos) ─────────────────

CREATE POLICY "audit_evidence_commissary_insert"
  ON audit_evidence FOR INSERT
  WITH CHECK (
    auth_role() = 'commissary'
    AND EXISTS (
      SELECT 1 FROM audit_responses ar
      JOIN audits a ON a.id = ar.audit_id
      WHERE ar.id = audit_response_id
    )
  );

CREATE POLICY "audit_evidence_commissary_delete"
  ON audit_evidence FOR DELETE
  USING (
    auth_role() = 'commissary'
    AND EXISTS (
      SELECT 1 FROM audit_responses ar
      JOIN audits a ON a.id = ar.audit_id
      WHERE ar.id = audit_response_id
    )
  );

-- ── storage: commissary can upload/delete evidence files ──────────────────

CREATE POLICY "audit_evidence_storage_commissary_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'audit-evidence' AND auth_role() = 'commissary');

CREATE POLICY "audit_evidence_storage_commissary_update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'audit-evidence' AND auth_role() = 'commissary');

CREATE POLICY "audit_evidence_storage_commissary_delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'audit-evidence' AND auth_role() = 'commissary');

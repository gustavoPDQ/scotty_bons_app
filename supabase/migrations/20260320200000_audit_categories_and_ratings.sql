-- =============================================================
-- Migration: Add categories to audit template items + 3-level ratings
-- =============================================================

-- 1. Create audit_template_categories table
CREATE TABLE audit_template_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES audit_templates(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_template_categories_template ON audit_template_categories(template_id);

-- 2. RLS for audit_template_categories (mirrors audit_template_items policies)
ALTER TABLE audit_template_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on audit_template_categories"
  ON audit_template_categories FOR ALL
  USING (public.auth_role() = 'admin')
  WITH CHECK (public.auth_role() = 'admin');

CREATE POLICY "Store can view categories of active templates"
  ON audit_template_categories FOR SELECT
  USING (
    public.auth_role() = 'store'
    AND EXISTS (
      SELECT 1 FROM audit_templates t
      WHERE t.id = audit_template_categories.template_id AND t.is_active = true
    )
  );

CREATE POLICY "Commissary can view categories of active templates"
  ON audit_template_categories FOR SELECT
  USING (
    public.auth_role() = 'commissary'
    AND EXISTS (
      SELECT 1 FROM audit_templates t
      WHERE t.id = audit_template_categories.template_id AND t.is_active = true
    )
  );

-- 3. Migrate existing items: create a default "General" category for each template that has items
INSERT INTO audit_template_categories (template_id, name, sort_order)
SELECT DISTINCT template_id, 'General', 0
FROM audit_template_items;

-- 4. Add category_id column to audit_template_items
ALTER TABLE audit_template_items
  ADD COLUMN category_id uuid REFERENCES audit_template_categories(id) ON DELETE CASCADE;

-- Populate category_id for existing items (assign to the "General" category of their template)
UPDATE audit_template_items AS ati
SET category_id = atc.id
FROM audit_template_categories AS atc
WHERE atc.template_id = ati.template_id
  AND atc.name = 'General';

-- Make it NOT NULL now that all rows are populated
ALTER TABLE audit_template_items
  ALTER COLUMN category_id SET NOT NULL;

-- 5. Replace boolean passed with text rating in audit_responses
ALTER TABLE audit_responses
  ADD COLUMN rating text;

-- Migrate existing data
UPDATE audit_responses
SET rating = CASE WHEN passed THEN 'good' ELSE 'poor' END;

-- Add constraint and make NOT NULL
ALTER TABLE audit_responses
  ALTER COLUMN rating SET NOT NULL;

ALTER TABLE audit_responses
  ADD CONSTRAINT audit_responses_rating_check
  CHECK (rating IN ('poor', 'satisfactory', 'good'));

-- Drop old passed column
ALTER TABLE audit_responses
  DROP COLUMN passed;

-- 6. Drop status column — use conducted_at to determine completion
ALTER TABLE audits DROP COLUMN status;

-- 7. Add optional description to audit template items
ALTER TABLE audit_template_items
  ADD COLUMN description text CHECK (char_length(description) <= 1000);

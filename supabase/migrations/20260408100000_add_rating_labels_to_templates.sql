-- Add customizable rating options per audit template.
-- Format: array of {key, label, weight} objects.
-- Weights are 0-1 and used for score calculation.

-- 1. Add rating_labels column as array format
ALTER TABLE audit_templates
  ADD COLUMN rating_labels jsonb NOT NULL DEFAULT '[{"key":"poor","label":"Poor","weight":0},{"key":"satisfactory","label":"Satisfactory","weight":0.5},{"key":"good","label":"Good","weight":1}]'::jsonb;

-- 2. Drop the fixed CHECK constraint on audit_responses.rating
--    so templates can define any set of rating keys.
ALTER TABLE audit_responses
  DROP CONSTRAINT audit_responses_rating_check;

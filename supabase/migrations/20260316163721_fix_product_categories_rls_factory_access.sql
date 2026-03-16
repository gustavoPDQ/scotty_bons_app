-- Migration: fix_product_categories_rls_factory_access
-- Fixes FR16 violation: Factory Users must NOT have catalog access.
-- Replaces permissive SELECT policy with role-restricted policy.

-- Drop the overly permissive policy that allowed all authenticated users
DROP POLICY IF EXISTS "product_categories_select_authenticated" ON product_categories;

-- Create replacement policy: only Admin and Store users can read categories
CREATE POLICY "product_categories_select_admin_store"
  ON product_categories FOR SELECT
  USING (auth_role() IN ('admin', 'store'));

-- Migration: allow_commissary_read_profiles
-- Commissary users need to see profile names in order status history.
-- Extends the existing profiles SELECT policy to include commissary role.

DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON profiles;

CREATE POLICY "profiles_select_own_or_admin_or_commissary"
  ON profiles FOR SELECT
  USING (auth.uid() = user_id OR auth_role() IN ('admin', 'commissary'));

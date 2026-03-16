-- Migration: add_rls_policies_stores_and_profiles
-- Enables RLS and creates policies on the foundation tables: profiles, stores.
-- Depends on: create_rls_helpers (auth_role(), auth_store_id() must exist first)
--
-- ARCHITECTURE RULE: All policies use auth_role() / auth_store_id() — never inline subqueries (D5).
-- ARCHITECTURE RULE: service_role key is never used in app code — RLS enforces access.

-- ── stores ──────────────────────────────────────────────────────────────────

ALTER TABLE stores ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read stores (needed to populate store selects in UI)
CREATE POLICY "stores_select_authenticated"
  ON stores FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Only Admins can create, modify, or delete stores
CREATE POLICY "stores_insert_admin"
  ON stores FOR INSERT
  WITH CHECK (auth_role() = 'admin');

CREATE POLICY "stores_update_admin"
  ON stores FOR UPDATE
  USING (auth_role() = 'admin')
  WITH CHECK (auth_role() = 'admin');

CREATE POLICY "stores_delete_admin"
  ON stores FOR DELETE
  USING (auth_role() = 'admin');

-- ── profiles ─────────────────────────────────────────────────────────────────

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Authenticated users see only their own profile row; Admins see all rows
CREATE POLICY "profiles_select_own_or_admin"
  ON profiles FOR SELECT
  USING (auth.uid() = user_id OR auth_role() = 'admin');

-- Only Admins can manually insert profiles (the handle_new_user() trigger inserts
-- with SECURITY DEFINER so it bypasses RLS — but explicit admin INSERT policy for defense-in-depth)
CREATE POLICY "profiles_insert_admin"
  ON profiles FOR INSERT
  WITH CHECK (auth_role() = 'admin');

-- Only Admins can update roles or store assignments
CREATE POLICY "profiles_update_admin"
  ON profiles FOR UPDATE
  USING (auth_role() = 'admin')
  WITH CHECK (auth_role() = 'admin');

-- Only Admins can delete profiles (ON DELETE CASCADE from auth.users also handles deletions)
CREATE POLICY "profiles_delete_admin"
  ON profiles FOR DELETE
  USING (auth_role() = 'admin');

-- Migration: email_helpers_exclude_banned
-- Exclude banned (deactivated) users from email helper functions
-- so they don't receive notifications.

CREATE OR REPLACE FUNCTION get_emails_by_role(p_role text)
RETURNS TABLE(email text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_role NOT IN ('admin', 'store', 'commissary') THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT au.email::text
  FROM auth.users au
  JOIN profiles p ON p.user_id = au.id
  WHERE p.role = p_role::user_role
    AND (au.banned_until IS NULL OR au.banned_until <= now());
END;
$$;

CREATE OR REPLACE FUNCTION get_user_email(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_email text;
BEGIN
  SELECT au.email::text INTO v_email
  FROM auth.users au
  JOIN profiles p ON p.user_id = au.id
  WHERE au.id = p_user_id
    AND (au.banned_until IS NULL OR au.banned_until <= now());
  RETURN v_email;
END;
$$;

CREATE OR REPLACE FUNCTION get_store_user_emails(p_store_id uuid)
RETURNS TABLE(email text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT au.email::text
  FROM auth.users au
  JOIN profiles p ON p.user_id = au.id
  WHERE p.role = 'store'::user_role
    AND p.store_id = p_store_id
    AND (au.banned_until IS NULL OR au.banned_until <= now());
END;
$$;

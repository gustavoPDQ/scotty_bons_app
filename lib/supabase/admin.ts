import { createClient } from "@supabase/supabase-js";

/**
 * Admin Supabase client using service_role key.
 * ONLY use in Server Actions and Server Components — NEVER in Client Components.
 * Required for: Supabase Auth Admin API (createUser, listUsers, deleteUser, etc.)
 * Security: service_role bypasses RLS — always verify caller is admin before use.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

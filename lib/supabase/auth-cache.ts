import { cache } from "react";
import { createClient } from "./server";

/**
 * Request-scoped cached auth helpers.
 *
 * React `cache()` deduplicates calls within a single RSC request.
 * The layout calls getUser() + getProfile(), and every child page
 * that calls the same functions gets the cached result — zero extra
 * Supabase roundtrips.
 */

export const getUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export const getProfile = cache(async () => {
  const user = await getUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, store_id")
    .eq("user_id", user.id)
    .single();

  return profile;
});

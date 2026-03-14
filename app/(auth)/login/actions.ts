"use server";

import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/types";

export async function signIn(
  email: string,
  password: string
): Promise<ActionResult<{ redirectTo: string }>> {
  const supabase = await createClient();

  const { data: authData, error: authError } =
    await supabase.auth.signInWithPassword({
      email,
      password,
    });

  if (authError || !authData.user) {
    return { data: null, error: "Incorrect email or password" };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", authData.user.id)
    .single();

  const redirectTo = profile?.role === "admin" ? "/dashboard" : "/orders";
  return { data: { redirectTo }, error: null };
}

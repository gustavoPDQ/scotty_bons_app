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

  return { data: { redirectTo: "/dashboard" }, error: null };
}

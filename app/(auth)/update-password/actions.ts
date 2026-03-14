"use server";

import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/types";

export async function updatePassword(
  password: string
): Promise<ActionResult<null>> {
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return { data: null, error: "Unable to reset password. Please try again." };
  }

  return { data: null, error: null };
}

"use server";

import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/types";

export async function updatePassword(
  password: string
): Promise<ActionResult<null>> {
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return { data: null, error: "Não foi possível redefinir a senha. Tente novamente." };
  }

  return { data: null, error: null };
}

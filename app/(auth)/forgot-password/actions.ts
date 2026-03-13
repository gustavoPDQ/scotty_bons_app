"use server";

import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";
import type { ActionResult } from "@/lib/types";

export async function requestPasswordReset(
  email: string
): Promise<ActionResult<null>> {
  const supabase = await createClient();
  const headersList = await headers();
  const host = headersList.get("host") ?? "localhost:3000";
  const protocol = host.includes("localhost") ? "http" : "https";
  const origin = `${protocol}://${host}`;

  // Fire and forget — intentionally ignore all errors (no email enumeration)
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/confirm?next=/update-password`,
  });

  // ALWAYS return success — never reveal whether email is registered
  return { data: null, error: null };
}

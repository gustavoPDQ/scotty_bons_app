"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { headers } from "next/headers";
import type { ActionResult } from "@/lib/types";

export async function requestPasswordReset(
  email: string
): Promise<ActionResult<null>> {
  // Look up user by email to check role — only admins can reset their own password
  const adminClient = createAdminClient();
  const { data: userList } = await adminClient.auth.admin.listUsers();
  const matchedUser = userList?.users.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase()
  );

  if (matchedUser) {
    const { data: profile } = await adminClient
      .from("profiles")
      .select("role")
      .eq("user_id", matchedUser.id)
      .single();

    if (profile && profile.role !== "admin") {
      return {
        data: null,
        error: "Only administrators can reset their password. Please contact an admin to have your password reset.",
      };
    }
  }

  const supabase = await createClient();
  const headersList = await headers();
  const host = headersList.get("host") ?? "localhost:3000";
  const protocol = host.includes("localhost") ? "http" : "https";
  const origin = `${protocol}://${host}`;

  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/confirm?next=/update-password`,
  });

  return { data: null, error: null };
}

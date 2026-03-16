"use server";

import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/types";

export async function changePassword(
  currentPassword: string,
  newPassword: string
): Promise<ActionResult<null>> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    return { data: null, error: "Not authenticated." };
  }

  // Verify current password via re-authentication
  const { error: authError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (authError) {
    return { data: null, error: "Incorrect current password." };
  }

  // Update password
  const { error: updateError } = await supabase.auth.updateUser({
    password: newPassword,
  });
  if (updateError) {
    return { data: null, error: "Failed to update password. Please try again." };
  }

  return { data: null, error: null };
}

export async function changeEmail(
  newEmail: string
): Promise<ActionResult<null>> {
  const supabase = await createClient();

  const { error } = await supabase.auth.updateUser({ email: newEmail });

  if (error) {
    if (
      error.message?.toLowerCase().includes("already registered") ||
      error.message?.toLowerCase().includes("email address is already") ||
      error.code === "email_exists"
    ) {
      return { data: null, error: "This email address is already in use." };
    }
    return { data: null, error: "Failed to update email. Please try again." };
  }

  return { data: null, error: null };
}

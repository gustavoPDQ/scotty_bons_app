"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/types";
import {
  financialSettingsSchema,
  type FinancialSettingsValues,
} from "@/lib/validations/settings";

async function verifyAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  return profile?.role === "admin" ? supabase : null;
}

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

export async function getFinancialSettings(): Promise<
  ActionResult<Record<string, string>>
> {
  const supabase = await verifyAdmin();
  if (!supabase) return { data: null, error: "Unauthorized." };

  const { data, error } = await supabase
    .from("financial_settings")
    .select("key, value");

  if (error) {
    return { data: null, error: "Failed to load financial settings." };
  }

  const settings: Record<string, string> = {};
  for (const row of data ?? []) {
    settings[row.key] = row.value;
  }

  return { data: settings, error: null };
}

export async function saveFinancialSettings(
  values: FinancialSettingsValues,
): Promise<ActionResult<null>> {
  const parsed = financialSettingsSchema.safeParse(values);
  if (!parsed.success) {
    return {
      data: null,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const supabase = await verifyAdmin();
  if (!supabase) return { data: null, error: "Unauthorized." };

  const rows = Object.entries({
    tax_rate: String(parsed.data.tax_rate),
    currency: parsed.data.currency,
    payment_terms: parsed.data.payment_terms ?? "",
    company_name: parsed.data.company_name ?? "",
    company_address: parsed.data.company_address ?? "",
    company_phone: parsed.data.company_phone ?? "",
    company_email: parsed.data.company_email ?? "",
  }).map(([key, value]) => ({
    key,
    value,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from("financial_settings")
    .upsert(rows, { onConflict: "key" });

  if (error) {
    return {
      data: null,
      error: "Failed to save financial settings. Please try again.",
    };
  }

  revalidatePath("/settings");
  return { data: null, error: null };
}

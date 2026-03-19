"use server";

import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/types";
import {
  createAuditSchema,
  saveResponseSchema,
  completeAuditSchema,
  type CreateAuditValues,
  type SaveResponseValues,
  type CompleteAuditValues,
} from "@/lib/validations/audits";

/** Verifies the current session belongs to an admin. Returns the supabase client and user id, or null. */
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

  return profile?.role === "admin" ? { supabase, userId: user.id } : null;
}

export async function createAudit(
  values: CreateAuditValues
): Promise<ActionResult<{ id: string }>> {
  const parsed = createAuditSchema.safeParse(values);
  if (!parsed.success) {
    return { data: null, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const auth = await verifyAdmin();
  if (!auth) return { data: null, error: "Unauthorized." };

  const { data, error } = await auth.supabase
    .from("audits")
    .insert({
      template_id: parsed.data.template_id,
      store_id: parsed.data.store_id,
      conducted_by: auth.userId,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23503") {
      return { data: null, error: "Invalid template or store." };
    }
    return { data: null, error: "Failed to create audit. Please try again." };
  }

  return { data: { id: data.id }, error: null };
}

export async function saveAuditResponse(
  values: SaveResponseValues
): Promise<ActionResult<{ id: string }>> {
  const parsed = saveResponseSchema.safeParse(values);
  if (!parsed.success) {
    return { data: null, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const auth = await verifyAdmin();
  if (!auth) return { data: null, error: "Unauthorized." };

  // Upsert response on conflict (audit_id, template_item_id)
  const { data, error } = await auth.supabase
    .from("audit_responses")
    .upsert(
      {
        audit_id: parsed.data.audit_id,
        template_item_id: parsed.data.template_item_id,
        passed: parsed.data.passed,
        notes: parsed.data.notes ?? null,
      },
      { onConflict: "audit_id,template_item_id" }
    )
    .select("id")
    .single();

  if (error) {
    return { data: null, error: "Failed to save response. Please try again." };
  }

  return { data: { id: data.id }, error: null };
}

export async function completeAudit(
  values: CompleteAuditValues
): Promise<ActionResult<{ score: number }>> {
  const parsed = completeAuditSchema.safeParse(values);
  if (!parsed.success) {
    return { data: null, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const auth = await verifyAdmin();
  if (!auth) return { data: null, error: "Unauthorized." };

  // Fetch audit to get template_id
  const { data: audit } = await auth.supabase
    .from("audits")
    .select("id, template_id, status")
    .eq("id", parsed.data.audit_id)
    .single();

  if (!audit) return { data: null, error: "Audit not found." };
  if (audit.status === "completed") {
    return { data: null, error: "Audit is already completed." };
  }

  // Count total template items
  const { count: totalItems } = await auth.supabase
    .from("audit_template_items")
    .select("id", { count: "exact", head: true })
    .eq("template_id", audit.template_id);

  // Count responses
  const { count: responseCount } = await auth.supabase
    .from("audit_responses")
    .select("id", { count: "exact", head: true })
    .eq("audit_id", audit.id);

  if (
    totalItems === null ||
    responseCount === null ||
    responseCount < totalItems
  ) {
    return {
      data: null,
      error: "All checklist items must be answered before completing the audit.",
    };
  }

  // Compute score: % of passed items
  const { count: passedCount } = await auth.supabase
    .from("audit_responses")
    .select("id", { count: "exact", head: true })
    .eq("audit_id", audit.id)
    .eq("passed", true);

  const score =
    totalItems > 0 ? Math.round(((passedCount ?? 0) / totalItems) * 10000) / 100 : 0;

  const { error } = await auth.supabase
    .from("audits")
    .update({
      status: "completed",
      score,
      notes: parsed.data.notes ?? null,
      conducted_at: new Date().toISOString(),
    })
    .eq("id", audit.id);

  if (error) {
    return { data: null, error: "Failed to complete audit. Please try again." };
  }

  return { data: { score }, error: null };
}

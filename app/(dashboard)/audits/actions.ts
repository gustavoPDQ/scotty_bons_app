"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";
import type { ActionResult } from "@/lib/types";
import {
  createAuditSchema,
  saveResponseSchema,
  completeAuditSchema,
  type CreateAuditValues,
  type SaveResponseValues,
  type CompleteAuditValues,
} from "@/lib/validations/audits";
import { notifyAuditCompleted } from "@/lib/email/audit-notifications";

/** Verifies the current session belongs to an admin. Returns the supabase client, or null. */
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

  if (profile?.role !== "admin") return null;
  return supabase;
}

/** Verifies the current session belongs to an admin or commissary. Returns the supabase client and user id, or null. */
async function verifyAdminOrCommissary() {
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

  if (profile?.role !== "admin" && profile?.role !== "commissary") return null;
  return { supabase, userId: user.id };
}

export async function createAudit(
  values: CreateAuditValues
): Promise<ActionResult<{ id: string }>> {
  const parsed = createAuditSchema.safeParse(values);
  if (!parsed.success) {
    return { data: null, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const auth = await verifyAdminOrCommissary();
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

  revalidatePath("/audits");
  return { data: { id: data.id }, error: null };
}

export async function saveAuditResponse(
  values: SaveResponseValues
): Promise<ActionResult<{ id: string }>> {
  const parsed = saveResponseSchema.safeParse(values);
  if (!parsed.success) {
    return { data: null, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const auth = await verifyAdminOrCommissary();
  if (!auth) return { data: null, error: "Unauthorized." };

  // Upsert response on conflict (audit_id, template_item_id)
  const { data, error } = await auth.supabase
    .from("audit_responses")
    .upsert(
      {
        audit_id: parsed.data.audit_id,
        template_item_id: parsed.data.template_item_id,
        rating: parsed.data.rating,
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

  const auth = await verifyAdminOrCommissary();
  if (!auth) return { data: null, error: "Unauthorized." };

  // Fetch audit to get template_id
  const { data: audit } = await auth.supabase
    .from("audits")
    .select("id, template_id, store_id, conducted_at")
    .eq("id", parsed.data.audit_id)
    .single();

  if (!audit) return { data: null, error: "Audit not found." };
  if (audit.conducted_at) {
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

  // Compute weighted score: poor=0, satisfactory=0.5, good=1
  const { data: allResponses } = await auth.supabase
    .from("audit_responses")
    .select("rating")
    .eq("audit_id", audit.id);

  const ratingWeights: Record<string, number> = { poor: 0, satisfactory: 0.5, good: 1 };
  const sumWeights = (allResponses ?? []).reduce(
    (sum, r) => sum + (ratingWeights[r.rating] ?? 0),
    0
  );
  const score =
    totalItems > 0 ? Math.round((sumWeights / totalItems) * 10000) / 100 : 0;

  const { error } = await auth.supabase
    .from("audits")
    .update({
      score,
      notes: parsed.data.notes ?? null,
      conducted_at: new Date().toISOString(),
    })
    .eq("id", audit.id)
    .is("conducted_at", null);

  if (error) {
    return { data: null, error: "Failed to complete audit. Please try again." };
  }

  revalidatePath("/audits");
  revalidatePath(`/audits/${audit.id}`);

  // Notify store users and admins about completed audit
  try {
    const adminClient = createAdminClient();
    const [{ data: storeData }, { data: templateData }, conductorResult] = await Promise.all([
      auth.supabase.from("stores").select("name").eq("id", audit.store_id).single(),
      auth.supabase.from("audit_templates").select("name").eq("id", audit.template_id).single(),
      adminClient.auth.admin.getUserById(auth.userId),
    ]);
    const conductorUser = conductorResult.data?.user;
    const conductorName =
      (conductorUser?.user_metadata?.name as string | undefined) ??
      conductorUser?.email ??
      "Unknown";
    // Fetch categories, items, and responses for PDF attachment
    const [{ data: cats }, { data: tplItems }, { data: responses }] = await Promise.all([
      auth.supabase.from("audit_template_categories").select("id, name, sort_order").eq("template_id", audit.template_id).order("sort_order"),
      auth.supabase.from("audit_template_items").select("id, category_id, label, sort_order").eq("template_id", audit.template_id).order("sort_order"),
      auth.supabase.from("audit_responses").select("template_item_id, rating, notes").eq("audit_id", audit.id),
    ]);

    const responseMap: Record<string, { rating: string; notes: string | null }> = {};
    for (const r of responses ?? []) {
      responseMap[r.template_item_id] = { rating: r.rating, notes: r.notes };
    }

    const pdfCategories = (cats ?? []).map((cat) => ({
      name: cat.name,
      items: (tplItems ?? [])
        .filter((i) => i.category_id === cat.id)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((i) => ({
          label: i.label,
          rating: (responseMap[i.id]?.rating as import("@/lib/types").AuditRating) ?? null,
          notes: responseMap[i.id]?.notes ?? null,
        })),
    }));

    await notifyAuditCompleted({
      auditId: audit.id,
      storeId: audit.store_id,
      storeName: storeData?.name ?? "Unknown Store",
      templateName: templateData?.name ?? "Audit",
      score,
      conductorName,
      auditData: { score, conducted_at: new Date().toISOString(), notes: parsed.data.notes ?? null },
      categories: pdfCategories,
    });
  } catch (e) {
    console.error("[email] Failed to notify audit completed:", e);
  }

  return { data: { score }, error: null };
}

const idSchema = z.string().uuid("Invalid ID.");

export async function deleteAudit(
  auditId: string
): Promise<ActionResult<null>> {
  const idParsed = idSchema.safeParse(auditId);
  if (!idParsed.success) return { data: null, error: "Invalid audit ID." };

  const supabase = await verifyAdmin();
  if (!supabase) return { data: null, error: "Unauthorized." };

  // Delete evidence files from storage
  const { data: evidence } = await supabase
    .from("audit_evidence")
    .select("image_url")
    .in(
      "audit_response_id",
      (await supabase.from("audit_responses").select("id").eq("audit_id", auditId)).data?.map((r) => r.id) ?? []
    );

  if (evidence && evidence.length > 0) {
    const paths = evidence
      .map((e) => {
        const idx = e.image_url.indexOf("/audit-evidence/");
        return idx !== -1 ? e.image_url.substring(idx + "/audit-evidence/".length) : null;
      })
      .filter(Boolean) as string[];
    if (paths.length > 0) {
      await supabase.storage.from("audit-evidence").remove(paths);
    }
  }

  // Delete audit (CASCADE will remove responses and evidence records)
  const { error } = await supabase
    .from("audits")
    .delete()
    .eq("id", auditId);

  if (error) {
    return { data: null, error: "Failed to delete audit. Please try again." };
  }

  revalidatePath("/audits");
  return { data: null, error: null };
}

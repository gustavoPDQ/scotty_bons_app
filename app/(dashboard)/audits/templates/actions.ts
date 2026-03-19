"use server";

import { createClient } from "@/lib/supabase/server";
import type { ActionResult, AuditTemplateRow } from "@/lib/types";
import { z } from "zod";
import {
  createTemplateSchema,
  type CreateTemplateValues,
  type UpdateTemplateValues,
} from "@/lib/validations/audit-templates";

/** Verifies the current session belongs to an admin. Returns the supabase client or null. */
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

const idSchema = z.string().uuid("Invalid ID.");

export async function createTemplate(
  values: CreateTemplateValues
): Promise<ActionResult<AuditTemplateRow | null>> {
  const parsed = createTemplateSchema.safeParse(values);
  if (!parsed.success) {
    return { data: null, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await verifyAdmin();
  if (!supabase) return { data: null, error: "Unauthorized." };

  const { data: template, error } = await supabase
    .from("audit_templates")
    .insert({
      name: parsed.data.name,
      description: parsed.data.description ?? null,
    })
    .select("id, name, description, is_active, created_at, updated_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { data: null, error: "A template with this name already exists." };
    }
    return { data: null, error: "Failed to create template. Please try again." };
  }

  // Insert items
  const items = parsed.data.items.map((item, index) => ({
    template_id: template.id,
    label: item.label,
    sort_order: index,
  }));

  const { error: itemsError } = await supabase
    .from("audit_template_items")
    .insert(items);

  if (itemsError) {
    // Clean up template if items failed
    await supabase.from("audit_templates").delete().eq("id", template.id);
    return { data: null, error: "Failed to create template items. Please try again." };
  }

  return {
    data: {
      ...template,
      item_count: parsed.data.items.length,
    } as AuditTemplateRow,
    error: null,
  };
}

export async function updateTemplate(
  templateId: string,
  values: UpdateTemplateValues
): Promise<ActionResult<null>> {
  const idParsed = idSchema.safeParse(templateId);
  if (!idParsed.success) return { data: null, error: "Invalid template ID." };

  const parsed = createTemplateSchema.safeParse(values);
  if (!parsed.success) {
    return { data: null, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await verifyAdmin();
  if (!supabase) return { data: null, error: "Unauthorized." };

  const { error } = await supabase
    .from("audit_templates")
    .update({
      name: parsed.data.name,
      description: parsed.data.description ?? null,
    })
    .eq("id", templateId)
    .select("id")
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return { data: null, error: "Template not found." };
    }
    if (error.code === "23505") {
      return { data: null, error: "A template with this name already exists." };
    }
    return { data: null, error: "Failed to update template. Please try again." };
  }

  // Delete old items, insert new ones
  await supabase
    .from("audit_template_items")
    .delete()
    .eq("template_id", templateId);

  const items = parsed.data.items.map((item, index) => ({
    template_id: templateId,
    label: item.label,
    sort_order: index,
  }));

  const { error: itemsError } = await supabase
    .from("audit_template_items")
    .insert(items);

  if (itemsError) {
    return { data: null, error: "Failed to update template items. Please try again." };
  }

  return { data: null, error: null };
}

export async function toggleTemplateActive(
  templateId: string,
  isActive: boolean
): Promise<ActionResult<null>> {
  const idParsed = idSchema.safeParse(templateId);
  if (!idParsed.success) return { data: null, error: "Invalid template ID." };

  const supabase = await verifyAdmin();
  if (!supabase) return { data: null, error: "Unauthorized." };

  const { error } = await supabase
    .from("audit_templates")
    .update({ is_active: isActive })
    .eq("id", templateId);

  if (error) return { data: null, error: "Failed to update template status." };
  return { data: null, error: null };
}

export async function deleteTemplate(
  templateId: string
): Promise<ActionResult<null>> {
  const idParsed = idSchema.safeParse(templateId);
  if (!idParsed.success) return { data: null, error: "Invalid template ID." };

  const supabase = await verifyAdmin();
  if (!supabase) return { data: null, error: "Unauthorized." };

  // Check for audits using this template
  const { count, error: countError } = await supabase
    .from("audits")
    .select("id", { count: "exact", head: true })
    .eq("template_id", templateId);

  if (countError) {
    // 42P01 = undefined_table — audits table doesn't exist yet, safe to proceed
    if (countError.code !== "42P01") {
      return { data: null, error: "Failed to check template usage. Please try again." };
    }
  } else if (count !== null && count > 0) {
    return {
      data: null,
      error: "This template has audits. You cannot delete a template with existing audits.",
    };
  }

  const { error } = await supabase
    .from("audit_templates")
    .delete()
    .eq("id", templateId);

  if (error) return { data: null, error: "Failed to delete template. Please try again." };
  return { data: null, error: null };
}

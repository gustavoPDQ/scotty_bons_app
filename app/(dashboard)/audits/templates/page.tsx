import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { AuditTemplateRow, AuditTemplateCategoryRow, AuditTemplateItemRow } from "@/lib/types";
import { TemplatesClient } from "@/components/audits/templates-client";

export default async function AuditTemplatesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (!profile || profile.role !== "admin") redirect("/orders");

  // Fetch templates
  const { data: templatesRaw } = await supabase
    .from("audit_templates")
    .select("id, name, description, is_active, created_at, updated_at")
    .order("created_at", { ascending: false });

  const templates: AuditTemplateRow[] = [];
  const templateIds = (templatesRaw ?? []).map((t) => t.id);

  // Fetch item counts
  const itemCounts: Record<string, number> = {};
  if (templateIds.length > 0) {
    const { data: items } = await supabase
      .from("audit_template_items")
      .select("id, template_id")
      .in("template_id", templateIds);

    if (items) {
      for (const item of items) {
        itemCounts[item.template_id] = (itemCounts[item.template_id] ?? 0) + 1;
      }
    }
  }

  for (const t of templatesRaw ?? []) {
    templates.push({
      ...(t as Omit<AuditTemplateRow, "item_count">),
      item_count: itemCounts[t.id] ?? 0,
    });
  }

  // Fetch all categories and items for editing
  let allCategories: AuditTemplateCategoryRow[] = [];
  let allItems: AuditTemplateItemRow[] = [];
  if (templateIds.length > 0) {
    const [{ data: categoriesData }, { data: itemsData }] = await Promise.all([
      supabase
        .from("audit_template_categories")
        .select("id, template_id, name, sort_order, created_at")
        .in("template_id", templateIds)
        .order("sort_order"),
      supabase
        .from("audit_template_items")
        .select("id, template_id, category_id, label, description, sort_order, created_at")
        .in("template_id", templateIds)
        .order("sort_order"),
    ]);
    allCategories = (categoriesData ?? []) as AuditTemplateCategoryRow[];
    allItems = (itemsData ?? []) as AuditTemplateItemRow[];
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <TemplatesClient templates={templates} allCategories={allCategories} allItems={allItems} />
    </div>
  );
}

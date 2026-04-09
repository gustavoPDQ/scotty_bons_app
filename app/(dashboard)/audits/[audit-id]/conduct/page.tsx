import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getUser, getProfile } from "@/lib/supabase/auth-cache";
import type {
  AuditTemplateCategoryRow,
  AuditTemplateItemRow,
  AuditResponseRow,
  AuditEvidenceRow,
  RatingOption,
} from "@/lib/types";
import { DEFAULT_RATING_OPTIONS } from "@/lib/types";
import { AuditChecklist } from "@/components/audits/audit-checklist";

export default async function ConductAuditPage({
  params,
}: {
  params: Promise<{ "audit-id": string }>;
}) {
  const { "audit-id": auditId } = await params;

  const user = await getUser();
  if (!user) redirect("/login");

  const profile = await getProfile();
  if (!profile || (profile.role !== "admin" && profile.role !== "commissary")) redirect("/audits");

  const supabase = await createClient();

  // Fetch audit
  const { data: audit } = await supabase
    .from("audits")
    .select("id, template_id, store_id, conducted_at")
    .eq("id", auditId)
    .single();

  if (!audit) redirect("/audits");
  if (audit.conducted_at) redirect(`/audits/${auditId}`);

  // Fetch related data in parallel
  const [
    { data: store },
    { data: template },
    { data: templateCategories },
    { data: templateItems },
    { data: responses },
  ] = await Promise.all([
    supabase.from("stores").select("name").eq("id", audit.store_id).single(),
    supabase.from("audit_templates").select("name, rating_labels").eq("id", audit.template_id).single(),
    supabase
      .from("audit_template_categories")
      .select("id, template_id, name, sort_order, created_at")
      .eq("template_id", audit.template_id)
      .order("sort_order"),
    supabase
      .from("audit_template_items")
      .select("id, template_id, category_id, label, description, sort_order, created_at")
      .eq("template_id", audit.template_id)
      .order("sort_order"),
    supabase
      .from("audit_responses")
      .select("id, audit_id, template_item_id, rating, notes")
      .eq("audit_id", auditId),
  ]);

  const categories = (templateCategories ?? []) as AuditTemplateCategoryRow[];
  const items = (templateItems ?? []) as AuditTemplateItemRow[];
  const responseList = (responses ?? []) as AuditResponseRow[];

  // Fetch evidence for all responses
  const responseIds = responseList.map((r) => r.id);
  let evidenceList: AuditEvidenceRow[] = [];
  if (responseIds.length > 0) {
    const { data: evidenceData } = await supabase
      .from("audit_evidence")
      .select("id, audit_response_id, image_url, caption, created_at")
      .in("audit_response_id", responseIds);
    evidenceList = (evidenceData ?? []) as AuditEvidenceRow[];
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="text-sm flex items-center gap-1.5">
        <Link
          href="/audits"
          className="text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
        >
          <ArrowLeft className="size-3.5" />
          Audits
        </Link>
        <span className="text-muted-foreground">/</span>
        <Link
          href={`/audits/${auditId}`}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          #{auditId.slice(0, 8)}
        </Link>
        <span className="text-muted-foreground">/</span>
        <span className="font-medium">Conduct</span>
      </nav>

      <h1 className="text-2xl font-bold">
        Conduct: {template?.name ?? "Audit"} — {store?.name ?? "Store"}
      </h1>

      <AuditChecklist
        auditId={auditId}
        categories={categories}
        items={items}
        existingResponses={responseList}
        existingEvidence={evidenceList}
        ratingOptions={(template?.rating_labels as RatingOption[]) ?? DEFAULT_RATING_OPTIONS}
      />
    </div>
  );
}

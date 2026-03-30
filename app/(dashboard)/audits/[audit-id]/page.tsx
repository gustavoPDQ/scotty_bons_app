import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import { ExportAuditPdfButton } from "@/components/audits/export-audit-pdf-button";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AUDIT_RATING_LABELS,
  AUDIT_RATING_STYLES,
  getScoreColor,
  getScoreLabel,
} from "@/lib/constants/audit-status";
import type {
  AuditTemplateCategoryRow,
  AuditTemplateItemRow,
  AuditResponseRow,
  AuditEvidenceRow,
} from "@/lib/types";

export default async function AuditDetailPage({
  params,
}: {
  params: Promise<{ "audit-id": string }>;
}) {
  const { "audit-id": auditId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, store_id")
    .eq("user_id", user.id)
    .single();
  if (!profile) redirect("/login");

  const role = profile.role;
  const canConduct = role === "admin" || role === "commissary";

  // Fetch audit
  const { data: audit } = await supabase
    .from("audits")
    .select("id, template_id, store_id, conducted_by, score, notes, conducted_at, created_at, updated_at")
    .eq("id", auditId)
    .single();

  if (!audit) redirect("/audits");

  const isCompleted = !!audit.conducted_at;

  // Fetch related data in parallel
  const admin = createAdminClient();
  const [
    { data: store },
    { data: template },
    conductorResult,
    { data: templateCategories },
    { data: templateItems },
    { data: responses },
  ] = await Promise.all([
    supabase.from("stores").select("name").eq("id", audit.store_id).single(),
    supabase.from("audit_templates").select("name").eq("id", audit.template_id).single(),
    admin.auth.admin.getUserById(audit.conducted_by),
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

  const conductorName =
    (conductorResult.data?.user?.user_metadata?.name as string | undefined) ??
    conductorResult.data?.user?.email ??
    "—";

  const categories = (templateCategories ?? []) as AuditTemplateCategoryRow[];
  const items = (templateItems ?? []) as AuditTemplateItemRow[];
  const responseList = (responses ?? []) as AuditResponseRow[];
  const responseMap: Record<string, AuditResponseRow> = {};
  for (const r of responseList) {
    responseMap[r.template_item_id] = r;
  }

  // Group items by category
  const itemsByCategory: Record<string, AuditTemplateItemRow[]> = {};
  for (const cat of categories) {
    itemsByCategory[cat.id] = items
      .filter((i) => i.category_id === cat.id)
      .sort((a, b) => a.sort_order - b.sort_order);
  }

  // Fetch evidence for all responses
  const responseIds = responseList.map((r) => r.id);
  const evidenceMap: Record<string, AuditEvidenceRow[]> = {};
  if (responseIds.length > 0) {
    const { data: evidenceData } = await supabase
      .from("audit_evidence")
      .select("id, audit_response_id, image_url, caption, created_at")
      .in("audit_response_id", responseIds);

    for (const e of (evidenceData ?? []) as AuditEvidenceRow[]) {
      if (!evidenceMap[e.audit_response_id]) {
        evidenceMap[e.audit_response_id] = [];
      }
      evidenceMap[e.audit_response_id].push(e);
    }
  }

  const formatDate = (timestamp: string) =>
    new Intl.DateTimeFormat("en-CA", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(timestamp));

  // Rating summary
  const ratingCounts = { good: 0, satisfactory: 0, poor: 0 };
  for (const r of responseList) {
    ratingCounts[r.rating]++;
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
        <span className="font-medium">Audit #{audit.id.slice(0, 8)}</span>
      </nav>

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          {template?.name ?? "Audit"} — {store?.name ?? "Unknown Store"}
        </h1>
        <div className="flex items-center gap-3">
          <Badge
            variant="status"
            style={
              isCompleted
                ? { backgroundColor: "#15803d", color: "#fff", borderColor: "transparent" }
                : { backgroundColor: "#d97706", color: "#fff", borderColor: "transparent" }
            }
          >
            {isCompleted ? "Completed" : "In Progress"}
          </Badge>
          {isCompleted && (
            <ExportAuditPdfButton
              audit={{
                id: audit.id,
                score: audit.score,
                conducted_at: audit.conducted_at,
                notes: audit.notes,
              }}
              categories={categories.map((cat) => ({
                name: cat.name,
                items: (itemsByCategory[cat.id] ?? []).map((item) => ({
                  label: item.label,
                  rating: responseMap[item.id]?.rating ?? null,
                  notes: responseMap[item.id]?.notes ?? null,
                })),
              }))}
              storeName={store?.name ?? "Unknown Store"}
              templateName={template?.name ?? "Audit"}
              conductorName={conductorName}
            />
          )}
          {canConduct && !isCompleted && (
            <Button asChild size="sm">
              <Link href={`/audits/${auditId}/conduct`}>
                <Pencil className="size-4 mr-2" />
                Conduct
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Metadata */}
      <Card>
        <CardContent className="pt-6">
          <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-muted-foreground">Store</dt>
              <dd className="font-medium">{store?.name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Conducted by</dt>
              <dd className="font-medium">{conductorName}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Created</dt>
              <dd className="font-medium">{formatDate(audit.created_at)}</dd>
            </div>
            {audit.conducted_at && (
              <div>
                <dt className="text-muted-foreground">Completed</dt>
                <dd className="font-medium">{formatDate(audit.conducted_at)}</dd>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>

      {/* Score card */}
      {isCompleted && audit.score !== null && (
        <Card className={`border ${getScoreColor(audit.score)}`}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Audit Score</p>
                <p className="text-3xl font-bold">{audit.score}%</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-semibold">{getScoreLabel(audit.score)}</p>
                <p className="text-sm text-muted-foreground">
                  {ratingCounts.good} good · {ratingCounts.satisfactory} satisfactory · {ratingCounts.poor} poor
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notes */}
      {audit.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{audit.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Checklist results grouped by category */}
      {categories.length === 0 && items.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-sm text-muted-foreground">No checklist items found.</p>
          </CardContent>
        </Card>
      ) : (
        categories.map((cat) => {
          const catItems = itemsByCategory[cat.id] ?? [];
          if (catItems.length === 0) return null;

          return (
            <Card key={cat.id}>
              <CardHeader className="py-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{cat.name}</CardTitle>
                  {(() => {
                    const ratedItems = catItems.filter((i) => responseMap[i.id]);
                    if (ratedItems.length === 0) return null;
                    const ratingValues = { good: 2, satisfactory: 1, poor: 0 };
                    const total = ratedItems.reduce(
                      (sum, i) => sum + ratingValues[responseMap[i.id].rating],
                      0
                    );
                    const maxScore = ratedItems.length * 2;
                    const pct = Math.round((total / maxScore) * 100);
                    const good = ratedItems.filter((i) => responseMap[i.id].rating === "good").length;
                    const satisfactory = ratedItems.filter((i) => responseMap[i.id].rating === "satisfactory").length;
                    const poor = ratedItems.filter((i) => responseMap[i.id].rating === "poor").length;
                    return (
                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-muted-foreground">
                          {good} good · {satisfactory} satisfactory · {poor} poor
                        </span>
                        <span className={`font-semibold px-2 py-0.5 rounded border ${getScoreColor(pct)}`}>
                          {pct}%
                        </span>
                      </div>
                    );
                  })()}
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-3">
                  {catItems.map((item) => {
                    const response = responseMap[item.id];
                    const evidence = response ? (evidenceMap[response.id] ?? []) : [];
                    return (
                      <div key={item.id} className="border rounded-lg p-3">
                        <div className="flex items-start gap-3">
                          {response ? (
                            <Badge
                              variant="status"
                              style={AUDIT_RATING_STYLES[response.rating]}
                              className="shrink-0 mt-0.5 text-xs"
                            >
                              {AUDIT_RATING_LABELS[response.rating]}
                            </Badge>
                          ) : (
                            <div className="size-5 rounded-full border-2 border-muted-foreground/30 shrink-0 mt-0.5" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{item.label}</p>
                            {item.description && (
                              <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                            )}
                            {response?.notes && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {response.notes}
                              </p>
                            )}
                            {evidence.length > 0 && (
                              <div className="flex gap-2 mt-2 flex-wrap">
                                {evidence.map((e) => (
                                  <a
                                    key={e.id}
                                    href={e.image_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block"
                                  >
                                    <Image
                                      src={e.image_url}
                                      alt={e.caption ?? "Evidence"}
                                      width={64}
                                      height={64}
                                      className="size-16 object-cover rounded border hover:opacity-80 transition-opacity"
                                      unoptimized
                                    />
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}

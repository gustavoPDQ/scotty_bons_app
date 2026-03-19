import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, CheckCircle2, XCircle, Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AUDIT_STATUS_COLORS,
  AUDIT_STATUS_LABELS,
  getScoreColor,
  getScoreLabel,
} from "@/lib/constants/audit-status";
import type { AuditStatus, AuditTemplateItemRow, AuditResponseRow, AuditEvidenceRow } from "@/lib/types";

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
  const isAdmin = role === "admin";

  // Fetch audit
  const { data: audit } = await supabase
    .from("audits")
    .select("id, template_id, store_id, conducted_by, status, score, notes, conducted_at, created_at, updated_at")
    .eq("id", auditId)
    .single();

  if (!audit) redirect("/audits");

  const status = audit.status as AuditStatus;

  // Fetch related data in parallel
  const [
    { data: store },
    { data: template },
    { data: conductor },
    { data: templateItems },
    { data: responses },
  ] = await Promise.all([
    supabase.from("stores").select("name").eq("id", audit.store_id).single(),
    supabase.from("audit_templates").select("name").eq("id", audit.template_id).single(),
    supabase.from("profiles").select("full_name").eq("user_id", audit.conducted_by).single(),
    supabase
      .from("audit_template_items")
      .select("id, template_id, label, sort_order, created_at")
      .eq("template_id", audit.template_id)
      .order("sort_order"),
    supabase
      .from("audit_responses")
      .select("id, audit_id, template_item_id, passed, notes")
      .eq("audit_id", auditId),
  ]);

  const items = (templateItems ?? []) as AuditTemplateItemRow[];
  const responseList = (responses ?? []) as AuditResponseRow[];
  const responseMap: Record<string, AuditResponseRow> = {};
  for (const r of responseList) {
    responseMap[r.template_item_id] = r;
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

  const passedCount = responseList.filter((r) => r.passed).length;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
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
          <Badge className={AUDIT_STATUS_COLORS[status]}>
            {AUDIT_STATUS_LABELS[status]}
          </Badge>
          {isAdmin && status === "draft" && (
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
              <dd className="font-medium">{conductor?.full_name ?? "—"}</dd>
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
      {status === "completed" && audit.score !== null && (
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
                  {passedCount} of {items.length} items passed
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

      {/* Checklist results */}
      <Card>
        <CardHeader>
          <CardTitle>Checklist Items</CardTitle>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No checklist items found.</p>
          ) : (
            <div className="space-y-3">
              {items.map((item) => {
                const response = responseMap[item.id];
                const evidence = response ? (evidenceMap[response.id] ?? []) : [];
                return (
                  <div key={item.id} className="border rounded-lg p-3">
                    <div className="flex items-start gap-3">
                      {response ? (
                        response.passed ? (
                          <CheckCircle2 className="size-5 text-green-600 shrink-0 mt-0.5" />
                        ) : (
                          <XCircle className="size-5 text-red-600 shrink-0 mt-0.5" />
                        )
                      ) : (
                        <div className="size-5 rounded-full border-2 border-muted-foreground/30 shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{item.label}</p>
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}

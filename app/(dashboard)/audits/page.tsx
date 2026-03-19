import Link from "next/link";
import { redirect } from "next/navigation";
import { ClipboardCheck, Settings2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AUDIT_STATUS_COLORS, AUDIT_STATUS_LABELS, getScoreColor, getScoreLabel } from "@/lib/constants/audit-status";
import type { AuditStatus, AuditRow } from "@/lib/types";
import { AuditFilters } from "@/components/audits/audit-filters";
import { NewAuditDialog } from "@/components/audits/new-audit-dialog";

const isValidUUID = (u: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(u);

export default async function AuditsPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    store_id?: string;
  }>;
}) {
  const params = await searchParams;
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

  const role = profile.role as "admin" | "factory" | "store";
  const isAdmin = role === "admin";

  // Validate search params
  const statusFilter = (["draft", "completed"] as AuditStatus[]).includes(
    params.status as AuditStatus
  )
    ? params.status
    : undefined;
  const storeFilter =
    role !== "store" && params.store_id && isValidUUID(params.store_id)
      ? params.store_id
      : undefined;

  // Build query
  let query = supabase
    .from("audits")
    .select("id, template_id, store_id, conducted_by, status, score, notes, conducted_at, created_at, updated_at")
    .order("created_at", { ascending: false });

  if (statusFilter) {
    query = query.eq("status", statusFilter);
  }
  if (storeFilter) {
    query = query.eq("store_id", storeFilter);
  }

  const { data: auditsRaw } = await query;
  const audits: AuditRow[] = [];

  if (auditsRaw && auditsRaw.length > 0) {
    // Fetch store names
    const storeIds = [...new Set(auditsRaw.map((a) => a.store_id))];
    const { data: stores } = await supabase
      .from("stores")
      .select("id, name")
      .in("id", storeIds);
    const storeNames: Record<string, string> = {};
    for (const s of stores ?? []) {
      storeNames[s.id] = s.name;
    }

    // Fetch template names
    const templateIds = [...new Set(auditsRaw.map((a) => a.template_id))];
    const { data: templates } = await supabase
      .from("audit_templates")
      .select("id, name")
      .in("id", templateIds);
    const templateNames: Record<string, string> = {};
    for (const t of templates ?? []) {
      templateNames[t.id] = t.name;
    }

    // Fetch conductor names
    const conductorIds = [...new Set(auditsRaw.map((a) => a.conducted_by))];
    const { data: conductors } = await supabase
      .from("profiles")
      .select("user_id, full_name")
      .in("user_id", conductorIds);
    const conductorNames: Record<string, string> = {};
    for (const c of conductors ?? []) {
      conductorNames[c.user_id] = c.full_name;
    }

    for (const a of auditsRaw) {
      audits.push({
        ...(a as Omit<AuditRow, "store_name" | "template_name" | "conducted_by_name">),
        status: a.status as AuditStatus,
        store_name: storeNames[a.store_id],
        template_name: templateNames[a.template_id],
        conducted_by_name: conductorNames[a.conducted_by],
      });
    }
  }

  // Fetch stores for filter + new audit dialog
  let allStores: { id: string; name: string }[] = [];
  if (role !== "store") {
    const { data: storesData } = await supabase
      .from("stores")
      .select("id, name")
      .order("name");
    allStores = storesData ?? [];
  }

  // Fetch active templates for new audit dialog (admin only)
  let activeTemplates: { id: string; name: string }[] = [];
  if (isAdmin) {
    const { data: templatesData } = await supabase
      .from("audit_templates")
      .select("id, name")
      .eq("is_active", true)
      .order("name");
    activeTemplates = templatesData ?? [];
  }

  const formatDate = (timestamp: string) =>
    new Intl.DateTimeFormat("en-CA", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(timestamp));

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Audits</h1>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button variant="outline" size="sm" asChild>
              <Link href="/audits/templates">
                <Settings2 className="size-4 mr-2" />
                Templates
              </Link>
            </Button>
          )}
          {isAdmin && activeTemplates.length > 0 && (
            <NewAuditDialog stores={allStores} templates={activeTemplates} />
          )}
        </div>
      </div>

      <AuditFilters role={role} stores={allStores} />

      {audits.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <ClipboardCheck className="mx-auto size-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No audits yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {isAdmin
                ? "Create your first audit to get started."
                : "No audits have been conducted yet."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border divide-y">
          {audits.map((audit) => (
            <Link
              key={audit.id}
              href={`/audits/${audit.id}`}
              className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-muted/50 transition-colors"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {audit.template_name ?? "Audit"} — {audit.store_name ?? "Unknown Store"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(audit.created_at)}
                  {audit.conducted_by_name ? ` · by ${audit.conducted_by_name}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {audit.status === "completed" && audit.score !== null && (
                  <span
                    className={`text-sm font-medium px-2 py-0.5 rounded border ${getScoreColor(audit.score)}`}
                  >
                    {audit.score}% — {getScoreLabel(audit.score)}
                  </span>
                )}
                <Badge className={AUDIT_STATUS_COLORS[audit.status]}>
                  {AUDIT_STATUS_LABELS[audit.status]}
                </Badge>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

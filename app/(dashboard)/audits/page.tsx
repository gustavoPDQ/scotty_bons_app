import Link from "next/link";
import { redirect } from "next/navigation";
import { ClipboardCheck, Settings2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser, getProfile } from "@/lib/supabase/auth-cache";
import { createPageTimer } from "@/lib/perf";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getScoreColor, getScoreLabel } from "@/lib/constants/audit-status";
import type { AuditRow } from "@/lib/types";
import { AuditFilters } from "@/components/audits/audit-filters";
import { DeleteAuditButton } from "@/components/audits/delete-audit-button";
import { NewAuditDialog } from "@/components/audits/new-audit-dialog";

const isValidDate = (d: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(d) && !isNaN(Date.parse(d));
const isValidUUID = (u: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(u);

export default async function AuditsPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    store_id?: string;
    from?: string;
    to?: string;
  }>;
}) {
  const timer = createPageTimer("Audits");
  const params = await searchParams;

  const user = await timer.time("auth.getUser(cached)", () => getUser());
  if (!user) redirect("/login");

  const profile = await timer.time("profiles.select(cached)", () => getProfile());
  if (!profile) redirect("/login");

  const supabase = await createClient();

  const role = profile.role as "admin" | "commissary" | "store";
  const isAdmin = role === "admin";
  const canConduct = role === "admin" || role === "commissary";

  // Validate search params
  const statusFilter = (["in_progress", "completed"] as const).includes(
    params.status as "in_progress" | "completed"
  )
    ? (params.status as "in_progress" | "completed")
    : undefined;
  const storeFilter =
    role !== "store" && params.store_id && isValidUUID(params.store_id)
      ? params.store_id
      : undefined;
  const fromFilter =
    params.from && isValidDate(params.from) ? params.from : undefined;
  const toFilter =
    params.to && isValidDate(params.to) ? params.to : undefined;

  // Build query
  let query = supabase
    .from("audits")
    .select("id, template_id, store_id, conducted_by, score, notes, conducted_at, created_at, updated_at")
    .order("created_at", { ascending: false });

  if (statusFilter === "completed") {
    query = query.not("conducted_at", "is", null);
  } else if (statusFilter === "in_progress") {
    query = query.is("conducted_at", null);
  }
  if (storeFilter) {
    query = query.eq("store_id", storeFilter);
  }
  if (fromFilter) {
    query = query.gte("created_at", fromFilter);
  }
  if (toFilter) {
    query = query.lte("created_at", toFilter + "T23:59:59.999Z");
  }

  const { data: auditsRaw } = await timer.time("audits.select", () => query);
  const audits: AuditRow[] = [];

  if (auditsRaw && auditsRaw.length > 0) {
    // Fetch store names
    const storeIds = [...new Set(auditsRaw.map((a) => a.store_id))];
    const { data: stores } = await timer.time("stores.byAudits", () =>
      supabase
        .from("stores")
        .select("id, name")
        .in("id", storeIds)
    );
    const storeNames: Record<string, string> = {};
    for (const s of stores ?? []) {
      storeNames[s.id] = s.name;
    }

    // Fetch template names
    const templateIds = [...new Set(auditsRaw.map((a) => a.template_id))];
    const { data: templates } = await timer.time("templates.byAudits", () =>
      supabase
        .from("audit_templates")
        .select("id, name")
        .in("id", templateIds)
    );
    const templateNames: Record<string, string> = {};
    for (const t of templates ?? []) {
      templateNames[t.id] = t.name;
    }

    // Fetch conductor names from auth.users via admin API
    const conductorIds = [...new Set(auditsRaw.map((a) => a.conducted_by))];
    const adminClient = createAdminClient();
    const conductorResults = await timer.time(
      `admin.getUserById x${conductorIds.length}`,
      () =>
        Promise.all(
          conductorIds.map((id) => adminClient.auth.admin.getUserById(id)),
        )
    );
    const conductorNames: Record<string, string> = {};
    for (const r of conductorResults) {
      if (r.data?.user) {
        const u = r.data.user;
        conductorNames[u.id] = (u.user_metadata?.name as string | undefined) ?? u.email ?? "";
      }
    }

    for (const a of auditsRaw) {
      audits.push({
        ...(a as Omit<AuditRow, "store_name" | "template_name" | "conducted_by_name">),
        store_name: storeNames[a.store_id],
        template_name: templateNames[a.template_id],
        conducted_by_name: conductorNames[a.conducted_by],
      });
    }
  }

  // Fetch stores for filter + new audit dialog
  let allStores: { id: string; name: string }[] = [];
  if (role !== "store") {
    const { data: storesData } = await timer.time("stores.allForFilter", () =>
      supabase
        .from("stores")
        .select("id, name")
        .order("name")
    );
    allStores = storesData ?? [];
  }

  // Fetch active templates for new audit dialog (admin + commissary)
  let activeTemplates: { id: string; name: string }[] = [];
  if (canConduct) {
    const { data: templatesData } = await timer.time("templates.active", () =>
      supabase
        .from("audit_templates")
        .select("id, name")
        .eq("is_active", true)
        .order("name")
    );
    activeTemplates = templatesData ?? [];
  }

  timer.summary();

  const formatDate = (timestamp: string) =>
    new Intl.DateTimeFormat("en-CA", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(timestamp));

  return (
    <div className="max-w-5xl mx-auto space-y-6">
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
          {canConduct && activeTemplates.length > 0 && (
            <NewAuditDialog stores={allStores} templates={activeTemplates} />
          )}
        </div>
      </div>

      <AuditFilters role={role} stores={allStores} />

      {audits.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="flex size-16 mx-auto items-center justify-center rounded-full bg-primary-light mb-4">
              <ClipboardCheck className="size-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No audits yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {canConduct
                ? "Create your first audit to get started."
                : "No audits have been conducted yet."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {audits.map((audit) => {
            const isCompleted = !!audit.conducted_at;
            return (
              <Card key={audit.id} className="hover:shadow-md transition-shadow">
                <div className="flex items-center min-w-0">
                  <Link
                    href={`/audits/${audit.id}`}
                    className="flex flex-1 items-center gap-3 px-4 py-3 min-w-0"
                  >
                    <div className="hidden sm:flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-light">
                      <ClipboardCheck className="size-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <p className="text-sm font-semibold">
                          {audit.template_name ?? "Audit"} — {audit.store_name ?? "Unknown Store"}
                        </p>
                        <Badge
                          variant="status"
                          style={
                            isCompleted
                              ? { backgroundColor: "#dcfce7", color: "#166534", borderColor: "#4ade80" }
                              : { backgroundColor: "#fef3c7", color: "#92400e", borderColor: "#fbbf24" }
                          }
                        >
                          {isCompleted ? "Completed" : "In Progress"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {formatDate(audit.created_at)}
                        {audit.conducted_by_name ? ` · by ${audit.conducted_by_name}` : ""}
                      </p>
                    </div>
                    {isCompleted && audit.score !== null && (
                      <span
                        className={`hidden sm:inline-block text-sm font-medium px-2.5 py-1 rounded-full border shrink-0 ${getScoreColor(audit.score)}`}
                      >
                        {audit.score}% — {getScoreLabel(audit.score)}
                      </span>
                    )}
                  </Link>
                  {isAdmin && (
                    <div className="pr-3 shrink-0">
                      <DeleteAuditButton
                        auditId={audit.id}
                        auditLabel={`${audit.template_name ?? "Audit"} — ${audit.store_name ?? "Unknown Store"}`}
                      />
                    </div>
                  )}
                </div>
                {isCompleted && audit.score !== null && (
                  <div className="sm:hidden px-4 pb-3 -mt-1">
                    <span
                      className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full border ${getScoreColor(audit.score)}`}
                    >
                      {audit.score}% — {getScoreLabel(audit.score)}
                    </span>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

"use client";

import { useRef, useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  AuditTemplateCategoryRow,
  AuditTemplateItemRow,
  AuditResponseRow,
  AuditEvidenceRow,
  RatingOption,
} from "@/lib/types";
import { getRatingStyle } from "@/lib/constants/audit-status";
import { saveAuditResponse, completeAudit } from "@/app/(dashboard)/audits/actions";
import { AuditEvidenceUploader } from "@/components/audits/audit-evidence-uploader";

interface AuditChecklistProps {
  auditId: string;
  categories: AuditTemplateCategoryRow[];
  items: AuditTemplateItemRow[];
  existingResponses: AuditResponseRow[];
  existingEvidence: AuditEvidenceRow[];
  ratingOptions: RatingOption[];
}

interface ResponseState {
  id?: string;
  rating: string;
  notes: string;
  saving: boolean;
}

export function AuditChecklist({
  auditId,
  categories,
  items,
  existingResponses,
  existingEvidence,
  ratingOptions,
}: AuditChecklistProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Build initial response state from existing responses
  const initialResponses: Record<string, ResponseState> = {};
  for (const r of existingResponses) {
    initialResponses[r.template_item_id] = {
      id: r.id,
      rating: r.rating,
      notes: r.notes ?? "",
      saving: false,
    };
  }

  const [responses, setResponses] = useState<Record<string, ResponseState>>(initialResponses);
  const responsesRef = useRef(responses);
  responsesRef.current = responses;
  const [auditNotes, setAuditNotes] = useState("");

  // Collapsed categories
  const [collapsedCats, setCollapsedCats] = useState<Record<string, boolean>>({});

  // Build evidence map: response_id -> evidence[]
  const [evidenceMap, setEvidenceMap] = useState<Record<string, AuditEvidenceRow[]>>(() => {
    const map: Record<string, AuditEvidenceRow[]> = {};
    for (const e of existingEvidence) {
      if (!map[e.audit_response_id]) map[e.audit_response_id] = [];
      map[e.audit_response_id].push(e);
    }
    return map;
  });

  // Group items by category
  const sortedCategories = [...categories].sort((a, b) => a.sort_order - b.sort_order);
  const itemsByCategory: Record<string, AuditTemplateItemRow[]> = {};
  for (const cat of sortedCategories) {
    itemsByCategory[cat.id] = items
      .filter((i) => i.category_id === cat.id)
      .sort((a, b) => a.sort_order - b.sort_order);
  }

  // Rating lookup
  const ratingMap = new Map(ratingOptions.map((r) => [r.key, r]));

  const handleRating = useCallback(
    async (itemId: string, ratingKey: string) => {
      setResponses((prev) => ({
        ...prev,
        [itemId]: { ...prev[itemId], rating: ratingKey, notes: prev[itemId]?.notes ?? "", saving: true },
      }));

      const result = await saveAuditResponse({
        audit_id: auditId,
        template_item_id: itemId,
        rating: ratingKey,
        notes: responsesRef.current[itemId]?.notes || undefined,
      });

      if (result.error) {
        toast.error(result.error);
        setResponses((prev) => ({
          ...prev,
          [itemId]: { ...prev[itemId], saving: false },
        }));
        return;
      }

      setResponses((prev) => ({
        ...prev,
        [itemId]: { ...prev[itemId], id: result.data?.id, saving: false },
      }));
    },
    [auditId],
  );

  const handleNotesBlur = useCallback(
    async (itemId: string) => {
      const current = responsesRef.current[itemId];
      if (!current || current.id === undefined) return;

      setResponses((prev) => ({
        ...prev,
        [itemId]: { ...prev[itemId], saving: true },
      }));

      const result = await saveAuditResponse({
        audit_id: auditId,
        template_item_id: itemId,
        rating: current.rating,
        notes: current.notes || undefined,
      });

      if (result.error) {
        toast.error(result.error);
      }

      setResponses((prev) => ({
        ...prev,
        [itemId]: { ...prev[itemId], saving: false },
      }));
    },
    [auditId],
  );

  const handleComplete = useCallback(async () => {
    startTransition(async () => {
      const result = await completeAudit({
        audit_id: auditId,
        notes: auditNotes || undefined,
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(`Audit completed! Score: ${result.data?.score}%`);
      router.push(`/audits/${auditId}`);
      router.refresh();
    });
  }, [auditId, auditNotes, router]);

  const totalItems = items.length;
  const answeredCount = Object.keys(responses).length;

  // Count ratings by key
  const ratingCounts: Record<string, number> = {};
  for (const opt of ratingOptions) ratingCounts[opt.key] = 0;
  for (const r of Object.values(responses)) {
    ratingCounts[r.rating] = (ratingCounts[r.rating] ?? 0) + 1;
  }

  const handleEvidenceChange = useCallback(
    (responseId: string, evidence: AuditEvidenceRow[]) => {
      setEvidenceMap((prev) => ({ ...prev, [responseId]: evidence }));
    },
    []
  );

  return (
    <div className="space-y-4">
      {/* Progress */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span>
              {answeredCount} of {totalItems} rated
            </span>
            <span className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm">
              {ratingOptions.map((opt) => (
                <span key={opt.key} className="flex items-center gap-1">
                  <span
                    className="size-2 sm:size-2.5 rounded-full"
                    style={{ backgroundColor: (getRatingStyle(opt.weight).backgroundColor as string) }}
                  />
                  {ratingCounts[opt.key] ?? 0}
                </span>
              ))}
            </span>
          </div>
          <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${totalItems > 0 ? (answeredCount / totalItems) * 100 : 0}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Categories with items */}
      {sortedCategories.map((cat) => {
        const catItems = itemsByCategory[cat.id] ?? [];
        const isCollapsed = !!collapsedCats[cat.id];
        const catAnswered = catItems.filter((i) => responses[i.id]).length;

        return (
          <Card key={cat.id}>
            <CardHeader
              className="cursor-pointer select-none py-3"
              onClick={() => setCollapsedCats((prev) => ({ ...prev, [cat.id]: !prev[cat.id] }))}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isCollapsed ? (
                    <ChevronRight className="size-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="size-4 text-muted-foreground" />
                  )}
                  <CardTitle className="text-base">{cat.name}</CardTitle>
                </div>
                <span className="text-xs text-muted-foreground">
                  {catAnswered}/{catItems.length} rated
                </span>
              </div>
            </CardHeader>

            {!isCollapsed && (
              <CardContent className="pt-0 space-y-3">
                {catItems.map((item) => {
                  const response = responses[item.id];
                  const responseId = response?.id;
                  const evidence = responseId ? (evidenceMap[responseId] ?? []) : [];

                  return (
                    <div key={item.id} className="border rounded-lg p-3">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4">
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{item.label}</p>
                          {item.description && (
                            <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                          )}
                        </div>

                        {/* Dynamic rating selector */}
                        <div className="flex gap-1 shrink-0 flex-wrap">
                          {ratingOptions.map((opt) => {
                            const isActive = response?.rating === opt.key;
                            return (
                              <button
                                key={opt.key}
                                type="button"
                                disabled={response?.saving}
                                onClick={() => handleRating(item.id, opt.key)}
                                className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-colors ${
                                  isActive
                                    ? ""
                                    : "bg-background text-muted-foreground border-border hover:border-foreground/30"
                                }`}
                                style={isActive ? getRatingStyle(opt.weight) : undefined}
                              >
                                {opt.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {response !== undefined && (
                        <div className="mt-3 space-y-2">
                          <Textarea
                            placeholder="Notes (optional)"
                            rows={2}
                            value={response.notes}
                            onChange={(e) =>
                              setResponses((prev) => ({
                                ...prev,
                                [item.id]: { ...prev[item.id], notes: e.target.value },
                              }))
                            }
                            onBlur={() => handleNotesBlur(item.id)}
                          />

                          {responseId && (
                            <AuditEvidenceUploader
                              auditResponseId={responseId}
                              evidence={evidence}
                              onEvidenceChange={(ev) => handleEvidenceChange(responseId, ev)}
                            />
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            )}
          </Card>
        );
      })}

      {/* Complete section */}
      <Card>
        <CardHeader>
          <CardTitle>Complete Audit</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Audit Notes (optional)</Label>
            <Textarea
              placeholder="Overall observations or notes about this audit..."
              rows={3}
              value={auditNotes}
              onChange={(e) => setAuditNotes(e.target.value)}
            />
          </div>
          <Button
            onClick={handleComplete}
            disabled={isPending || answeredCount < totalItems}
            className="w-full"
          >
            {isPending
              ? "Completing..."
              : answeredCount < totalItems
                ? `Rate all items to complete (${totalItems - answeredCount} remaining)`
                : "Complete Audit"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

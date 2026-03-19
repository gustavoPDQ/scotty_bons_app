"use client";

import { useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AuditTemplateItemRow, AuditResponseRow, AuditEvidenceRow } from "@/lib/types";
import { saveAuditResponse, completeAudit } from "@/app/(dashboard)/audits/actions";
import { AuditEvidenceUploader } from "@/components/audits/audit-evidence-uploader";

interface AuditChecklistProps {
  auditId: string;
  items: AuditTemplateItemRow[];
  existingResponses: AuditResponseRow[];
  existingEvidence: AuditEvidenceRow[];
}

interface ResponseState {
  id?: string;
  passed: boolean;
  notes: string;
  saving: boolean;
}

export function AuditChecklist({
  auditId,
  items,
  existingResponses,
  existingEvidence,
}: AuditChecklistProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Build initial response state from existing responses
  const initialResponses: Record<string, ResponseState> = {};
  for (const r of existingResponses) {
    initialResponses[r.template_item_id] = {
      id: r.id,
      passed: r.passed,
      notes: r.notes ?? "",
      saving: false,
    };
  }

  const [responses, setResponses] = useState<Record<string, ResponseState>>(initialResponses);
  const [auditNotes, setAuditNotes] = useState("");

  // Build evidence map: response_id -> evidence[]
  const [evidenceMap, setEvidenceMap] = useState<Record<string, AuditEvidenceRow[]>>(() => {
    const map: Record<string, AuditEvidenceRow[]> = {};
    for (const e of existingEvidence) {
      if (!map[e.audit_response_id]) map[e.audit_response_id] = [];
      map[e.audit_response_id].push(e);
    }
    return map;
  });

  const handleToggle = useCallback(
    async (itemId: string, passed: boolean) => {
      setResponses((prev) => ({
        ...prev,
        [itemId]: { ...prev[itemId], passed, notes: prev[itemId]?.notes ?? "", saving: true },
      }));

      const result = await saveAuditResponse({
        audit_id: auditId,
        template_item_id: itemId,
        passed,
        notes: responses[itemId]?.notes || undefined,
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
    [auditId, responses]
  );

  const handleNotesBlur = useCallback(
    async (itemId: string) => {
      const current = responses[itemId];
      if (!current || current.id === undefined) return;

      setResponses((prev) => ({
        ...prev,
        [itemId]: { ...prev[itemId], saving: true },
      }));

      await saveAuditResponse({
        audit_id: auditId,
        template_item_id: itemId,
        passed: current.passed,
        notes: current.notes || undefined,
      });

      setResponses((prev) => ({
        ...prev,
        [itemId]: { ...prev[itemId], saving: false },
      }));
    },
    [auditId, responses]
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

  const answeredCount = Object.keys(responses).length;
  const passedCount = Object.values(responses).filter((r) => r.passed).length;

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
          <div className="flex items-center justify-between text-sm">
            <span>
              {answeredCount} of {items.length} items answered
            </span>
            <span className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="size-4 text-green-600" />
                {passedCount} passed
              </span>
              <span className="flex items-center gap-1">
                <XCircle className="size-4 text-red-600" />
                {answeredCount - passedCount} failed
              </span>
            </span>
          </div>
          <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${items.length > 0 ? (answeredCount / items.length) * 100 : 0}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Checklist items */}
      {items.map((item) => {
        const response = responses[item.id];
        const responseId = response?.id;
        const evidence = responseId ? (evidenceMap[responseId] ?? []) : [];

        return (
          <Card key={item.id}>
            <CardContent className="py-4">
              <div className="flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{item.label}</p>

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

                <div className="flex items-center gap-2 shrink-0 pt-0.5">
                  {response !== undefined && (
                    <span className={`text-xs font-medium ${response.passed ? "text-green-600" : "text-red-600"}`}>
                      {response.passed ? "Pass" : "Fail"}
                    </span>
                  )}
                  <Switch
                    checked={response?.passed ?? false}
                    onCheckedChange={(checked) => handleToggle(item.id, checked)}
                    disabled={response?.saving}
                  />
                </div>
              </div>
            </CardContent>
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
            disabled={isPending || answeredCount < items.length}
            className="w-full"
          >
            {isPending
              ? "Completing..."
              : answeredCount < items.length
                ? `Answer all items to complete (${items.length - answeredCount} remaining)`
                : "Complete Audit"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

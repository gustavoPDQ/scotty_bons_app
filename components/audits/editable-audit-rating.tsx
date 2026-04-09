"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import type { RatingOption } from "@/lib/types";
import { getRatingStyle } from "@/lib/constants/audit-status";
import { updateAuditResponse } from "@/app/(dashboard)/audits/actions";

interface EditableAuditRatingProps {
  responseId: string;
  auditId: string;
  currentRating: string;
  currentNotes: string | null;
  ratingOptions: RatingOption[];
}

export function EditableAuditRating({
  responseId,
  auditId,
  currentRating,
  currentNotes,
  ratingOptions,
}: EditableAuditRatingProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [rating, setRating] = useState(currentRating);
  const [notes, setNotes] = useState(currentNotes ?? "");
  const [isPending, startTransition] = useTransition();

  const ratingMap = new Map(ratingOptions.map((r) => [r.key, r]));
  const currentOpt = ratingMap.get(currentRating);

  const handleCancel = () => {
    setRating(currentRating);
    setNotes(currentNotes ?? "");
    setEditing(false);
  };

  const handleSave = () => {
    startTransition(async () => {
      const result = await updateAuditResponse({
        response_id: responseId,
        audit_id: auditId,
        rating,
        notes: notes.trim() || undefined,
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Rating updated");
      setEditing(false);
      router.refresh();
    });
  };

  if (!editing) {
    return (
      <div className="flex items-center gap-1.5">
        <Badge
          variant="status"
          style={getRatingStyle(currentOpt?.weight ?? 0)}
          className="shrink-0 text-xs"
        >
          {currentOpt?.label ?? currentRating}
        </Badge>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="p-0.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          title="Edit rating"
        >
          <Pencil className="size-3" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <div className="flex gap-1 flex-wrap">
          {ratingOptions.map((opt) => {
            const isActive = rating === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                disabled={isPending}
                onClick={() => setRating(opt.key)}
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
        <button
          type="button"
          onClick={handleCancel}
          disabled={isPending}
          className="p-0.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          title="Cancel"
        >
          <X className="size-3.5" />
        </button>
      </div>
      <Textarea
        placeholder="Notes (optional)"
        rows={2}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        disabled={isPending}
      />
      <div className="flex gap-2">
        <Button size="sm" onClick={handleSave} disabled={isPending}>
          {isPending ? "Saving..." : "Save"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={handleCancel}
          disabled={isPending}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

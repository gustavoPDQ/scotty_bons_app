"use client";

import Image from "next/image";
import { useRef, useState, useTransition } from "react";
import { ImagePlus, X, Expand } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import type { AuditEvidenceRow } from "@/lib/types";
import {
  uploadAuditEvidence,
  removeAuditEvidence,
} from "@/app/(dashboard)/audits/[audit-id]/evidence-actions";

interface AuditEvidenceUploaderProps {
  auditResponseId: string;
  evidence: AuditEvidenceRow[];
  onEvidenceChange: (evidence: AuditEvidenceRow[]) => void;
}

const MAX_EVIDENCE = 3;

export function AuditEvidenceUploader({
  auditResponseId,
  evidence,
  onEvidenceChange,
}: AuditEvidenceUploaderProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.set("file", file);

    startTransition(async () => {
      const result = await uploadAuditEvidence(auditResponseId, formData);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      if (result.data) {
        onEvidenceChange([...evidence, result.data]);
        toast.success("Photo uploaded.");
      }
    });

    // Reset file input
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleRemove(evidenceId: string) {
    startTransition(async () => {
      const result = await removeAuditEvidence(evidenceId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      onEvidenceChange(evidence.filter((e) => e.id !== evidenceId));
      toast.success("Photo removed.");
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        {evidence.map((e) => (
          <div key={e.id} className="relative group">
            <Image
              src={e.image_url}
              alt={e.caption ?? "Evidence"}
              width={64}
              height={64}
              className="size-16 object-cover rounded border cursor-pointer"
              onClick={() => setLightboxUrl(e.image_url)}
              unoptimized
            />
            <button
              type="button"
              onClick={() => handleRemove(e.id)}
              disabled={isPending}
              className="absolute -top-1.5 -right-1.5 size-5 rounded-full bg-red-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="size-3" />
            </button>
            <button
              type="button"
              onClick={() => setLightboxUrl(e.image_url)}
              className="absolute bottom-0.5 right-0.5 size-5 rounded bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Expand className="size-3" />
            </button>
          </div>
        ))}

        {evidence.length < MAX_EVIDENCE && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleFileChange}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="size-16 p-0"
              onClick={() => fileRef.current?.click()}
              disabled={isPending}
            >
              <ImagePlus className="size-5" />
            </Button>
          </>
        )}
      </div>

      {evidence.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {evidence.length}/{MAX_EVIDENCE} photos
        </p>
      )}

      {/* Lightbox */}
      <Dialog open={!!lightboxUrl} onOpenChange={(open) => !open && setLightboxUrl(null)}>
        <DialogContent className="max-w-3xl p-2">
          <DialogTitle className="sr-only">Evidence Photo</DialogTitle>
          {lightboxUrl && (
            <Image
              src={lightboxUrl}
              alt="Evidence"
              width={1200}
              height={800}
              className="w-full h-auto rounded"
              unoptimized
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

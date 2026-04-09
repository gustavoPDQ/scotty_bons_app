"use client";

import { useState } from "react";
import { FileDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface AuditPdfCategory {
  name: string;
  items: {
    label: string;
    rating: string | null;
    notes: string | null;
  }[];
}

interface ExportAuditPdfButtonProps {
  audit: { id: string; score: number | null; conducted_at: string | null; notes: string | null };
  categories: AuditPdfCategory[];
  storeName: string;
  templateName: string;
  conductorName: string;
  ratingOptions?: { key: string; label: string; weight: number }[];
}

export function ExportAuditPdfButton({
  audit,
  categories,
  storeName,
  templateName,
  conductorName,
  ratingOptions,
}: ExportAuditPdfButtonProps) {
  const [generating, setGenerating] = useState(false);

  async function handleExport() {
    setGenerating(true);
    try {
      const { generateAuditPdf } = await import("@/lib/pdf/generate-audit-pdf");
      const { downloadPdf } = await import("@/lib/pdf/download-pdf");
      const blob = generateAuditPdf(audit, categories, storeName, templateName, conductorName, ratingOptions as any);
      const date = new Date().toISOString().slice(0, 10);
      const safeName = storeName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      downloadPdf(blob, `audit-${safeName}-${date}.pdf`);
    } catch {
      toast.error("Failed to generate PDF. Please try again.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={generating}
    >
      {generating ? (
        <>
          <Loader2 className="size-4 mr-1.5 animate-spin" />
          Generating...
        </>
      ) : (
        <>
          <FileDown className="size-4 mr-1.5" />
          Export PDF
        </>
      )}
    </Button>
  );
}

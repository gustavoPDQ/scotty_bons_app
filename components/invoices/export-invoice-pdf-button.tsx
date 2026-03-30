"use client";

import { useState } from "react";
import { FileDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface ExportInvoicePdfButtonProps {
  invoice: {
    invoice_number: string;
    created_at: string;
    company_name: string | null;
    company_address: string | null;
    company_tax_id: string | null;
    store_name: string;
    store_business_name: string | null;
    store_address: string | null;
    store_postal_code: string | null;
    store_phone: string | null;
    store_email: string | null;
    subtotal: number;
    tax_rate: number;
    tax_amount: number;
    ad_royalties_fee: number | null;
    grand_total: number;
  };
  items: {
    product_name: string;
    modifier: string;
    unit_price: number;
    quantity: number;
    line_total: number;
  }[];
}

export function ExportInvoicePdfButton({
  invoice,
  items,
}: ExportInvoicePdfButtonProps) {
  const [generating, setGenerating] = useState(false);

  async function handleExport() {
    setGenerating(true);
    try {
      const { generateInvoicePdf } = await import(
        "@/lib/pdf/generate-invoice-pdf"
      );
      const { downloadPdf } = await import("@/lib/pdf/download-pdf");
      const blob = generateInvoicePdf(invoice, items);
      const date = new Date().toISOString().slice(0, 10);
      downloadPdf(blob, `${invoice.invoice_number}-${date}.pdf`);
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

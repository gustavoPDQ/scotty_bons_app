"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { formatPrice } from "@/lib/utils";
import { InvoiceSelectableList } from "@/components/invoices/invoice-selection-summary";
import { FileText, ChevronRight } from "lucide-react";

interface InvoiceData {
  id: string;
  invoice_number: string;
  store_id: string;
  store_name: string;
  order_date?: string;
  grand_total: number;
  created_at: string;
}

interface InvoiceListWithSelectionProps {
  invoices: InvoiceData[];
}

export function InvoiceListWithSelection({ invoices }: InvoiceListWithSelectionProps) {
  const invoiceIds = invoices.map((i) => i.id);
  const dateFmt = new Intl.DateTimeFormat("en-CA", { dateStyle: "medium" });

  return (
    <InvoiceSelectableList invoiceIds={invoiceIds}>
      {({ isSelected, toggleSelection }) => (
        <div className="space-y-3">
          {invoices.map((invoice) => (
            <Card
              key={invoice.id}
              className="overflow-hidden hover:shadow-md transition-shadow"
            >
              <div className="flex items-center gap-3">
                {invoiceIds.length > 1 && (
                  <div
                    className="pl-4 py-4 flex items-center"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Checkbox
                      checked={isSelected(invoice.id)}
                      onCheckedChange={() => toggleSelection(invoice.id)}
                    />
                  </div>
                )}
                <Link
                  href={`/invoices/${invoice.id}`}
                  className="flex flex-1 items-center gap-3 px-4 py-4"
                >
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-light">
                    <FileText className="size-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">
                      {invoice.invoice_number}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {invoice.store_name}
                      {invoice.order_date
                        ? ` · Order: ${dateFmt.format(new Date(invoice.order_date))}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right">
                      <p className="text-sm font-semibold">
                        {formatPrice(invoice.grand_total)}
                      </p>
                    </div>
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </div>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </InvoiceSelectableList>
  );
}

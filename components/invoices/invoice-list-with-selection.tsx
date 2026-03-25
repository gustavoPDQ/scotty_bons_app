"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { formatPrice } from "@/lib/utils";
import { InvoiceSelectableList } from "@/components/invoices/invoice-selection-summary";

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
        <Card className="divide-y">
          {invoices.map((invoice) => (
            <div
              key={invoice.id}
              className="flex items-center gap-2 border-l-4 border-blue-300 hover:bg-muted/50 transition-colors"
            >
              {invoiceIds.length > 1 && (
                <div
                  className="pl-3 py-3 flex items-center"
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
                className="flex flex-1 items-center justify-between gap-4 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {invoice.invoice_number}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {invoice.store_name}
                    {invoice.order_date
                      ? ` · Order: ${dateFmt.format(new Date(invoice.order_date))}`
                      : ""}
                  </p>
                </div>
                <div className="flex items-center gap-4 shrink-0 text-sm">
                  <span className="font-medium">
                    {formatPrice(invoice.grand_total)}
                  </span>
                  <span className="text-muted-foreground">
                    {dateFmt.format(new Date(invoice.created_at))}
                  </span>
                </div>
              </Link>
            </div>
          ))}
        </Card>
      )}
    </InvoiceSelectableList>
  );
}

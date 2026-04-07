"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { formatPrice } from "@/lib/utils";
import { InvoiceSelectableList } from "@/components/invoices/invoice-selection-summary";
import { FileText, ChevronRight } from "lucide-react";

type SortKey = "newest" | "oldest" | "store_asc" | "store_desc" | "invoice_asc" | "invoice_desc";

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

function sortInvoices(invoices: InvoiceData[], key: SortKey): InvoiceData[] {
  const sorted = [...invoices];
  switch (key) {
    case "newest":
      return sorted.sort((a, b) => b.created_at.localeCompare(a.created_at));
    case "oldest":
      return sorted.sort((a, b) => a.created_at.localeCompare(b.created_at));
    case "store_asc":
      return sorted.sort((a, b) => a.store_name.localeCompare(b.store_name) || b.created_at.localeCompare(a.created_at));
    case "store_desc":
      return sorted.sort((a, b) => b.store_name.localeCompare(a.store_name) || b.created_at.localeCompare(a.created_at));
    case "invoice_asc":
      return sorted.sort((a, b) => a.invoice_number.localeCompare(b.invoice_number));
    case "invoice_desc":
      return sorted.sort((a, b) => b.invoice_number.localeCompare(a.invoice_number));
    default:
      return sorted;
  }
}

export function InvoiceListWithSelection({ invoices }: InvoiceListWithSelectionProps) {
  const [sortKey, setSortKey] = useState<SortKey>("newest");
  const sorted = useMemo(() => sortInvoices(invoices, sortKey), [invoices, sortKey]);
  const invoiceIds = sorted.map((i) => i.id);
  const dateFmt = new Intl.DateTimeFormat("en-CA", { dateStyle: "medium" });

  return (
    <InvoiceSelectableList invoiceIds={invoiceIds}>
      {({ isSelected, toggleSelection }) => (
        <div className="space-y-3">
          <div className="flex items-center justify-end">
            <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
              <SelectTrigger className="w-[180px] h-9 rounded-xl text-xs">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="newest">Newest first</SelectItem>
                <SelectItem value="oldest">Oldest first</SelectItem>
                <SelectItem value="store_asc">Store A → Z</SelectItem>
                <SelectItem value="store_desc">Store Z → A</SelectItem>
                <SelectItem value="invoice_asc">Invoice # ↑</SelectItem>
                <SelectItem value="invoice_desc">Invoice # ↓</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {sorted.map((invoice) => (
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

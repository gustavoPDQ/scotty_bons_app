"use client";

import { useState, useTransition, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/utils";
import { getInvoiceItemsForInvoices, getInvoiceTotalsForInvoices } from "@/app/(dashboard)/invoices/actions";
import type { InvoiceItemRow } from "@/lib/types";

interface InvoiceSelectableListProps {
  invoiceIds: string[];
  children: (props: {
    isSelected: (id: string) => boolean;
    toggleSelection: (id: string) => void;
    selectAll: () => void;
    clearAll: () => void;
    selectedCount: number;
  }) => React.ReactNode;
}

interface AggregatedItem {
  key: string;
  product_name: string;
  modifier: string;
  unit_price: number;
  total_qty: number;
  total_value: number;
}

export function InvoiceSelectableList({
  invoiceIds,
  children,
}: InvoiceSelectableListProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [aggregated, setAggregated] = useState<AggregatedItem[]>([]);
  const [subtotal, setSubtotal] = useState(0);
  const [hstRate, setHstRate] = useState(0);
  const [hstAmount, setHstAmount] = useState(0);
  const [adFee, setAdFee] = useState(0);
  const [grandTotal, setGrandTotal] = useState(0);

  const toggleSelection = useCallback(
    (id: string) => {
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      });
    },
    [],
  );

  const selectAll = useCallback(() => {
    setSelected(new Set(invoiceIds));
  }, [invoiceIds]);

  const clearAll = useCallback(() => {
    setSelected(new Set());
    setAggregated([]);
  }, []);

  const fetchSummary = () => {
    const ids = Array.from(selected);
    if (ids.length < 2) return;

    startTransition(async () => {
      const [itemsResult, totalsResult] = await Promise.all([
        getInvoiceItemsForInvoices(ids),
        getInvoiceTotalsForInvoices(ids),
      ]);
      if (itemsResult.error || !itemsResult.data) return;

      const map = new Map<string, AggregatedItem>();

      for (const item of itemsResult.data as InvoiceItemRow[]) {
        const key = `${item.product_name}|${item.modifier}|${item.unit_price}`;
        const existing = map.get(key);
        const lineTotal = Number(item.line_total);

        if (existing) {
          existing.total_qty += item.quantity;
          existing.total_value += lineTotal;
        } else {
          map.set(key, {
            key,
            product_name: item.product_name,
            modifier: item.modifier,
            unit_price: Number(item.unit_price),
            total_qty: item.quantity,
            total_value: lineTotal,
          });
        }
      }

      setAggregated(Array.from(map.values()).sort((a, b) => a.product_name.localeCompare(b.product_name)));

      if (totalsResult.data) {
        setSubtotal(totalsResult.data.subtotal);
        setHstRate(totalsResult.data.tax_rate);
        setHstAmount(totalsResult.data.tax_amount);
        setAdFee(totalsResult.data.ad_royalties_fee);
        setGrandTotal(totalsResult.data.grand_total);
      }
    });
  };

  return (
    <div className="space-y-4">
      {invoiceIds.length > 1 && (
        <div className="flex items-center gap-3 text-sm">
          <Checkbox
            checked={selected.size === invoiceIds.length && invoiceIds.length > 0}
            onCheckedChange={(checked) => {
              if (checked) selectAll();
              else clearAll();
            }}
          />
          <span className="text-muted-foreground">
            {selected.size > 0
              ? `${selected.size} selected`
              : "Select invoices to compare"}
          </span>
          {selected.size >= 2 && (
            <Button
              variant="outline"
              size="sm"
              onClick={fetchSummary}
              disabled={isPending}
            >
              {isPending ? "Loading..." : "Show Summary"}
            </Button>
          )}
          {selected.size > 0 && (
            <Button variant="ghost" size="sm" onClick={clearAll}>
              Clear
            </Button>
          )}
        </div>
      )}

      {aggregated.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Aggregated Summary ({selected.size} invoices)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 font-medium">Product</th>
                    <th className="pb-2 font-medium">Modifier</th>
                    <th className="pb-2 font-medium text-right hidden sm:table-cell">Unit Price</th>
                    <th className="pb-2 font-medium text-right pr-4">Qty</th>
                    <th className="pb-2 font-medium text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {aggregated.map((item) => (
                    <tr key={item.key}>
                      <td className="py-2">{item.product_name}</td>
                      <td className="py-2 text-muted-foreground">
                        {item.modifier}
                      </td>
                      <td className="py-2 text-right hidden sm:table-cell">
                        {formatPrice(item.unit_price)}
                      </td>
                      <td className="py-2 text-right pr-4">{item.total_qty}</td>
                      <td className="py-2 text-right font-medium">
                        {formatPrice(item.total_value)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t">
                    <td colSpan={3} className="py-1.5 text-right text-muted-foreground sm:hidden">
                      Subtotal
                    </td>
                    <td colSpan={4} className="py-1.5 text-right text-muted-foreground hidden sm:table-cell">
                      Subtotal
                    </td>
                    <td className="py-1.5 text-right font-medium">
                      {formatPrice(subtotal)}
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={3} className="py-1.5 text-right text-muted-foreground sm:hidden">
                      HST ({(hstRate * 100).toFixed(0)}%)
                    </td>
                    <td colSpan={4} className="py-1.5 text-right text-muted-foreground hidden sm:table-cell">
                      HST ({(hstRate * 100).toFixed(0)}%)
                    </td>
                    <td className="py-1.5 text-right font-medium">
                      {formatPrice(hstAmount)}
                    </td>
                  </tr>
                  {adFee > 0 && (
                    <tr>
                      <td colSpan={3} className="py-1.5 text-right text-muted-foreground sm:hidden">
                        Ad &amp; Royalties Fee
                      </td>
                      <td colSpan={4} className="py-1.5 text-right text-muted-foreground hidden sm:table-cell">
                        Ad &amp; Royalties Fee
                      </td>
                      <td className="py-1.5 text-right font-medium">
                        {formatPrice(adFee)}
                      </td>
                    </tr>
                  )}
                  <tr className="border-t-2">
                    <td colSpan={3} className="py-2 text-right font-semibold sm:hidden">
                      Grand Total
                    </td>
                    <td colSpan={4} className="py-2 text-right font-semibold hidden sm:table-cell">
                      Grand Total
                    </td>
                    <td className="py-2 text-right font-bold">
                      {formatPrice(grandTotal)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {children({
        isSelected: (id) => selected.has(id),
        toggleSelection,
        selectAll,
        clearAll,
        selectedCount: selected.size,
      })}
    </div>
  );
}

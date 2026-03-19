import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { formatPrice } from "@/lib/utils";

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ "invoice-id": string }>;
}) {
  const { "invoice-id": invoiceId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Fetch invoice — RLS handles access control
  const { data: invoice } = await supabase
    .from("invoices")
    .select(
      "id, order_id, invoice_number, store_name, company_name, company_address, company_tax_id, subtotal, tax_rate, tax_amount, grand_total, created_at",
    )
    .eq("id", invoiceId)
    .single();

  if (!invoice) redirect("/invoices");

  // Fetch invoice items
  const { data: items } = await supabase
    .from("invoice_items")
    .select(
      "id, product_name, unit_of_measure, unit_price, quantity, line_total",
    )
    .eq("invoice_id", invoiceId);

  const invoiceItems = items ?? [];

  const dateFmt = new Intl.DateTimeFormat("en-CA", { dateStyle: "medium" });

  const taxRatePercent = Number(invoice.tax_rate) * 100;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <nav
        aria-label="Breadcrumb"
        className="text-sm flex items-center gap-1.5"
      >
        <Link
          href="/invoices"
          className="text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
        >
          <ArrowLeft className="size-3.5" />
          Invoices
        </Link>
        <span className="text-muted-foreground">/</span>
        <span className="font-medium">{invoice.invoice_number}</span>
      </nav>

      <Card>
        <CardContent className="pt-6 space-y-6">
          {/* Header */}
          <div className="flex justify-between items-start">
            <div>
              {invoice.company_name && (
                <h1 className="text-xl font-bold">{invoice.company_name}</h1>
              )}
              {invoice.company_address && (
                <p className="text-sm text-muted-foreground whitespace-pre-line">
                  {invoice.company_address}
                </p>
              )}
              {invoice.company_tax_id && (
                <p className="text-sm text-muted-foreground">
                  {invoice.company_tax_id}
                </p>
              )}
            </div>
            <div className="text-right">
              <h2 className="text-2xl font-bold">{invoice.invoice_number}</h2>
              <p className="text-sm text-muted-foreground">
                {dateFmt.format(new Date(invoice.created_at))}
              </p>
            </div>
          </div>

          {/* Bill To */}
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
              Bill To
            </p>
            <p className="font-medium">{invoice.store_name}</p>
          </div>

          {/* Items Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-2 font-medium">Product</th>
                  <th className="pb-2 font-medium">Unit</th>
                  <th className="pb-2 font-medium text-right">Unit Price</th>
                  <th className="pb-2 font-medium text-right">Qty</th>
                  <th className="pb-2 font-medium text-right">Line Total</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {invoiceItems.map((item) => (
                  <tr key={item.id}>
                    <td className="py-2">{item.product_name}</td>
                    <td className="py-2 text-muted-foreground">
                      {item.unit_of_measure}
                    </td>
                    <td className="py-2 text-right">
                      {formatPrice(Number(item.unit_price))}
                    </td>
                    <td className="py-2 text-right">{item.quantity}</td>
                    <td className="py-2 text-right font-medium">
                      {formatPrice(Number(item.line_total))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="border-t pt-4 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatPrice(Number(invoice.subtotal))}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                Tax ({taxRatePercent.toFixed(2)}%)
              </span>
              <span>{formatPrice(Number(invoice.tax_amount))}</span>
            </div>
            <div className="flex justify-between border-t pt-2 text-base font-bold">
              <span>Grand Total</span>
              <span>{formatPrice(Number(invoice.grand_total))}</span>
            </div>
          </div>

          {/* Back to Order */}
          <div className="pt-2">
            <Link
              href={`/orders/${invoice.order_id}`}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              &larr; Back to Order
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

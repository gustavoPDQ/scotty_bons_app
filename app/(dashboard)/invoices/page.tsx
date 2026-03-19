import Link from "next/link";
import { redirect } from "next/navigation";
import { FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { formatPrice } from "@/lib/utils";

const isValidDate = (d: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(d) && !isNaN(Date.parse(d));
const isValidUUID = (u: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(u);

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{
    store_id?: string;
    from?: string;
    to?: string;
  }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, store_id")
    .eq("user_id", user.id)
    .single();

  if (!profile) redirect("/login");

  const role = profile.role;
  const isStore = role === "store";

  // Build query with optional filters
  let query = supabase
    .from("invoices")
    .select(
      "id, invoice_number, order_id, store_id, grand_total, created_at",
    )
    .order("created_at", { ascending: false });

  // Apply filters (admin/factory only)
  if (!isStore) {
    if (params.store_id && isValidUUID(params.store_id)) {
      query = query.eq("store_id", params.store_id);
    }
  }
  if (params.from && isValidDate(params.from)) {
    query = query.gte("created_at", params.from);
  }
  if (params.to && isValidDate(params.to)) {
    query = query.lte("created_at", params.to + "T23:59:59.999Z");
  }

  const { data: invoices } = await query;
  const invoiceList = invoices ?? [];

  // Fetch store names
  const storeNames: Record<string, string> = {};
  if (!isStore && invoiceList.length > 0) {
    const storeIds = [...new Set(invoiceList.map((inv) => inv.store_id))];
    const { data: stores } = await supabase
      .from("stores")
      .select("id, name")
      .in("id", storeIds);
    if (stores) {
      for (const store of stores) {
        storeNames[store.id] = store.name;
      }
    }
  }
  if (isStore && profile.store_id) {
    const { data: store } = await supabase
      .from("stores")
      .select("name")
      .eq("id", profile.store_id)
      .single();
    if (store) storeNames[profile.store_id] = store.name;
  }

  // Fetch order dates
  const orderDates: Record<string, string> = {};
  if (invoiceList.length > 0) {
    const orderIds = [...new Set(invoiceList.map((inv) => inv.order_id))];
    const { data: orders } = await supabase
      .from("orders")
      .select("id, created_at")
      .in("id", orderIds);
    if (orders) {
      for (const order of orders) {
        orderDates[order.id] = order.created_at;
      }
    }
  }

  const dateFmt = new Intl.DateTimeFormat("en-CA", { dateStyle: "medium" });

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Invoices</h1>

      {invoiceList.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <FileText className="mx-auto size-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No invoices yet</h3>
            <p className="text-sm text-muted-foreground">
              Invoices are generated automatically when orders are fulfilled.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border divide-y">
          {invoiceList.map((invoice) => {
            const storeName =
              storeNames[invoice.store_id] ?? invoice.store_id.slice(0, 8);
            const orderDate = orderDates[invoice.order_id];
            return (
              <Link
                key={invoice.id}
                href={`/invoices/${invoice.id}`}
                className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-muted/50 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {invoice.invoice_number}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {storeName}
                    {orderDate
                      ? ` · Order: ${dateFmt.format(new Date(orderDate))}`
                      : ""}
                  </p>
                </div>
                <div className="flex items-center gap-4 shrink-0 text-sm">
                  <span className="font-medium">
                    {formatPrice(Number(invoice.grand_total))}
                  </span>
                  <span className="text-muted-foreground">
                    {dateFmt.format(new Date(invoice.created_at))}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

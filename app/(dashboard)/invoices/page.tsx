import { redirect } from "next/navigation";
import { FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getUser, getProfile } from "@/lib/supabase/auth-cache";
import { createPageTimer } from "@/lib/perf";
import { Card, CardContent } from "@/components/ui/card";
import { InvoiceFilters } from "@/components/invoices/invoice-filters";
import { InvoiceListWithSelection } from "@/components/invoices/invoice-list-with-selection";

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
    q?: string;
  }>;
}) {
  const timer = createPageTimer("Invoices");
  const params = await searchParams;

  const user = await timer.time("auth.getUser(cached)", () => getUser());
  if (!user) redirect("/login");

  const profile = await timer.time("profiles.select(cached)", () => getProfile());
  if (!profile) redirect("/login");

  const supabase = await createClient();

  const role = profile.role;
  const isStore = role === "store";

  // Build invoices query with optional filters
  let query = supabase
    .from("invoices")
    .select(
      "id, invoice_number, order_id, store_id, grand_total, created_at",
    )
    .order("created_at", { ascending: false });

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
  if (params.q && params.q.length <= 100) {
    query = query.ilike("invoice_number", `%${params.q}%`);
  }

  // Fetch invoices + all stores in parallel
  const [invoicesRes, allStoresRes] = await timer.time("invoices+stores(parallel)", () =>
    Promise.all([
      query,
      !isStore
        ? supabase.from("stores").select("id, name").order("name")
        : isStore && profile.store_id
          ? supabase.from("stores").select("id, name").eq("id", profile.store_id)
          : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    ])
  );

  const invoiceList = invoicesRes.data ?? [];
  const allStores = allStoresRes.data ?? [];

  // Build store name map from single stores query
  const storeNames: Record<string, string> = {};
  for (const store of allStores) {
    storeNames[store.id] = store.name;
  }

  // Fetch order dates
  const orderDates: Record<string, string> = {};
  if (invoiceList.length > 0) {
    const orderIds = [...new Set(invoiceList.map((inv) => inv.order_id))];
    const { data: orders } = await timer.time("orders.dates", () =>
      supabase
        .from("orders")
        .select("id, created_at")
        .in("id", orderIds)
    );
    if (orders) {
      for (const order of orders) {
        orderDates[order.id] = order.created_at;
      }
    }
  }

  timer.summary();

  // Prepare serializable invoice data for client component
  const invoiceData = invoiceList.map((invoice) => ({
    id: invoice.id,
    invoice_number: invoice.invoice_number,
    store_id: invoice.store_id,
    store_name: storeNames[invoice.store_id] ?? invoice.store_id.slice(0, 8),
    order_date: orderDates[invoice.order_id] ?? undefined,
    grand_total: Number(invoice.grand_total),
    created_at: invoice.created_at,
  }));

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <h1 className="text-xl font-bold">Invoices</h1>

      <InvoiceFilters role={role} stores={allStores} />

      {invoiceList.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="flex size-16 mx-auto items-center justify-center rounded-full bg-primary-light mb-4">
              <FileText className="size-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No invoices yet</h3>
            <p className="text-sm text-muted-foreground">
              Invoices are generated automatically when orders are fulfilled.
            </p>
          </CardContent>
        </Card>
      ) : (
        <InvoiceListWithSelection invoices={invoiceData} />
      )}
    </div>
  );
}

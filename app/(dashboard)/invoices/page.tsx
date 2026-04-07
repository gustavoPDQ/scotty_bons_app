import { redirect } from "next/navigation";
import { FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getUser, getProfile } from "@/lib/supabase/auth-cache";
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
  const params = await searchParams;

  const user = await getUser();
  if (!user) redirect("/login");

  const profile = await getProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();

  const role = profile.role;
  const isStore = role === "store";

  // Fetch stores for filter dropdown (admin/commissary only)
  let allStores: { id: string; name: string }[] = [];
  if (!isStore) {
    const { data: storesData } = await supabase
      .from("stores")
      .select("id, name")
      .order("name");
    allStores = storesData ?? [];
  }

  // Build query with optional filters
  let query = supabase
    .from("invoices")
    .select(
      "id, invoice_number, order_id, store_id, grand_total, created_at",
    )
    .order("created_at", { ascending: false });

  // Apply filters (admin/commissary only)
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

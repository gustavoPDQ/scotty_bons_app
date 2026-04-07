import Link from "next/link";
import { redirect } from "next/navigation";
import { Package, Plus, Search, ShoppingCart } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getUser, getProfile } from "@/lib/supabase/auth-cache";
import { createPageTimer } from "@/lib/perf";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { OrderStatus } from "@/lib/types";
import { RealtimeOrderList } from "@/components/orders/realtime-order-list";
import { OrderFilters } from "@/components/orders/order-filters";
import { OrderListWithSelection } from "@/components/orders/order-list-with-selection";

const VALID_STATUSES: OrderStatus[] = [
  "submitted",
  "approved",
  "declined",
  "fulfilled",
];

const isValidDate = (d: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(d) && !isNaN(Date.parse(d));
const isValidUUID = (u: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(u);

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    from?: string;
    to?: string;
    q?: string;
    store_id?: string;
  }>;
}) {
  const timer = createPageTimer("Orders");
  const params = await searchParams;

  const user = await timer.time("auth.getUser(cached)", () => getUser());
  if (!user) redirect("/login");

  const profile = await timer.time("profiles.select(cached)", () => getProfile());
  if (!profile) redirect("/login");

  const supabase = await createClient();

  const role = profile.role;
  const isStore = role === "store";

  // Validate search params
  const statusFilter = VALID_STATUSES.includes(params.status as OrderStatus)
    ? params.status
    : undefined;
  const fromFilter =
    params.from && isValidDate(params.from) ? params.from : undefined;
  const toFilter =
    params.to && isValidDate(params.to) ? params.to : undefined;
  const storeFilter =
    !isStore && params.store_id && isValidUUID(params.store_id)
      ? params.store_id
      : undefined;
  const textFilter = params.q?.trim().slice(0, 100) || undefined;

  const hasActiveFilters = !!(
    statusFilter ||
    fromFilter ||
    toFilter ||
    storeFilter ||
    textFilter
  );

  // Build filtered query
  let query = supabase
    .from("orders")
    .select("id, order_number, store_id, submitted_by, status, created_at, updated_at")
    .order("created_at", { ascending: false });

  if (statusFilter) {
    query = query.eq("status", statusFilter);
  }
  if (fromFilter) {
    query = query.gte("created_at", fromFilter);
  }
  if (toFilter) {
    query = query.lte("created_at", toFilter + "T23:59:59.999Z");
  }
  if (storeFilter) {
    query = query.eq("store_id", storeFilter);
  }

  const { data: ordersRaw } = await timer.time("orders.select", () => query);

  // Fetch item counts and totals per order
  let orders = ordersRaw ?? [];
  const orderIds = orders.map((o) => o.id);

  const itemSummaries: Record<string, { count: number; total: number }> = {};
  if (orderIds.length > 0) {
    const { data: items } = await timer.time("order_items.select", () =>
      supabase
        .from("order_items")
        .select("order_id, unit_price, quantity")
        .in("order_id", orderIds)
    );

    if (items) {
      for (const item of items) {
        const existing = itemSummaries[item.order_id] ?? {
          count: 0,
          total: 0,
        };
        existing.count += item.quantity;
        existing.total += Number(item.unit_price) * item.quantity;
        itemSummaries[item.order_id] = existing;
      }
    }
  }

  // For admin/commissary roles, fetch store names to display on each order
  const storeNames: Record<string, string> = {};
  if (!isStore && orders.length > 0) {
    const storeIds = [...new Set(orders.map((o) => o.store_id))];
    const { data: stores } = await timer.time("stores.byOrders", () =>
      supabase
        .from("stores")
        .select("id, name")
        .in("id", storeIds)
    );

    if (stores) {
      for (const store of stores) {
        storeNames[store.id] = store.name;
      }
    }
  }

  // Apply text search post-filter
  if (textFilter) {
    const q = textFilter.toLowerCase();
    orders = orders.filter(
      (o) =>
        o.id.toLowerCase().startsWith(q) ||
        (o.order_number ?? "").toLowerCase().includes(q) ||
        (storeNames[o.store_id] ?? "").toLowerCase().includes(q),
    );
  }

  // Fetch all stores for the filter dropdown (admin/commissary only)
  let allStores: { id: string; name: string }[] = [];
  if (!isStore) {
    const { data: storesData } = await timer.time("stores.allForFilter", () =>
      supabase
        .from("stores")
        .select("id, name")
        .order("name")
    );
    allStores = storesData ?? [];
  }

  timer.summary();

  // Prepare serializable order data for client component
  const orderData = orders.map((order) => ({
    id: order.id,
    order_number: order.order_number,
    store_id: order.store_id,
    status: order.status as OrderStatus,
    created_at: order.created_at,
    item_count: itemSummaries[order.id]?.count ?? 0,
    total: itemSummaries[order.id]?.total ?? 0,
    store_name: storeNames[order.store_id] ?? undefined,
  }));

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* CTA hero for store users */}
      {isStore && (
        <Link href="/orders/new" className="block">
          <Card className="bg-primary border-0 text-white overflow-hidden hover:bg-primary/90 transition-colors shadow-lg">
            <CardContent className="flex items-center justify-between p-5">
              <div>
                <h2 className="text-lg font-bold">Place a new order</h2>
                <p className="text-sm text-white/80">Restock your inventory</p>
              </div>
              <div className="flex size-12 items-center justify-center rounded-xl bg-white/20">
                <ShoppingCart className="size-6" />
              </div>
            </CardContent>
          </Card>
        </Link>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">
          {isStore ? "Recent Orders" : "Orders"}
        </h1>
        {role === "admin" && (
          <Button asChild size="sm">
            <Link href="/orders/new">
              <Plus className="size-4 mr-1.5" />
              New Order
            </Link>
          </Button>
        )}
      </div>

      <OrderFilters
        role={role as "admin" | "commissary" | "store"}
        stores={allStores}
      />

      {orders.length === 0 && hasActiveFilters ? (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="flex size-16 mx-auto items-center justify-center rounded-full bg-primary-light mb-4">
              <Search className="size-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">
              No orders match your filters
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Try adjusting your filters or clear them to see all orders.
            </p>
            <Button variant="outline" asChild>
              <Link href="/orders">Clear filters</Link>
            </Button>
          </CardContent>
        </Card>
      ) : orders.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="flex size-16 mx-auto items-center justify-center rounded-full bg-primary-light mb-4">
              <Package className="size-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No orders yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {isStore
                ? "Create your first supply order to get started."
                : "No orders have been submitted yet."}
            </p>
            {isStore && (
              <Button asChild>
                <Link href="/orders/new">New Order</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        (() => {
          const content = (
            <OrderListWithSelection orders={orderData} />
          );

          return role === "admin" || role === "commissary" ? (
            <RealtimeOrderList>{content}</RealtimeOrderList>
          ) : (
            content
          );
        })()
      )}
    </div>
  );
}

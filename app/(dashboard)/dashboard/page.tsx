import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Package,
  Clock,
  CheckCircle,
  DollarSign,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/lib/utils";
import { STATUS_STYLES, STATUS_LABELS } from "@/lib/constants/order-status";
import type { OrderStatus } from "@/lib/types";

const ALL_STATUSES: OrderStatus[] = [
  "submitted",
  "approved",
  "declined",
  "fulfilled",
];

export default async function DashboardPage() {
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

  if (!profile || profile.role !== "admin") redirect("/orders");

  // Fetch data in parallel
  const [ordersResult, itemsResult, storesResult] = await Promise.all([
    supabase
      .from("orders")
      .select("id, store_id, status, created_at")
      .order("created_at", { ascending: false }),
    supabase.from("order_items").select("order_id, unit_price, quantity"),
    supabase.from("stores").select("id, name"),
  ]);

  const orders = ordersResult.data ?? [];
  const items = itemsResult.data ?? [];
  const stores = storesResult.data ?? [];

  // Build store name map
  const storeNameMap: Record<string, string> = {};
  for (const store of stores) {
    storeNameMap[store.id] = store.name;
  }

  // Build order totals map
  const orderTotals: Record<string, number> = {};
  for (const item of items) {
    orderTotals[item.order_id] =
      (orderTotals[item.order_id] ?? 0) +
      Number(item.unit_price) * item.quantity;
  }

  // Summary card aggregates
  const totalOrders = orders.length;
  const pendingOrders = orders.filter(
    (o) => o.status === "submitted" || o.status === "under_review",
  ).length;
  const approvedOrders = orders.filter((o) => o.status === "approved").length;
  const totalRevenue = orders
    .filter((o) => o.status === "approved" || o.status === "fulfilled")
    .reduce((sum, o) => sum + (orderTotals[o.id] ?? 0), 0);

  // Orders by status
  const statusCounts: Record<OrderStatus, number> = {
    submitted: 0,
    approved: 0,
    declined: 0,
    fulfilled: 0,
  };
  for (const order of orders) {
    const s = order.status as OrderStatus;
    if (s in statusCounts) statusCounts[s]++;
  }

  // Orders by store
  const storeAgg: Record<string, { count: number; total: number }> = {};
  for (const order of orders) {
    const existing = storeAgg[order.store_id] ?? { count: 0, total: 0 };
    existing.count++;
    existing.total += orderTotals[order.id] ?? 0;
    storeAgg[order.store_id] = existing;
  }

  // Recent orders (first 5)
  const recentOrders = orders.slice(0, 5);

  const dateFmt = new Intl.DateTimeFormat("en-CA", { dateStyle: "medium" });

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
            <Package className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalOrders}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Pending Orders
            </CardTitle>
            <Clock className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingOrders}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Approved Orders
            </CardTitle>
            <CheckCircle className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{approvedOrders}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Total Revenue
            </CardTitle>
            <DollarSign className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPrice(totalRevenue)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Orders by Status */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Orders by Status</h2>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {ALL_STATUSES.map((status) => (
            <Card key={status}>
              <CardContent className="p-4 flex items-center gap-3">
                <Badge variant="status" style={STATUS_STYLES[status]}>
                  {STATUS_LABELS[status]}
                </Badge>
                <span className="text-xl font-bold ml-auto">
                  {statusCounts[status]}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Orders by Store */}
      {Object.keys(storeAgg).length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Orders by Store</h2>
          <Card>
            <div className="divide-y">
              {Object.entries(storeAgg)
                .sort(([, a], [, b]) => b.count - a.count)
                .map(([storeId, agg]) => (
                  <div
                    key={storeId}
                    className="flex items-center justify-between px-4 py-3"
                  >
                    <span className="text-sm font-medium">
                      {storeNameMap[storeId] ?? storeId.slice(0, 8)}
                    </span>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-muted-foreground">
                        {agg.count} {agg.count === 1 ? "order" : "orders"}
                      </span>
                      <span className="font-medium">
                        {formatPrice(agg.total)}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          </Card>
        </div>
      )}

      {/* Recent Orders */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Recent Orders</h2>
        {recentOrders.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              No orders yet.
            </CardContent>
          </Card>
        ) : (
          <Card>
            <div className="divide-y">
              {recentOrders.map((order) => {
                const status = order.status as OrderStatus;
                return (
                  <Link
                    key={order.id}
                    href={`/orders/${order.id}`}
                    className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-muted/50 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        Order {order.id.slice(0, 8)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {dateFmt.format(new Date(order.created_at))}
                        {storeNameMap[order.store_id]
                          ? ` · ${storeNameMap[order.store_id]}`
                          : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-sm font-medium">
                        {formatPrice(orderTotals[order.id] ?? 0)}
                      </span>
                      <Badge variant="status" style={STATUS_STYLES[status]}>
                        {STATUS_LABELS[status]}
                      </Badge>
                    </div>
                  </Link>
                );
              })}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

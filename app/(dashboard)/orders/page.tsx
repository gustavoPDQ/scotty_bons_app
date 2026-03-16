import Link from "next/link";
import { redirect } from "next/navigation";
import { Package, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/lib/utils";
import type { OrderStatus } from "@/lib/types";

const STATUS_COLORS: Record<OrderStatus, string> = {
  submitted: "bg-gray-500 text-white",
  under_review: "bg-amber-500 text-white",
  approved: "bg-green-600 text-white",
  declined: "bg-red-600 text-white",
  fulfilled: "bg-blue-600 text-white",
};

const STATUS_LABELS: Record<OrderStatus, string> = {
  submitted: "Submitted",
  under_review: "Under Review",
  approved: "Approved",
  declined: "Declined",
  fulfilled: "Fulfilled",
};

export default async function OrdersPage() {
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

  const role = profile?.role ?? "store";
  const isStore = role === "store";

  // Fetch orders — RLS handles store_id filtering for store users,
  // and returns all for admin/factory
  const { data: ordersRaw } = await supabase
    .from("orders")
    .select("id, store_id, submitted_by, status, created_at, updated_at")
    .order("created_at", { ascending: false });

  // Fetch item counts and totals per order
  const orders = ordersRaw ?? [];
  const orderIds = orders.map((o) => o.id);

  const itemSummaries: Record<string, { count: number; total: number }> = {};
  if (orderIds.length > 0) {
    const { data: items } = await supabase
      .from("order_items")
      .select("order_id, unit_price, quantity")
      .in("order_id", orderIds);

    if (items) {
      for (const item of items) {
        const existing = itemSummaries[item.order_id] ?? { count: 0, total: 0 };
        existing.count += item.quantity;
        existing.total += Number(item.unit_price) * item.quantity;
        itemSummaries[item.order_id] = existing;
      }
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Orders</h1>
        {isStore && (
          <Button asChild>
            <Link href="/orders/new">
              <Plus className="size-4 mr-2" />
              New Order
            </Link>
          </Button>
        )}
      </div>

      {orders.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Package className="mx-auto size-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No orders yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {isStore
                ? "Create your first supply order to get started."
                : "No orders have been submitted yet."}
            </p>
            {isStore && (
              <Button asChild>
                <Link href="/orders/new">Create your first order</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border divide-y">
          {orders.map((order) => {
            const status = order.status as OrderStatus;
            const summary = itemSummaries[order.id];
            return (
              <div
                key={order.id}
                className="flex items-center justify-between gap-4 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    Order {order.id.slice(0, 8)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Intl.DateTimeFormat("en-CA", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(order.created_at))}
                    {summary
                      ? ` · ${summary.count} ${summary.count === 1 ? "item" : "items"}`
                      : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {summary && (
                    <span className="text-sm font-medium">
                      {formatPrice(summary.total)}
                    </span>
                  )}
                  <Badge className={STATUS_COLORS[status]}>
                    {STATUS_LABELS[status]}
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

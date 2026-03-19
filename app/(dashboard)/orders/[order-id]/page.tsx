import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Clock, AlertCircle, FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPrice } from "@/lib/utils";
import { STATUS_COLORS, STATUS_LABELS } from "@/lib/constants/order-status";
import type { OrderStatus } from "@/lib/types";
import { OrderStatusActions } from "@/components/orders/order-status-actions";
import { DeleteOrderButton } from "@/components/orders/delete-order-button";
import { FulfillOrderButton } from "@/components/orders/fulfill-order-button";

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ "order-id": string }>;
}) {
  const { "order-id": orderId } = await params;
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

  // Fetch order — RLS handles store isolation
  const { data: order } = await supabase
    .from("orders")
    .select(
      "id, store_id, submitted_by, status, decline_reason, fulfilled_at, created_at, updated_at"
    )
    .eq("id", orderId)
    .single();

  // RLS denied or not found → redirect
  if (!order) redirect("/orders");

  // Fetch order items
  const { data: items } = await supabase
    .from("order_items")
    .select("id, product_name, unit_of_measure, unit_price, quantity")
    .eq("order_id", orderId)
    .order("created_at");

  // Fetch status history
  const { data: history } = await supabase
    .from("order_status_history")
    .select("id, status, changed_by, changed_at")
    .eq("order_id", orderId)
    .order("changed_at", { ascending: true });

  // For admin/factory: fetch submitter name and store name
  const isAdmin = profile.role === "admin" || profile.role === "factory";
  let submitterName: string | null = null;
  let storeName: string | null = null;

  if (isAdmin) {
    const [{ data: submitter }, { data: store }] = await Promise.all([
      supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", order.submitted_by)
        .single(),
      supabase
        .from("stores")
        .select("name")
        .eq("id", order.store_id)
        .single(),
    ]);
    submitterName = submitter?.full_name ?? null;
    storeName = store?.name ?? null;
  }

  const orderItems = items ?? [];
  const statusHistory = history ?? [];
  const status = order.status as OrderStatus;

  // Check for linked invoice if fulfilled
  let invoiceId: string | null = null;
  if (status === "fulfilled") {
    const { data: invoice } = await supabase
      .from("invoices")
      .select("id")
      .eq("order_id", order.id)
      .single();
    invoiceId = invoice?.id ?? null;
  }

  // Calculate order total from items
  const orderTotal = orderItems.reduce(
    (sum, item) => sum + Number(item.unit_price) * item.quantity,
    0
  );

  const formatDate = (timestamp: string) =>
    new Intl.DateTimeFormat("en-CA", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(timestamp));

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <nav
        aria-label="Breadcrumb"
        className="text-sm flex items-center gap-1.5"
      >
        <Link
          href="/orders"
          className="text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
        >
          <ArrowLeft className="size-3.5" />
          Orders
        </Link>
        <span className="text-muted-foreground">/</span>
        <span className="font-medium">Order #{order.id.slice(0, 8)}</span>
      </nav>

      {/* Order header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Order #{order.id.slice(0, 8)}</h1>
        <div className="flex items-center gap-3">
          <Badge className={STATUS_COLORS[status]}>{STATUS_LABELS[status]}</Badge>
          <OrderStatusActions
            orderId={order.id}
            currentStatus={status}
            role={profile.role}
          />
          <DeleteOrderButton
            orderId={order.id}
            currentStatus={status}
            role={profile.role}
          />
          <FulfillOrderButton
            orderId={order.id}
            currentStatus={status}
            role={profile.role}
          />
          {invoiceId && (
            <Link href={`/invoices/${invoiceId}`}>
              <Button variant="outline" size="sm">
                <FileText className="size-4 mr-1.5" />
                View Invoice
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Order metadata */}
      <Card>
        <CardContent className="pt-6">
          <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-muted-foreground">Submitted</dt>
              <dd className="font-medium">{formatDate(order.created_at)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Last Updated</dt>
              <dd className="font-medium">{formatDate(order.updated_at)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Items</dt>
              <dd className="font-medium">{orderItems.length}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Total</dt>
              <dd className="font-medium text-lg">{formatPrice(orderTotal)}</dd>
            </div>
            {storeName && (
              <div>
                <dt className="text-muted-foreground">Store</dt>
                <dd className="font-medium">{storeName}</dd>
              </div>
            )}
            {submitterName && (
              <div>
                <dt className="text-muted-foreground">Submitted by</dt>
                <dd className="font-medium">{submitterName}</dd>
              </div>
            )}
            {order.fulfilled_at && (
              <div>
                <dt className="text-muted-foreground">Fulfilled</dt>
                <dd className="font-medium">{formatDate(order.fulfilled_at)}</dd>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>

      {/* Decline reason callout */}
      {status === "declined" && order.decline_reason && (
        <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950">
          <CardContent className="pt-6 flex items-start gap-3">
            <AlertCircle className="size-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-red-800 dark:text-red-200">
                Reason for Decline
              </p>
              <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                {order.decline_reason}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Items table */}
      <Card>
        <CardHeader>
          <CardTitle>Order Items</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-2 font-medium">Product Name</th>
                  <th className="pb-2 font-medium">Unit</th>
                  <th className="pb-2 font-medium text-right">Unit Price</th>
                  <th className="pb-2 font-medium text-right">Qty</th>
                  <th className="pb-2 font-medium text-right">Line Total</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {orderItems.map((item) => {
                  const lineTotal = Number(item.unit_price) * item.quantity;
                  return (
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
                        {formatPrice(lineTotal)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2">
                  <td colSpan={4} className="py-2 text-right font-semibold">
                    Order Total
                  </td>
                  <td className="py-2 text-right font-bold text-lg">
                    {formatPrice(orderTotal)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Status history timeline */}
      {statusHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="size-4" />
              Status History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="relative border-l border-muted-foreground/25 ml-3 space-y-4">
              {statusHistory.map((entry) => {
                const entryStatus = entry.status as OrderStatus;
                return (
                  <li key={entry.id} className="ml-6">
                    <span className="absolute -left-1.5 mt-1.5 size-3 rounded-full border-2 border-background bg-muted-foreground/50" />
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        className={`${STATUS_COLORS[entryStatus]} text-xs`}
                      >
                        {STATUS_LABELS[entryStatus]}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(entry.changed_at)}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ol>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

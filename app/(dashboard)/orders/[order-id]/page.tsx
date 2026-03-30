import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Clock, AlertCircle, FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPrice } from "@/lib/utils";
import { STATUS_STYLES, STATUS_LABELS } from "@/lib/constants/order-status";
import type { OrderStatus } from "@/lib/types";
import { OrderStatusActions } from "@/components/orders/order-status-actions";
import { DeleteOrderButton } from "@/components/orders/delete-order-button";
import { EditOrderButton } from "@/components/orders/edit-order-button";
import { FulfillOrderButton } from "@/components/orders/fulfill-order-button";
import { ExportOrderPdfButton } from "@/components/orders/export-order-pdf-button";

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
      "id, order_number, store_id, submitted_by, status, decline_reason, fulfilled_at, created_at, updated_at"
    )
    .eq("id", orderId)
    .single();

  // RLS denied or not found → redirect
  if (!order) redirect("/orders");

  // Fetch order items
  const { data: items } = await supabase
    .from("order_items")
    .select("id, product_name, modifier, unit_price, quantity")
    .eq("order_id", orderId)
    .order("created_at");

  // Fetch status history
  const { data: history } = await supabase
    .from("order_status_history")
    .select("id, status, changed_by, changed_at")
    .eq("order_id", orderId)
    .order("changed_at", { ascending: true });

  // Resolve names for status history changed_by users
  const changedByMap: Record<string, string> = {};
  if (history && history.length > 0) {
    const uniqueUserIds = [...new Set(history.map((h) => h.changed_by))];
    const adminClient = createAdminClient();
    const results = await Promise.all(
      uniqueUserIds.map((uid) => adminClient.auth.admin.getUserById(uid))
    );
    for (const { data } of results) {
      if (data?.user) {
        const name =
          (data.user.user_metadata?.name as string | undefined) ??
          data.user.email ??
          "";
        if (name) changedByMap[data.user.id] = name;
      }
    }
  }

  // Fetch store name for all roles (needed for PDF export)
  const isAdmin = profile.role === "admin" || profile.role === "commissary";
  let submitterName: string | null = null;

  const { data: storeRow } = await supabase
    .from("stores")
    .select("name")
    .eq("id", order.store_id)
    .single();
  const storeName = storeRow?.name ?? null;

  if (isAdmin) {
    const adminClient = createAdminClient();
    const { data: submitterAuth } = await adminClient.auth.admin.getUserById(order.submitted_by);
    submitterName =
      (submitterAuth?.user?.user_metadata?.name as string | undefined) ??
      submitterAuth?.user?.email ??
      null;
  }

  const orderItems = items ?? [];
  const statusHistory = history ?? [];
  const status = order.status as OrderStatus;

  // Check for linked invoice (fulfilled orders have invoices)
  let invoiceId: string | null = null;
  const { data: invoice } = await supabase
    .from("invoices")
    .select("id")
    .eq("order_id", order.id)
    .maybeSingle();
  invoiceId = invoice?.id ?? null;

  // Fetch financial settings for tax/fee calculation
  const { data: financialSettings } = await supabase
    .from("financial_settings")
    .select("key, value")
    .in("key", ["hst_rate", "ad_royalties_fee"]);

  const fsMap: Record<string, string> = {};
  for (const row of financialSettings ?? []) fsMap[row.key] = row.value;

  const hstRate = Number(fsMap.hst_rate ?? "13") / 100;
  const adRoyaltiesFee = Number(fsMap.ad_royalties_fee ?? "0");

  // Calculate order total from items
  const subtotal = orderItems.reduce(
    (sum, item) => sum + Number(item.unit_price) * item.quantity,
    0
  );
  const taxAmount = subtotal * hstRate;
  const grandTotal = subtotal + taxAmount + adRoyaltiesFee;
  const orderTotal = subtotal;

  const formatDate = (timestamp: string) =>
    new Intl.DateTimeFormat("en-CA", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(timestamp));

  return (
    <div className="max-w-4xl mx-auto space-y-6">
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
        <span className="font-medium">{order.order_number}</span>
      </nav>

      {/* Order header */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">{order.order_number}</h1>
          <Badge variant="status" style={STATUS_STYLES[status]}>{STATUS_LABELS[status]}</Badge>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Primary workflow actions */}
          <OrderStatusActions
            orderId={order.id}
            currentStatus={status}
            role={profile.role}
          />
          <FulfillOrderButton
            orderId={order.id}
            currentStatus={status}
            role={profile.role}
          />

          {/* Secondary actions — separated visually */}
          <div className="h-6 w-px bg-border mx-1 hidden sm:block" />

          <EditOrderButton
            orderId={order.id}
            currentStatus={status}
            role={profile.role}
          />
          <ExportOrderPdfButton
            order={{ id: order.id, order_number: order.order_number, status: order.status, created_at: order.created_at }}
            items={orderItems.map((i) => ({
              product_name: i.product_name,
              modifier: i.modifier,
              quantity: i.quantity,
              unit_price: Number(i.unit_price),
            }))}
            storeName={storeName ?? "Store"}
          />
          {invoiceId && (
            <Link href={`/invoices/${invoiceId}`}>
              <Button variant="outline" size="sm">
                <FileText className="size-4 mr-1.5" />
                View Invoice
              </Button>
            </Link>
          )}

          {/* Destructive action — pushed to the end */}
          <div className="sm:ml-auto">
            <DeleteOrderButton
              orderId={order.id}
              currentStatus={status}
              role={profile.role}
              hasInvoice={!!invoiceId}
            />
          </div>
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
              <dd className="font-medium text-lg">{formatPrice(grandTotal)}</dd>
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
                  <th className="pb-2 font-medium">Product</th>
                  <th className="pb-2 font-medium">Modifier</th>
                  <th className="pb-2 font-medium text-right hidden sm:table-cell">Unit Price</th>
                  <th className="pb-2 font-medium text-right pr-4">Qty</th>
                  <th className="pb-2 font-medium text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {orderItems.map((item) => {
                  const lineTotal = Number(item.unit_price) * item.quantity;
                  return (
                    <tr key={item.id}>
                      <td className="py-2">{item.product_name}</td>
                      <td className="py-2 text-muted-foreground">
                        {item.modifier}
                      </td>
                      <td className="py-2 text-right hidden sm:table-cell">
                        {formatPrice(Number(item.unit_price))}
                      </td>
                      <td className="py-2 text-right pr-4">{item.quantity}</td>
                      <td className="py-2 text-right font-medium">
                        {formatPrice(lineTotal)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t">
                  <td colSpan={3} className="py-1.5 text-right text-muted-foreground sm:hidden">
                    Subtotal
                  </td>
                  <td colSpan={4} className="py-1.5 text-right text-muted-foreground hidden sm:table-cell">
                    Subtotal
                  </td>
                  <td className="py-1.5 text-right">
                    {formatPrice(subtotal)}
                  </td>
                </tr>
                <tr>
                  <td colSpan={3} className="py-1.5 text-right text-muted-foreground sm:hidden">
                    HST ({(hstRate * 100).toFixed(2)}%)
                  </td>
                  <td colSpan={4} className="py-1.5 text-right text-muted-foreground hidden sm:table-cell">
                    HST ({(hstRate * 100).toFixed(2)}%)
                  </td>
                  <td className="py-1.5 text-right">
                    {formatPrice(taxAmount)}
                  </td>
                </tr>
                {adRoyaltiesFee > 0 && (
                  <tr>
                    <td colSpan={3} className="py-1.5 text-right text-muted-foreground sm:hidden">
                      Ad & Royalties Fee
                    </td>
                    <td colSpan={4} className="py-1.5 text-right text-muted-foreground hidden sm:table-cell">
                      Ad & Royalties Fee
                    </td>
                    <td className="py-1.5 text-right">
                      {formatPrice(adRoyaltiesFee)}
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
                  <td className="py-2 text-right font-bold text-lg">
                    {formatPrice(grandTotal)}
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
                        variant="status"
                        style={STATUS_STYLES[entryStatus]}
                        className="text-xs"
                      >
                        {STATUS_LABELS[entryStatus]}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(entry.changed_at)}
                      </span>
                      {changedByMap[entry.changed_by] && (
                        <span className="text-xs text-muted-foreground">
                          by {changedByMap[entry.changed_by]}
                        </span>
                      )}
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

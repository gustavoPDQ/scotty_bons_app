"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { formatPrice } from "@/lib/utils";
import { STATUS_STYLES, STATUS_LABELS } from "@/lib/constants/order-status";
import type { OrderStatus } from "@/lib/types";
import { OrderSelectableList } from "@/components/orders/order-selection-summary";
import { Package, ChevronRight } from "lucide-react";

interface OrderData {
  id: string;
  order_number: string;
  store_id: string;
  status: OrderStatus;
  created_at: string;
  item_count: number;
  total: number;
  store_name?: string;
}

interface OrderListWithSelectionProps {
  orders: OrderData[];
}

export function OrderListWithSelection({ orders }: OrderListWithSelectionProps) {
  const orderIds = orders.map((o) => o.id);

  return (
    <OrderSelectableList orderIds={orderIds}>
      {({ isSelected, toggleSelection }) => (
        <div className="space-y-3">
          {orders.map((order) => {
            const status = order.status;
            return (
              <Card
                key={order.id}
                className="overflow-hidden hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-3">
                  {orderIds.length > 1 && (
                    <div
                      className="pl-4 py-4 flex items-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Checkbox
                        checked={isSelected(order.id)}
                        onCheckedChange={() => toggleSelection(order.id)}
                      />
                    </div>
                  )}
                  <Link
                    href={`/orders/${order.id}`}
                    className="flex flex-1 items-center gap-3 px-4 py-4 min-w-0"
                  >
                    {/* Orange icon — hidden on small screens */}
                    <div className="hidden sm:flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-light">
                      <Package className="size-5 text-primary" />
                    </div>

                    {/* Order info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <p className="text-sm font-semibold">
                          {order.order_number}
                        </p>
                        <Badge variant="status" style={STATUS_STYLES[status]}>
                          {STATUS_LABELS[status]}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {new Intl.DateTimeFormat("en-CA", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        }).format(new Date(order.created_at))}
                        {order.store_name ? ` · ${order.store_name}` : ""}
                      </p>
                    </div>

                    {/* Right side: total + arrow */}
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        {order.total > 0 && (
                          <p className="text-sm font-semibold">{formatPrice(order.total)}</p>
                        )}
                        {order.item_count > 0 && (
                          <p className="text-xs text-muted-foreground">
                            {order.item_count} {order.item_count === 1 ? "item" : "items"}
                          </p>
                        )}
                      </div>
                      <ChevronRight className="size-4 text-muted-foreground" />
                    </div>
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </OrderSelectableList>
  );
}

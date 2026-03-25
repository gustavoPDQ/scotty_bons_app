"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { formatPrice } from "@/lib/utils";
import { STATUS_STYLES, STATUS_LABELS, STATUS_BORDER_COLORS } from "@/lib/constants/order-status";
import type { OrderStatus } from "@/lib/types";
import { OrderSelectableList } from "@/components/orders/order-selection-summary";

interface OrderData {
  id: string;
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
        <Card className="divide-y">
          {orders.map((order) => {
            const status = order.status;
            return (
              <div
                key={order.id}
                className={`flex items-center gap-2 border-l-4 ${STATUS_BORDER_COLORS[status]} hover:bg-muted/50 transition-colors`}
              >
                {orderIds.length > 1 && (
                  <div
                    className="pl-3 py-3 flex items-center"
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
                  className="flex flex-1 items-center justify-between gap-4 px-4 py-3"
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
                      {order.item_count > 0
                        ? ` · ${order.item_count} ${order.item_count === 1 ? "item" : "items"}`
                        : ""}
                      {order.store_name ? ` · ${order.store_name}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {order.total > 0 && (
                      <span className="text-sm font-medium">
                        {formatPrice(order.total)}
                      </span>
                    )}
                    <Badge variant="status" style={STATUS_STYLES[status]}>
                      {STATUS_LABELS[status]}
                    </Badge>
                  </div>
                </Link>
              </div>
            );
          })}
        </Card>
      )}
    </OrderSelectableList>
  );
}

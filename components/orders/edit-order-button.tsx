"use client";

import Link from "next/link";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { OrderStatus } from "@/lib/types";

interface EditOrderButtonProps {
  orderId: string;
  currentStatus: OrderStatus;
  role: string;
}

export function EditOrderButton({
  orderId,
  currentStatus,
  role,
}: EditOrderButtonProps) {
  // Admin/commissary: can edit if not fulfilled
  // Store: can edit own submitted orders
  const canEdit =
    (["admin", "commissary"].includes(role) && currentStatus !== "fulfilled") ||
    (role === "store" && currentStatus === "submitted");

  if (!canEdit) {
    return null;
  }

  return (
    <Button variant="outline" size="sm" asChild>
      <Link href={`/orders/${orderId}/edit`}>
        <Pencil className="size-4 mr-1.5" />
        Edit Order
      </Link>
    </Button>
  );
}

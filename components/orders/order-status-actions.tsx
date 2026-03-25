"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogDescription,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { updateOrderStatus } from "@/app/(dashboard)/orders/[order-id]/actions";
import { TERMINAL_STATUSES } from "@/lib/constants/order-status";
import type { OrderStatus } from "@/lib/types";

interface OrderStatusActionsProps {
  orderId: string;
  currentStatus: OrderStatus;
  role: string;
}

export function OrderStatusActions({
  orderId,
  currentStatus,
  role,
}: OrderStatusActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reason, setReason] = useState("");

  if (!["admin", "commissary"].includes(role) || TERMINAL_STATUSES.includes(currentStatus)) {
    return null;
  }

  const handleAction = (newStatus: OrderStatus) => {
    startTransition(async () => {
      const result = await updateOrderStatus(orderId, newStatus);
      if (result.error) {
        toast.error(result.error);
      } else {
        const labels: Record<string, string> = {
          approved: "Order approved.",
        };
        toast.success(labels[newStatus] ?? "Order status updated.");
        router.refresh();
      }
    });
  };

  const handleDeclineSubmit = () => {
    startTransition(async () => {
      const result = await updateOrderStatus(orderId, "declined", reason.trim());
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Order declined.");
        setDialogOpen(false);
        setReason("");
        router.refresh();
      }
    });
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          className="border-green-500 text-green-700 hover:bg-green-50 dark:border-green-600 dark:text-green-400 dark:hover:bg-green-950"
          disabled={isPending}
          onClick={() => handleAction("approved")}
        >
          Approve
        </Button>
        <Button
          variant="destructive"
          disabled={isPending}
          onClick={() => setDialogOpen(true)}
        >
          Decline
        </Button>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Decline Order</DialogTitle>
            <DialogDescription>
              Provide a reason for declining this order. The reason will be visible to all users.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label
              htmlFor="decline-reason"
              className="text-sm font-medium"
            >
              Reason for declining <span className="text-destructive">*</span>
            </label>
            <textarea
              id="decline-reason"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-h-[100px] resize-none"
              placeholder="Enter a reason for declining this order..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={isPending || reason.trim().length === 0}
              onClick={handleDeclineSubmit}
            >
              Decline Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

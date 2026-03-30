"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { deleteOrder } from "@/app/(dashboard)/orders/[order-id]/actions";
import type { OrderStatus } from "@/lib/types";

interface DeleteOrderButtonProps {
  orderId: string;
  currentStatus: OrderStatus;
  role: string;
  hasInvoice?: boolean;
}

export function DeleteOrderButton({
  orderId,
  currentStatus,
  role,
  hasInvoice = false,
}: DeleteOrderButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Admin: can delete any order regardless of status
  // Commissary: can delete if not fulfilled
  // Store: can delete own submitted orders
  const canDelete =
    role === "admin" ||
    (role === "commissary" && currentStatus !== "fulfilled") ||
    (role === "store" && currentStatus === "submitted");

  if (!canDelete) {
    return null;
  }

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deleteOrder(orderId);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Order deleted.");
        router.push("/orders");
      }
    });
  };

  return (
    <>
      <Button
        variant="destructive"
        size="sm"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="size-4 mr-1.5" />
        Delete Order
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Order</DialogTitle>
            <DialogDescription>
              This order will be removed from the system and will no longer be
              visible to any user.
              {hasInvoice && (
                <span className="block mt-2 font-medium text-destructive">
                  The associated invoice will also be permanently deleted.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isPending}
            >
              Delete Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

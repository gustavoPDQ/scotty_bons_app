"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { fulfillOrder } from "@/app/(dashboard)/orders/[order-id]/actions";
import type { OrderStatus } from "@/lib/types";

interface FulfillOrderButtonProps {
  orderId: string;
  currentStatus: OrderStatus;
  role: string;
}

export function FulfillOrderButton({
  orderId,
  currentStatus,
  role,
}: FulfillOrderButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (!["admin", "commissary"].includes(role) || currentStatus !== "approved") {
    return null;
  }

  const handleFulfill = () => {
    startTransition(async () => {
      const result = await fulfillOrder(orderId);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Order marked as fulfilled.");
        setOpen(false);
        router.refresh();
      }
    });
  };

  return (
    <>
      <Button
        size="sm"
        className="bg-blue-600 hover:bg-blue-700 text-white"
        onClick={() => setOpen(true)}
      >
        <CheckCircle className="size-4 mr-1.5" />
        Mark as Fulfilled
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Order as Fulfilled</DialogTitle>
            <DialogDescription>
              This will mark the order as fulfilled, indicating that production
              is complete. This action cannot be undone.
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
              className="bg-blue-600 hover:bg-blue-700 text-white"
              onClick={handleFulfill}
              disabled={isPending}
            >
              Mark as Fulfilled
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { TERMINAL_STATUSES } from "@/lib/constants/order-status";
import type { ActionResult, OrderStatus } from "@/lib/types";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACTIONABLE_STATUSES: OrderStatus[] = ["under_review", "approved", "declined"];

export async function updateOrderStatus(
  orderId: string,
  newStatus: OrderStatus,
  declineReason?: string
): Promise<ActionResult<void>> {
  // Validate orderId format
  if (!UUID_REGEX.test(orderId)) {
    return { data: null, error: "Invalid order ID." };
  }

  // Validate transition target
  if (!ACTIONABLE_STATUSES.includes(newStatus)) {
    return { data: null, error: "Invalid status transition." };
  }

  // Validate decline reason
  if (newStatus === "declined" && (!declineReason || declineReason.trim().length === 0)) {
    return { data: null, error: "A decline reason is required." };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "Unauthorized." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    return { data: null, error: "Unauthorized." };
  }

  // Fetch current status to validate the transition
  const { data: order } = await supabase
    .from("orders")
    .select("status")
    .eq("id", orderId)
    .single();

  if (!order) return { data: null, error: "Order not found." };

  const currentStatus = order.status as OrderStatus;

  if (TERMINAL_STATUSES.includes(currentStatus)) {
    return { data: null, error: "Cannot modify a terminal order." };
  }

  if (newStatus === "under_review" && currentStatus !== "submitted") {
    return { data: null, error: "Only submitted orders can be placed under review." };
  }

  const payload: { status: OrderStatus; decline_reason: string | null } = {
    status: newStatus,
    decline_reason: newStatus === "declined" ? (declineReason ?? null) : null,
  };

  const { error } = await supabase
    .from("orders")
    .update(payload)
    .eq("id", orderId);

  if (error) {
    return { data: null, error: "Failed to update order status. Please try again." };
  }

  revalidatePath("/orders");
  revalidatePath(`/orders/${orderId}`);
  return { data: undefined, error: null };
}

export async function deleteOrder(
  orderId: string
): Promise<ActionResult<void>> {
  // Validate orderId format
  if (!UUID_REGEX.test(orderId)) {
    return { data: null, error: "Invalid order ID." };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "Unauthorized." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    return { data: null, error: "Unauthorized." };
  }

  // Atomic check-and-update: only soft-delete non-terminal orders
  const { data, error } = await supabase
    .from("orders")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", orderId)
    .not("status", "in", `(${TERMINAL_STATUSES.join(",")})`)
    .select("id")
    .single();

  if (error || !data) {
    return { data: null, error: "Order not found or cannot be deleted." };
  }

  revalidatePath("/orders");
  revalidatePath(`/orders/${orderId}`);
  return { data: undefined, error: null };
}

export async function fulfillOrder(
  orderId: string
): Promise<ActionResult<void>> {
  if (!UUID_REGEX.test(orderId)) {
    return { data: null, error: "Invalid order ID." };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "Unauthorized." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (!profile || profile.role !== "factory") {
    return { data: null, error: "Unauthorized." };
  }

  const { error: rpcError } = await supabase.rpc(
    "fulfill_order_with_invoice",
    { p_order_id: orderId },
  );

  if (rpcError) {
    return {
      data: null,
      error: rpcError.message || "Failed to fulfill order. Please try again.",
    };
  }

  revalidatePath("/orders");
  revalidatePath(`/orders/${orderId}`);
  return { data: undefined, error: null };
}

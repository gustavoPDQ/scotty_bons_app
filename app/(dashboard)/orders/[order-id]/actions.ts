"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { TERMINAL_STATUSES } from "@/lib/constants/order-status";
import type { ActionResult, OrderStatus } from "@/lib/types";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACTIONABLE_STATUSES: OrderStatus[] = ["approved", "declined"];

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

  if (!profile || !["admin", "commissary"].includes(profile.role)) {
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

  if (!profile) {
    return { data: null, error: "Unauthorized." };
  }

  const role = profile.role;

  if (role === "store") {
    // Store users can only delete their own submitted orders
    // RLS ensures they can only see their own orders
    const { data, error } = await supabase
      .from("orders")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", orderId)
      .eq("status", "submitted")
      .select("id")
      .single();

    if (error || !data) {
      return { data: null, error: "Order not found or cannot be deleted." };
    }
  } else if (["admin", "commissary"].includes(role)) {
    // Admin/commissary can delete any non-fulfilled order
    const { data, error } = await supabase
      .from("orders")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", orderId)
      .neq("status", "fulfilled")
      .select("id")
      .single();

    if (error || !data) {
      return { data: null, error: "Order not found or cannot be deleted." };
    }
  } else {
    return { data: null, error: "Unauthorized." };
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

  if (!profile || !["admin", "commissary"].includes(profile.role)) {
    return { data: null, error: "Unauthorized." };
  }

  const { error: rpcError } = await supabase.rpc(
    "fulfill_order_with_invoice",
    { p_order_id: orderId },
  );

  if (rpcError) {
    const knownMessages = [
      "Only approved orders can be fulfilled.",
      "Order not found.",
      "Unauthorized.",
      "Order status changed concurrently.",
      "Store not found.",
    ];
    const msg = knownMessages.find((m) => rpcError.message?.includes(m));
    return {
      data: null,
      error: msg || "Failed to fulfill order. Please try again.",
    };
  }

  revalidatePath("/orders");
  revalidatePath(`/orders/${orderId}`);
  return { data: undefined, error: null };
}

export async function editOrderItems(
  orderId: string,
  items: { product_id: string; quantity: number }[]
): Promise<ActionResult<void>> {
  if (!UUID_REGEX.test(orderId)) {
    return { data: null, error: "Invalid order ID." };
  }
  if (!items.length) {
    return { data: null, error: "At least one item is required." };
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

  if (!profile) return { data: null, error: "Unauthorized." };

  const role = profile.role;

  // Fetch current order
  const { data: order } = await supabase
    .from("orders")
    .select("status, store_id")
    .eq("id", orderId)
    .single();

  if (!order) return { data: null, error: "Order not found." };

  const status = order.status as OrderStatus;

  // Permission check
  if (role === "store") {
    if (status !== "submitted") {
      return { data: null, error: "You can only edit submitted orders." };
    }
  } else if (["admin", "commissary"].includes(role)) {
    if (status === "fulfilled") {
      return { data: null, error: "Fulfilled orders cannot be edited." };
    }
  } else {
    return { data: null, error: "Unauthorized." };
  }

  // Validate product_ids and fetch prices
  const productIds = items.map((i) => i.product_id);
  const { data: products } = await supabase
    .from("products")
    .select("id, name, price, modifier")
    .in("id", productIds);

  if (!products || products.length !== productIds.length) {
    return { data: null, error: "One or more products not found." };
  }

  const productMap = new Map(products.map((p) => [p.id, p]));

  // Delete existing items
  const { error: deleteError } = await supabase
    .from("order_items")
    .delete()
    .eq("order_id", orderId);

  if (deleteError) {
    return { data: null, error: "Failed to update order items." };
  }

  // Insert new items with server-side prices
  const newItems = items.map((item) => {
    const product = productMap.get(item.product_id)!;
    return {
      order_id: orderId,
      product_id: item.product_id,
      product_name: product.name,
      modifier: product.modifier,
      unit_price: product.price,
      quantity: item.quantity,
    };
  });

  const { error: insertError } = await supabase
    .from("order_items")
    .insert(newItems);

  if (insertError) {
    return { data: null, error: "Failed to update order items." };
  }

  revalidatePath("/orders");
  revalidatePath(`/orders/${orderId}`);
  return { data: undefined, error: null };
}

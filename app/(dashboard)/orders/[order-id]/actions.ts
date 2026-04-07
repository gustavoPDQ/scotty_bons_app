"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { TERMINAL_STATUSES } from "@/lib/constants/order-status";
import type { ActionResult, OrderStatus } from "@/lib/types";
import {
  notifyOrderApproved,
  notifyOrderFulfilled,
} from "@/lib/email/order-notifications";

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

  // Fetch current status and submitter info for notification
  const { data: order } = await supabase
    .from("orders")
    .select("status, order_number, submitted_by, store_id")
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

  // Email notifications (awaited so they complete before response ends)
  try {
    if (newStatus === "approved") {
      const [{ data: storeData }, { count: itemCount }, { data: orderItems }] = await Promise.all([
        supabase.from("stores").select("name").eq("id", order.store_id).single(),
        supabase.from("order_items").select("id", { count: "exact", head: true }).eq("order_id", orderId),
        supabase.from("order_items").select("product_name, modifier, quantity, unit_price").eq("order_id", orderId),
      ]);
      await notifyOrderApproved(
        orderId, order.order_number, storeData?.name ?? "Unknown", order.submitted_by, itemCount ?? 0,
        (orderItems ?? []).map((i) => ({
          product_name: i.product_name,
          modifier: i.modifier,
          quantity: i.quantity,
          unit_price: Number(i.unit_price),
        })),
        order.store_id,
      );
    }
  } catch (e) {
    console.error("[email] Failed to notify order status change:", e);
  }

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
    .select("role, store_id")
    .eq("user_id", user.id)
    .single();

  if (!profile) {
    return { data: null, error: "Unauthorized." };
  }

  const role = profile.role;

  // Use admin client for all roles to bypass RLS issues with soft-delete
  // (setting deleted_at makes the row invisible to RLS SELECT policies).
  // Ownership and status checks are enforced explicitly in the query filters.
  const adminClient = createAdminClient();

  if (role === "store") {
    // Store users can only delete their own submitted orders
    const { error, count } = await adminClient
      .from("orders")
      .update({ deleted_at: new Date().toISOString() }, { count: "exact" })
      .eq("id", orderId)
      .eq("status", "submitted")
      .eq("store_id", profile.store_id)
      .is("deleted_at", null);

    if (error || count === 0) {
      return { data: null, error: "Order not found or cannot be deleted." };
    }
  } else if (role === "admin") {
    // Admin can delete any order regardless of status
    // If the order has an invoice, delete it first
    const { data: invoice } = await adminClient
      .from("invoices")
      .select("id")
      .eq("order_id", orderId)
      .maybeSingle();

    if (invoice) {
      // invoice_items cascade on invoice delete
      const { error: invoiceDeleteError } = await adminClient
        .from("invoices")
        .delete()
        .eq("id", invoice.id);

      if (invoiceDeleteError) {
        return { data: null, error: "Failed to delete associated invoice." };
      }
    }

    const { error, count } = await adminClient
      .from("orders")
      .update({ deleted_at: new Date().toISOString() }, { count: "exact" })
      .eq("id", orderId)
      .is("deleted_at", null);

    if (error || count === 0) {
      return { data: null, error: "Order not found or cannot be deleted." };
    }

    revalidatePath("/invoices");
  } else if (role === "commissary") {
    // Commissary can delete any non-fulfilled order
    const { error, count } = await adminClient
      .from("orders")
      .update({ deleted_at: new Date().toISOString() }, { count: "exact" })
      .eq("id", orderId)
      .neq("status", "fulfilled")
      .is("deleted_at", null);

    if (error || count === 0) {
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

  // Notify store user about fulfillment
  try {
    const { data: orderData } = await supabase
      .from("orders")
      .select("submitted_by, order_number")
      .eq("id", orderId)
      .single();
    const { data: invoice } = await supabase
      .from("invoices")
      .select("id, invoice_number")
      .eq("order_id", orderId)
      .single();
    if (orderData && invoice) {
      await notifyOrderFulfilled(orderId, orderData.order_number, orderData.submitted_by, invoice.id, invoice.invoice_number);
    }
  } catch (e) {
    console.error("[email] Failed to notify order fulfilled:", e);
  }

  return { data: undefined, error: null };
}

export async function editOrderItems(
  orderId: string,
  items: { modifier_id: string; quantity: number }[]
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

  // Validate modifier_ids and fetch prices from product_modifiers + products
  const modifierIds = items.map((i) => i.modifier_id);
  const { data: modifiers } = await supabase
    .from("product_modifiers")
    .select("id, label, price, product_id")
    .in("id", modifierIds);

  if (!modifiers || modifiers.length !== modifierIds.length) {
    return { data: null, error: "One or more modifiers not found." };
  }

  // Fetch product names
  const productIds = [...new Set(modifiers.map((m) => m.product_id))];
  const { data: productsData } = await supabase
    .from("products")
    .select("id, name")
    .in("id", productIds)
    .eq("active", true);

  if (!productsData || productsData.length !== productIds.length) {
    return { data: null, error: "One or more products are no longer available." };
  }

  const productNameMap = new Map(productsData.map((p) => [p.id, p.name]));
  const modifierMap = new Map(modifiers.map((m) => [m.id, m]));

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
    const mod = modifierMap.get(item.modifier_id)!;
    return {
      order_id: orderId,
      product_id: mod.product_id,
      product_name: productNameMap.get(mod.product_id) ?? "Unknown",
      modifier: mod.label,
      unit_price: mod.price,
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

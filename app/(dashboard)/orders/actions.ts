"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ActionResult } from "@/lib/types";
import {
  createOrderSchema,
  type CreateOrderValues,
} from "@/lib/validations/orders";
import { notifyOrderSubmitted } from "@/lib/email/order-notifications";

export async function getOrderItemsForOrders(
  orderIds: string[]
): Promise<ActionResult<{ order_id: string; product_name: string; modifier: string; unit_price: number; quantity: number }[]>> {
  if (!orderIds.length || orderIds.length > 50) {
    return { data: null, error: "Invalid selection." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "Unauthorized." };

  const { data, error } = await supabase
    .from("order_items")
    .select("order_id, product_name, modifier, unit_price, quantity")
    .in("order_id", orderIds);

  if (error) {
    return { data: null, error: "Failed to load order items." };
  }

  return { data: data ?? [], error: null };
}

export async function getFinancialSettings(): Promise<
  ActionResult<{ hst_rate: number; ad_royalties_fee: number }>
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "Unauthorized." };

  const { data, error } = await supabase
    .from("financial_settings")
    .select("key, value")
    .in("key", ["hst_rate", "ad_royalties_fee"]);

  if (error) {
    return { data: null, error: "Failed to load financial settings." };
  }

  const settings: Record<string, string> = {};
  for (const row of data ?? []) settings[row.key] = row.value;

  return {
    data: {
      hst_rate: Number(settings.hst_rate ?? "13") / 100,
      ad_royalties_fee: Number(settings.ad_royalties_fee ?? "0"),
    },
    error: null,
  };
}

export async function createOrder(
  values: CreateOrderValues
): Promise<ActionResult<{ id: string }>> {
  const parsed = createOrderSchema.safeParse(values);
  if (!parsed.success) {
    return {
      data: null,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "Unauthorized." };

  // Call atomic RPC — server-side price lookup + single transaction.
  // modifier_id + quantity are sent; product name/price/label come from DB.
  const { data: orderId, error } = await supabase.rpc(
    "create_order_with_items",
    {
      p_store_id: parsed.data.store_id,
      p_items: parsed.data.items.map((item) => ({
        modifier_id: item.modifier_id,
        quantity: item.quantity,
      })),
    }
  );

  if (error) {
    const msg = error.message;
    if (msg.includes("Not authenticated") || msg.includes("Unauthorized")) {
      return { data: null, error: "Unauthorized." };
    }
    if (msg.includes("not found") || msg.includes("inactive")) {
      return {
        data: null,
        error: "A product in your order is no longer available. Please refresh and try again.",
      };
    }
    return { data: null, error: "Failed to create order. Please try again." };
  }

  revalidatePath("/orders");

  // Notify admins about new order (awaited so it completes before response)
  try {
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("store_id")
      .eq("user_id", user.id)
      .single();
    console.log("[email] profile lookup:", { profileData, profileError });
    if (profileData?.store_id) {
      const [{ data: storeData }, { data: orderData }] = await Promise.all([
        supabase.from("stores").select("name").eq("id", profileData.store_id).single(),
        supabase.from("orders").select("order_number").eq("id", orderId).single(),
      ]);
      await notifyOrderSubmitted(
        orderId,
        orderData?.order_number ?? orderId.slice(0, 8),
        storeData?.name ?? "Unknown Store",
        parsed.data.items.length,
        parsed.data.items.map((i) => ({
          product_name: i.product_name,
          modifier: i.modifier_label,
          quantity: i.quantity,
          unit_price: i.unit_price,
        })),
      );
    }
  } catch (e) {
    console.error("[email] Failed to notify order submitted:", e);
  }

  return { data: { id: orderId }, error: null };
}

export async function adminCreateOrder(
  values: CreateOrderValues
): Promise<ActionResult<{ id: string }>> {
  const parsed = createOrderSchema.safeParse(values);
  if (!parsed.success) {
    return {
      data: null,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "Unauthorized." };

  // Verify caller is admin
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();
  if (profile?.role !== "admin") return { data: null, error: "Unauthorized." };

  const adminClient = createAdminClient();

  // Generate order number: read current counter, increment, and upsert
  const year = new Date().getFullYear();
  const { data: existing } = await adminClient
    .from("order_number_counters")
    .select("counter")
    .eq("year", year)
    .single();
  const nextCounter = (existing?.counter ?? 0) + 1;
  await adminClient
    .from("order_number_counters")
    .upsert({ year, counter: nextCounter }, { onConflict: "year" });

  const orderNumber = `ORD-${year}-${String(nextCounter).padStart(4, "0")}`;

  // Insert order (admin creates on behalf of store, submitted_by = admin)
  const { data: order, error: orderErr } = await adminClient
    .from("orders")
    .insert({
      store_id: parsed.data.store_id,
      submitted_by: user.id,
      status: "submitted",
      order_number: orderNumber,
    })
    .select("id, order_number")
    .single();

  if (orderErr) {
    return { data: null, error: "Failed to create order. Please try again." };
  }

  // Insert order items with snapshots from product_modifiers + products
  const orderItems = [];
  for (const item of parsed.data.items) {
    const { data: modRow } = await adminClient
      .from("product_modifiers")
      .select("id, label, price, product_id")
      .eq("id", item.modifier_id)
      .single();

    if (!modRow) {
      await adminClient.from("orders").delete().eq("id", order.id);
      return { data: null, error: `Modifier is no longer available. Please refresh and try again.` };
    }

    const { data: product } = await adminClient
      .from("products")
      .select("id, name")
      .eq("id", modRow.product_id)
      .eq("active", true)
      .single();

    if (!product) {
      await adminClient.from("orders").delete().eq("id", order.id);
      return { data: null, error: `Product "${item.product_name}" is no longer available.` };
    }

    orderItems.push({
      order_id: order.id,
      product_id: product.id,
      product_name: product.name,
      modifier: modRow.label,
      unit_price: modRow.price,
      quantity: item.quantity,
    });
  }

  const { error: itemsErr } = await adminClient
    .from("order_items")
    .insert(orderItems);

  if (itemsErr) {
    await adminClient.from("orders").delete().eq("id", order.id);
    return { data: null, error: "Failed to create order items. Please try again." };
  }

  // Insert initial status history
  await adminClient.from("order_status_history").insert({
    order_id: order.id,
    status: "submitted",
    changed_by: user.id,
  });

  revalidatePath("/orders");

  // Fetch store name for notification
  try {
    const { data: storeData } = await adminClient
      .from("stores")
      .select("name")
      .eq("id", parsed.data.store_id)
      .single();
    await notifyOrderSubmitted(
      order.id,
      order.order_number,
      storeData?.name ?? "Unknown Store",
      parsed.data.items.length,
      parsed.data.items.map((i) => ({
        product_name: i.product_name,
        modifier: i.modifier_label,
        quantity: i.quantity,
        unit_price: i.unit_price,
      })),
    );
  } catch (e) {
    console.error("[email] Failed to notify order submitted:", e);
  }

  return { data: { id: order.id }, error: null };
}

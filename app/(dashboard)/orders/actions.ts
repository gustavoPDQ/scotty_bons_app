"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/types";
import {
  createOrderSchema,
  type CreateOrderValues,
} from "@/lib/validations/orders";

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
  // Only product_id and quantity are sent; name/price/uom come from DB.
  const { data: orderId, error } = await supabase.rpc(
    "create_order_with_items",
    {
      p_items: parsed.data.items.map((item) => ({
        product_id: item.product_id,
        quantity: item.quantity,
      })),
    }
  );

  if (error) {
    const msg = error.message;
    if (msg.includes("Not authenticated") || msg.includes("Unauthorized")) {
      return { data: null, error: "Unauthorized." };
    }
    if (msg.includes("Product not found")) {
      return {
        data: null,
        error: "A product in your order is no longer available. Please refresh and try again.",
      };
    }
    return { data: null, error: "Failed to create order. Please try again." };
  }

  revalidatePath("/orders");

  return { data: { id: orderId }, error: null };
}

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/types";
import {
  createOrderSchema,
  type CreateOrderValues,
} from "@/lib/validations/orders";

/**
 * Verifies the current session belongs to a store user.
 * Returns supabase client, user, and profile — or null if unauthorized.
 */
async function verifyStoreUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, store_id")
    .eq("user_id", user.id)
    .single();

  if (profile?.role !== "store" || !profile.store_id) return null;

  return { supabase, user, profile };
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

  const auth = await verifyStoreUser();
  if (!auth) return { data: null, error: "Unauthorized." };

  const { supabase, user, profile } = auth;

  // Verify store_id matches the authenticated user's store
  if (parsed.data.store_id !== profile.store_id) {
    return { data: null, error: "Unauthorized." };
  }

  // Step 1: Insert the order
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      store_id: profile.store_id,
      submitted_by: user.id,
      status: "submitted",
    })
    .select("id")
    .single();

  if (orderError) {
    return { data: null, error: "Failed to create order. Please try again." };
  }

  // Step 2: Insert all order items with snapshot data
  const items = parsed.data.items.map((item) => ({
    order_id: order.id,
    product_id: item.product_id,
    product_name: item.product_name,
    unit_of_measure: item.unit_of_measure,
    unit_price: item.unit_price,
    quantity: item.quantity,
  }));

  const { error: itemsError } = await supabase
    .from("order_items")
    .insert(items);

  if (itemsError) {
    // Rollback: delete the orphaned order
    await supabase.from("orders").delete().eq("id", order.id);
    return {
      data: null,
      error: "Failed to add order items. Please try again.",
    };
  }

  revalidatePath("/orders");

  return { data: { id: order.id }, error: null };
}

"use server";

import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/types";

export async function getInvoiceItemsForInvoices(
  invoiceIds: string[]
): Promise<ActionResult<{ invoice_id: string; product_name: string; modifier: string; unit_price: number; quantity: number; line_total: number }[]>> {
  if (!invoiceIds.length || invoiceIds.length > 50) {
    return { data: null, error: "Invalid selection." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "Unauthorized." };

  const { data, error } = await supabase
    .from("invoice_items")
    .select("invoice_id, product_name, modifier, unit_price, quantity, line_total")
    .in("invoice_id", invoiceIds);

  if (error) {
    return { data: null, error: "Failed to load invoice items." };
  }

  return { data: data ?? [], error: null };
}

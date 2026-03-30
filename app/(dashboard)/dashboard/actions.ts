"use server";

import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/types";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

interface ExportParams {
  dateFrom: string;
  dateTo: string;
  storeIds: string[];
  categoryNames: string[];
  productNames: string[];
  format: "xlsx" | "pdf";
}

interface AggRow {
  name: string;
  modifier?: string;
  quantity: number;
  value: number;
}

export async function exportTopProductsReport(
  params: ExportParams,
): Promise<ActionResult<{ base64: string; filename: string } | null>> {
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

  // 1. Fetch fulfilled orders in date range
  let ordersQuery = supabase
    .from("orders")
    .select("id, store_id")
    .eq("status", "fulfilled")
    .gte("created_at", params.dateFrom)
    .lte("created_at", params.dateTo + "T23:59:59");

  if (params.storeIds.length > 0) {
    ordersQuery = ordersQuery.in("store_id", params.storeIds);
  }

  const { data: orders } = await ordersQuery;
  if (!orders || orders.length === 0) {
    return { data: null, error: "No fulfilled orders found for the selected filters." };
  }

  const orderIds = orders.map((o) => o.id);
  const orderStoreMap: Record<string, string> = {};
  for (const o of orders) orderStoreMap[o.id] = o.store_id;

  // 2. Fetch order items
  const { data: items } = await supabase
    .from("order_items")
    .select("order_id, product_name, modifier, unit_price, quantity")
    .in("order_id", orderIds);

  if (!items || items.length === 0) {
    return { data: null, error: "No order items found." };
  }

  // 3. Fetch products + categories for mapping
  const [{ data: products }, { data: categories }] = await Promise.all([
    supabase.from("products").select("name, category_id, product_modifiers(label)"),
    supabase.from("product_categories").select("id, name"),
  ]);

  const categoryNameMap: Record<string, string> = {};
  for (const c of categories ?? []) categoryNameMap[c.id] = c.name;

  const productCategoryMap: Record<string, string> = {};
  for (const p of (products ?? []) as { name: string; category_id: string; product_modifiers: { label: string }[] }[]) {
    for (const m of p.product_modifiers ?? []) {
      productCategoryMap[`${p.name}|${m.label}`] = categoryNameMap[p.category_id] ?? "Uncategorized";
    }
    productCategoryMap[`${p.name}|`] = categoryNameMap[p.category_id] ?? "Uncategorized";
  }

  // 4. Fetch store names — for selected stores or all stores with orders
  const lookupStoreIds = params.storeIds.length > 0
    ? params.storeIds
    : [...new Set(orders.map((o) => o.store_id))];
  const { data: storesData } = await supabase
    .from("stores")
    .select("id, name")
    .in("id", lookupStoreIds);
  const storeNameMap: Record<string, string> = {};
  for (const s of storesData ?? []) storeNameMap[s.id] = s.name;
  const storeNames = params.storeIds.length > 0
    ? params.storeIds.map((id) => storeNameMap[id] ?? "Unknown")
    : ["All Stores"];

  // 5. Aggregate
  const productAgg: Record<string, AggRow> = {};
  const categoryAgg: Record<string, AggRow> = {};

  for (const item of items) {
    const key = `${item.product_name}|${item.modifier}`;
    const catName = productCategoryMap[key] ?? "Uncategorized";
    const lineValue = Number(item.unit_price) * item.quantity;

    const p = productAgg[key] ?? { name: item.product_name, modifier: item.modifier, quantity: 0, value: 0 };
    p.quantity += item.quantity;
    p.value += lineValue;
    productAgg[key] = p;

    const c = categoryAgg[catName] ?? { name: catName, quantity: 0, value: 0 };
    c.quantity += item.quantity;
    c.value += lineValue;
    categoryAgg[catName] = c;
  }

  let catRows = Object.values(categoryAgg).sort((a, b) => b.quantity - a.quantity);
  let prodRows = Object.values(productAgg).sort((a, b) => b.quantity - a.quantity);

  // 6. Apply category/product filters
  if (params.categoryNames.length > 0) {
    const set = new Set(params.categoryNames);
    catRows = catRows.filter((c) => set.has(c.name));
    // Also filter products to only those in selected categories
    const prodKeysInCats = new Set<string>();
    for (const item of items) {
      const key = `${item.product_name}|${item.modifier}`;
      const catName = productCategoryMap[key] ?? "Uncategorized";
      if (set.has(catName)) prodKeysInCats.add(key);
    }
    prodRows = prodRows.filter((p) => prodKeysInCats.has(`${p.name}|${p.modifier}`));
  }

  if (params.productNames.length > 0) {
    const set = new Set(params.productNames);
    prodRows = prodRows.filter((p) => set.has(p.name));
  }

  // 7. Generate report
  const dateFmt = new Intl.DateTimeFormat("en-CA", { dateStyle: "medium" });
  const fromLabel = dateFmt.format(new Date(params.dateFrom));
  const toLabel = dateFmt.format(new Date(params.dateTo));
  const dateLabel = `${fromLabel} — ${toLabel}`;

  let buffer: Buffer;
  let filename: string;

  if (params.format === "pdf") {
    buffer = generatePdf(prodRows, dateLabel, storeNames);
    filename = `top-products-report-${params.dateFrom}-to-${params.dateTo}.pdf`;
  } else {
    buffer = generateXlsx(prodRows, dateLabel, storeNames);
    filename = `top-products-report-${params.dateFrom}-to-${params.dateTo}.xlsx`;
  }

  return { data: { base64: buffer.toString("base64"), filename }, error: null };
}

function generatePdf(
  products: AggRow[],
  dateLabel: string,
  storeNames: string[],
): Buffer {
  const doc = new jsPDF();
  const fmt = (v: number) => `$${v.toFixed(2)}`;

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("Products Report", 14, 18);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80);
  doc.text(`Period: ${dateLabel}`, 14, 25);
  doc.text(`Stores: ${storeNames.join(", ")}`, 14, 31);

  autoTable(doc, {
    startY: 38,
    head: [["#", "Product", "Modifier", "Qty", "Value"]],
    body: products.map((p, i) => [
      (i + 1).toString(),
      p.name,
      p.modifier ?? "",
      p.quantity.toString(),
      fmt(p.value),
    ]),
    theme: "striped",
    headStyles: { fillColor: [24, 24, 27] },
    columnStyles: { 0: { cellWidth: 12 }, 3: { halign: "right" }, 4: { halign: "right" } },
  });

  return Buffer.from(doc.output("arraybuffer"));
}

function generateXlsx(
  products: AggRow[],
  dateLabel: string,
  storeNames: string[],
): Buffer {
  const wb = XLSX.utils.book_new();

  const prodData = [
    ["Products Report"],
    [`Period: ${dateLabel}`],
    [`Stores: ${storeNames.join(", ")}`],
    [],
    ["#", "Product", "Modifier", "Quantity", "Value"],
    ...products.map((p, i) => [i + 1, p.name, p.modifier ?? "", p.quantity, p.value]),
  ];
  const prodSheet = XLSX.utils.aoa_to_sheet(prodData);
  XLSX.utils.book_append_sheet(wb, prodSheet, "Products");

  const xlsxBuffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return Buffer.from(xlsxBuffer);
}

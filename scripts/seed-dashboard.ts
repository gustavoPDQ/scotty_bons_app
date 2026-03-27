/**
 * Seed script to populate the database with realistic data for dashboard display.
 * Run with: npx tsx scripts/seed-dashboard.ts
 *
 * Prerequisites: .env.local must have NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

// ── Helpers ──

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDate(monthsAgo: number): Date {
  const d = new Date();
  d.setMonth(d.getMonth() - monthsAgo);
  d.setDate(randInt(1, 28));
  d.setHours(randInt(8, 18), randInt(0, 59), 0, 0);
  return d;
}

async function getNextOrderNumber(): Promise<string> {
  const year = new Date().getFullYear();
  // Use raw SQL via rpc or direct counter update
  const { data, error } = await supabase
    .from("order_number_counters")
    .upsert({ year, counter: 1 }, { onConflict: "year" })
    .select("counter")
    .single();

  if (error) {
    // If upsert fails, try increment approach
    const { data: existing } = await supabase
      .from("order_number_counters")
      .select("counter")
      .eq("year", year)
      .single();

    const nextCounter = (existing?.counter ?? 0) + 1;
    await supabase
      .from("order_number_counters")
      .upsert({ year, counter: nextCounter });

    return `ORD-${year}-${String(nextCounter).padStart(4, "0")}`;
  }

  return `ORD-${year}-${String(data.counter).padStart(4, "0")}`;
}

let orderCounter = 0;

async function initOrderCounter() {
  const year = new Date().getFullYear();
  const { data } = await supabase
    .from("order_number_counters")
    .select("counter")
    .eq("year", year)
    .single();
  orderCounter = data?.counter ?? 0;
}

function nextOrderNumber(): string {
  orderCounter++;
  const year = new Date().getFullYear();
  return `ORD-${year}-${String(orderCounter).padStart(4, "0")}`;
}

// ── Main ──

async function main() {
  console.log("Fetching existing data...");

  // Get stores
  const { data: stores } = await supabase.from("stores").select("id, name");
  if (!stores?.length) throw new Error("No stores found. Create stores first.");
  console.log(`  ${stores.length} stores`);

  // Get products
  const { data: products } = await supabase
    .from("products")
    .select("id, name, price, modifier")
    .eq("active", true);
  if (!products?.length) throw new Error("No products found.");
  console.log(`  ${products.length} products`);

  // Get profiles
  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, role, store_id");

  const storeUsers = profiles?.filter((p) => p.role === "store" && p.store_id) ?? [];
  const adminUsers = profiles?.filter((p) => p.role === "admin") ?? [];
  const commissaryUsers = profiles?.filter((p) => p.role === "commissary") ?? [];
  const approvers = [...adminUsers, ...commissaryUsers];

  if (!storeUsers.length) throw new Error("No store users found.");
  if (!approvers.length) throw new Error("No admin/commissary users found.");
  console.log(`  ${storeUsers.length} store users, ${approvers.length} approvers`);

  // Get audit templates with items
  const { data: templates } = await supabase
    .from("audit_templates")
    .select("id, name")
    .eq("is_active", true);

  let templateItems: { id: string; template_id: string }[] = [];
  if (templates?.length) {
    const { data: items } = await supabase
      .from("audit_template_items")
      .select("id, template_id");
    templateItems = items ?? [];
    console.log(`  ${templates.length} templates, ${templateItems.length} template items`);
  }

  // Init order counter
  await initOrderCounter();
  console.log(`  Order counter starts at ${orderCounter}`);

  // ══════════════════════════════════════════════
  // CREATE ORDERS — ~60-80 orders over 12 months
  // ══════════════════════════════════════════════
  console.log("\nCreating orders...");

  interface CreatedOrder {
    id: string;
    store_id: string;
    status: string;
    submitted_by: string;
  }
  const createdOrders: CreatedOrder[] = [];

  for (let monthOffset = 11; monthOffset >= 0; monthOffset--) {
    // More orders in recent months
    const count = monthOffset < 3 ? randInt(7, 12) : randInt(3, 7);

    for (let i = 0; i < count; i++) {
      // Pick a store user (determines the store)
      const storeUser = pick(storeUsers);
      const storeId = storeUser.store_id!;
      const submittedBy = storeUser.user_id;
      const createdAt = randomDate(monthOffset);
      const orderNumber = nextOrderNumber();

      // Insert order
      const { data: order, error: orderErr } = await supabase
        .from("orders")
        .insert({
          store_id: storeId,
          submitted_by: submittedBy,
          status: "submitted",
          order_number: orderNumber,
          created_at: createdAt.toISOString(),
        })
        .select("id")
        .single();

      if (orderErr) {
        console.warn(`  Order insert failed: ${orderErr.message}`);
        continue;
      }

      // Insert initial status history
      await supabase.from("order_status_history").insert({
        order_id: order.id,
        status: "submitted",
        changed_by: submittedBy,
        changed_at: createdAt.toISOString(),
      });

      // Pick 2-8 random products for order items
      const itemCount = randInt(2, Math.min(8, products.length));
      const shuffled = [...products].sort(() => Math.random() - 0.5);
      const selectedProducts = shuffled.slice(0, itemCount);

      const orderItems = selectedProducts.map((p) => ({
        order_id: order.id,
        product_id: p.id,
        product_name: p.name,
        modifier: p.modifier,
        unit_price: p.price,
        quantity: randInt(1, 10),
      }));

      await supabase.from("order_items").insert(orderItems);

      // Determine target status
      const roll = Math.random();
      let targetStatus: string;
      if (monthOffset === 0 && roll < 0.4) {
        targetStatus = "submitted";
      } else if (roll < 0.12) {
        targetStatus = "declined";
      } else if (roll < 0.35) {
        targetStatus = "approved";
      } else {
        targetStatus = "fulfilled";
      }

      const approver = pick(approvers);

      if (targetStatus !== "submitted") {
        const intermediateStatus =
          targetStatus === "declined" ? "declined" : "approved";
        const updateData: Record<string, unknown> = {
          status: intermediateStatus,
        };
        if (intermediateStatus === "declined") {
          updateData.decline_reason = pick([
            "Duplicate order",
            "Budget exceeded for this month",
            "Products temporarily unavailable",
            "Incorrect quantities — please resubmit",
            "Store is over credit limit",
          ]);
        }
        await supabase.from("orders").update(updateData).eq("id", order.id);

        const changeDate = new Date(createdAt);
        changeDate.setHours(changeDate.getHours() + randInt(2, 48));
        await supabase.from("order_status_history").insert({
          order_id: order.id,
          status: intermediateStatus,
          changed_by: approver.user_id,
          changed_at: changeDate.toISOString(),
        });

        // Fulfill (manual — insert invoice directly)
        if (targetStatus === "fulfilled") {
          const fulfillDate = new Date(changeDate);
          fulfillDate.setHours(fulfillDate.getHours() + randInt(1, 72));

          // Calculate totals
          const subtotal = orderItems.reduce(
            (sum, item) => sum + Number(item.unit_price) * item.quantity,
            0,
          );
          const taxRate = 0.13;
          const taxAmount = Math.round(subtotal * taxRate * 100) / 100;
          const grandTotal = Math.round((subtotal + taxAmount) * 100) / 100;

          const storeName =
            stores.find((s) => s.id === storeId)?.name ?? "Store";

          // Generate invoice number from order number
          const invoiceNumber = orderNumber.replace("ORD-", "INV-");

          const { error: invErr } = await supabase.from("invoices").insert({
            order_id: order.id,
            invoice_number: invoiceNumber,
            store_id: storeId,
            store_name: storeName,
            company_name: "Scotty Bons Commissary",
            company_address: "123 Commissary Rd, Toronto ON",
            company_tax_id: "416-555-0100",
            subtotal,
            tax_rate: taxRate,
            tax_amount: taxAmount,
            grand_total: grandTotal,
            created_at: fulfillDate.toISOString(),
          });

          if (!invErr) {
            // Insert invoice items
            const invoiceItemRows = orderItems.map((item) => ({
              invoice_id: undefined as string | undefined, // we need the invoice id
              product_name: item.product_name,
              modifier: item.modifier,
              unit_price: item.unit_price,
              quantity: item.quantity,
              line_total: Number(item.unit_price) * item.quantity,
            }));

            // Get the invoice id
            const { data: inv } = await supabase
              .from("invoices")
              .select("id")
              .eq("order_id", order.id)
              .single();

            if (inv) {
              await supabase.from("invoice_items").insert(
                invoiceItemRows.map((r) => ({ ...r, invoice_id: inv.id })),
              );
            }

            await supabase
              .from("orders")
              .update({
                status: "fulfilled",
                fulfilled_at: fulfillDate.toISOString(),
              })
              .eq("id", order.id);

            await supabase.from("order_status_history").insert({
              order_id: order.id,
              status: "fulfilled",
              changed_by: approver.user_id,
              changed_at: fulfillDate.toISOString(),
            });
          } else {
            console.warn(`  Invoice failed: ${invErr.message}`);
          }
        }
      }

      createdOrders.push({
        id: order.id,
        store_id: storeId,
        status: targetStatus,
        submitted_by: submittedBy,
      });
    }
  }

  // Update the order_number_counters to reflect what we used
  const year = new Date().getFullYear();
  await supabase
    .from("order_number_counters")
    .upsert({ year, counter: orderCounter });

  console.log(`  Created ${createdOrders.length} orders`);

  const statusBreakdown = {
    submitted: createdOrders.filter((o) => o.status === "submitted").length,
    approved: createdOrders.filter((o) => o.status === "approved").length,
    declined: createdOrders.filter((o) => o.status === "declined").length,
    fulfilled: createdOrders.filter((o) => o.status === "fulfilled").length,
  };
  console.log("  Breakdown:", statusBreakdown);

  // ══════════════════════════════════════════════
  // CREATE AUDITS — spread over last 8 months
  // ══════════════════════════════════════════════
  if (templates?.length && templateItems.length) {
    console.log("\nCreating audits...");

    const RATINGS = ["poor", "satisfactory", "good"] as const;
    let auditCount = 0;

    for (let monthOffset = 7; monthOffset >= 0; monthOffset--) {
      for (const store of stores) {
        // 1-2 audits per store per period (sometimes 0)
        const auditsThisMonth = monthOffset === 0 ? randInt(0, 1) : randInt(1, 2);

        for (let a = 0; a < auditsThisMonth; a++) {
          const template = pick(templates);
          const conductor = pick(approvers);
          const conductedAt = randomDate(monthOffset);

          const tplItems = templateItems.filter(
            (ti) => ti.template_id === template.id,
          );
          if (tplItems.length === 0) continue;

          // Vary scores by store — last store gets lower scores
          const isLowScoreStore = store.id === stores[stores.length - 1]?.id;
          // Scores should also improve over time for most stores
          const timeBonus = (7 - monthOffset) * 0.03; // slight improvement over time

          const responses = tplItems.map((item) => {
            const roll = Math.random() + timeBonus;
            let rating: (typeof RATINGS)[number];
            if (isLowScoreStore) {
              rating =
                roll < 0.35 ? "poor" : roll < 0.7 ? "satisfactory" : "good";
            } else {
              rating =
                roll < 0.08 ? "poor" : roll < 0.3 ? "satisfactory" : "good";
            }
            return { template_item_id: item.id, rating };
          });

          // Calculate score
          const weights: number[] = responses.map((r) =>
            r.rating === "good" ? 1 : r.rating === "satisfactory" ? 0.5 : 0,
          );
          const score =
            Math.round(
              (weights.reduce((a, b) => a + b, 0) / weights.length) * 10000,
            ) / 100;

          const { data: audit, error: auditErr } = await supabase
            .from("audits")
            .insert({
              template_id: template.id,
              store_id: store.id,
              conducted_by: conductor.user_id,
              score,
              notes: pick([
                "Overall good condition.",
                "Some areas need attention.",
                "Great improvement since last audit.",
                "Follow-up needed on cleanliness items.",
                "Excellent standards maintained.",
                "Storage area needs reorganization.",
                null,
              ]),
              conducted_at: conductedAt.toISOString(),
              created_at: conductedAt.toISOString(),
            })
            .select("id")
            .single();

          if (auditErr) {
            console.warn(`  Audit insert failed: ${auditErr.message}`);
            continue;
          }

          const responseRows = responses.map((r) => ({
            audit_id: audit.id,
            template_item_id: r.template_item_id,
            rating: r.rating,
            notes:
              r.rating === "poor"
                ? pick([
                    "Needs immediate attention",
                    "Below standard",
                    "Follow-up required",
                    "Critical issue identified",
                  ])
                : null,
          }));

          await supabase.from("audit_responses").insert(responseRows);
          auditCount++;
        }
      }
    }

    console.log(`  Created ${auditCount} audits`);
  } else {
    console.log("\nSkipping audits — no templates found.");
  }

  console.log("\nSeed complete! Refresh the dashboard to see the data.");
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});

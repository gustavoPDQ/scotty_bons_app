import { sendEmail, type EmailAttachment } from "./client";
import { notificationEmail } from "./templates";
import { escapeHtml } from "./escape-html";
import { createClient } from "@/lib/supabase/server";
import { generateOrderPdfBuffer } from "@/lib/pdf/generate-pdf-buffer";
import type { OrderPdfBufferData, OrderPdfBufferItem } from "@/lib/pdf/generate-pdf-buffer";

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

async function getEmailsByRole(role: string): Promise<string[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase.rpc("get_emails_by_role", { p_role: role });
    return data?.map((d: { email: string }) => d.email) ?? [];
  } catch {
    return [];
  }
}

async function getUserEmail(userId: string): Promise<string | null> {
  try {
    const supabase = await createClient();
    const { data } = await supabase.rpc("get_user_email", { p_user_id: userId });
    return data ?? null;
  } catch {
    return null;
  }
}

async function buildOrderPdfData(
  orderNumber: string,
  status: string,
  storeId: string,
  storeName: string,
  orderItems: { product_name: string; modifier: string; quantity: number; unit_price: number }[],
): Promise<{ pdfData: OrderPdfBufferData; pdfItems: OrderPdfBufferItem[] } | null> {
  try {
    const supabase = await createClient();

    const [{ data: financialSettings }, { data: storeBilling }] = await Promise.all([
      supabase.from("financial_settings").select("key, value")
        .in("key", ["hst_rate", "ad_royalties_fee", "commissary_name", "commissary_address", "commissary_postal_code", "commissary_phone"]),
      supabase.from("stores").select("business_name, address, postal_code, phone, email").eq("id", storeId).single(),
    ]);

    const fsMap: Record<string, string> = {};
    for (const row of financialSettings ?? []) fsMap[row.key] = row.value;

    const hstRate = Number(fsMap.hst_rate ?? "13") / 100;
    const adRoyaltiesFee = Number(fsMap.ad_royalties_fee ?? "0");
    const subtotal = orderItems.reduce((sum, i) => sum + Number(i.unit_price) * i.quantity, 0);
    const taxAmount = subtotal * hstRate;
    const grandTotal = subtotal + taxAmount + adRoyaltiesFee;

    const companyAddress = [fsMap.commissary_address, fsMap.commissary_postal_code].filter(Boolean).join("\n") || null;

    const pdfData: OrderPdfBufferData = {
      order_number: orderNumber,
      created_at: new Date().toISOString(),
      company_name: fsMap.commissary_name ?? null,
      company_address: companyAddress,
      company_tax_id: fsMap.commissary_phone ?? null,
      store_name: storeName,
      store_business_name: storeBilling?.business_name ?? null,
      store_address: storeBilling?.address ?? null,
      store_postal_code: storeBilling?.postal_code ?? null,
      store_phone: storeBilling?.phone ?? null,
      store_email: storeBilling?.email ?? null,
      subtotal,
      tax_rate: hstRate,
      tax_amount: taxAmount,
      ad_royalties_fee: adRoyaltiesFee,
      grand_total: grandTotal,
    };

    const pdfItems: OrderPdfBufferItem[] = orderItems.map((i) => ({
      product_name: i.product_name,
      modifier: i.modifier,
      unit_price: Number(i.unit_price),
      quantity: i.quantity,
      line_total: Number(i.unit_price) * i.quantity,
    }));

    return { pdfData, pdfItems };
  } catch (e) {
    console.error("[email] Failed to build order PDF data:", e);
    return null;
  }
}

export async function notifyOrderSubmitted(
  orderId: string,
  orderNumber: string,
  storeName: string,
  itemCount: number,
  orderItems?: { product_name: string; modifier: string; quantity: number; unit_price: number }[],
  storeId?: string,
): Promise<void> {
  console.log("[email] notifyOrderSubmitted called:", { orderId, orderNumber, storeName, itemCount });
  const adminEmails = await getEmailsByRole("admin");
  console.log("[email] adminEmails:", adminEmails);
  if (adminEmails.length === 0) return;

  const safe = escapeHtml(storeName);
  const safeNum = escapeHtml(orderNumber);

  const html = notificationEmail({
    title: "New Order Submitted",
    body: `
      A new order has been submitted by <strong>${safe}</strong>.<br><br>
      <strong>Order:</strong> ${safeNum}<br>
      <strong>Items:</strong> ${itemCount}
    `,
    ctaText: "View Order",
    ctaUrl: `${appUrl()}/orders/${encodeURIComponent(orderId)}`,
  });

  const attachments: EmailAttachment[] = [];
  if (orderItems && orderItems.length > 0 && storeId) {
    const result = await buildOrderPdfData(orderNumber, "submitted", storeId, storeName, orderItems);
    if (result) {
      try {
        const pdfBuffer = generateOrderPdfBuffer(result.pdfData, result.pdfItems);
        attachments.push({ content: pdfBuffer, filename: `${orderNumber}.pdf` });
      } catch (e) {
        console.error("[email] Failed to generate order PDF attachment:", e);
      }
    }
  }

  await sendEmail({
    to: adminEmails,
    subject: `New Order Submitted — ${storeName}`,
    html,
    attachments: attachments.length > 0 ? attachments : undefined,
  });
}

export async function notifyOrderApproved(
  orderId: string,
  orderNumber: string,
  storeName: string,
  submittedByUserId: string,
  itemCount: number,
  orderItems?: { product_name: string; modifier: string; quantity: number; unit_price: number }[],
  storeId?: string,
): Promise<void> {
  const commissaryEmails = await getEmailsByRole("commissary");

  const safeNum = escapeHtml(orderNumber);
  const safeName = escapeHtml(storeName);

  // Notify commissary (WITH PDF attachment)
  if (commissaryEmails.length > 0) {
    const attachments: EmailAttachment[] = [];
    if (orderItems && orderItems.length > 0 && storeId) {
      const result = await buildOrderPdfData(orderNumber, "approved", storeId, storeName, orderItems);
      if (result) {
        try {
          const pdfBuffer = generateOrderPdfBuffer(result.pdfData, result.pdfItems);
          attachments.push({ content: pdfBuffer, filename: `${orderNumber}.pdf` });
        } catch (e) {
          console.error("[email] Failed to generate order PDF attachment:", e);
        }
      }
    }

    const html = notificationEmail({
      title: "Order Approved — Ready for Fulfillment",
      body: `
        An order from <strong>${safeName}</strong> has been approved.<br><br>
        <strong>Order:</strong> ${safeNum}<br>
        <strong>Items:</strong> ${itemCount}
      `,
      ctaText: "View Order",
      ctaUrl: `${appUrl()}/orders/${encodeURIComponent(orderId)}`,
    });

    await sendEmail({
      to: commissaryEmails,
      subject: "Order Approved — Ready for Fulfillment",
      html,
      attachments: attachments.length > 0 ? attachments : undefined,
    });
  }
}

export async function notifyOrderFulfilled(
  orderId: string,
  orderNumber: string,
  submittedByUserId: string,
  invoiceId: string,
  invoiceNumber: string,
): Promise<void> {
  const submitterEmail = await getUserEmail(submittedByUserId);
  if (!submitterEmail) return;

  const safeNum = escapeHtml(orderNumber);
  const safeInvoice = escapeHtml(invoiceNumber);

  const html = notificationEmail({
    title: "Order Fulfilled",
    body: `
      Your order <strong>${safeNum}</strong> has been fulfilled.<br><br>
      <strong>Invoice:</strong> ${safeInvoice}
    `,
    ctaText: "View Invoice",
    ctaUrl: `${appUrl()}/invoices/${encodeURIComponent(invoiceId)}`,
  });

  await sendEmail({
    to: submitterEmail,
    subject: `Order Fulfilled — ${orderNumber}`,
    html,
  });
}

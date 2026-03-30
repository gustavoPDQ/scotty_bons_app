import { sendEmail, type EmailAttachment } from "./client";
import { notificationEmail } from "./templates";
import { escapeHtml } from "./escape-html";
import { createClient } from "@/lib/supabase/server";
import { generateOrderPdfBuffer } from "@/lib/pdf/generate-pdf-buffer";

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

export async function notifyOrderSubmitted(
  orderId: string,
  orderNumber: string,
  storeName: string,
  itemCount: number,
  orderItems?: { product_name: string; modifier: string; quantity: number; unit_price: number }[],
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
  if (orderItems && orderItems.length > 0) {
    try {
      const pdfBuffer = generateOrderPdfBuffer(
        { order_number: orderNumber, status: "submitted", created_at: new Date().toISOString() },
        orderItems,
        storeName,
      );
      attachments.push({ content: pdfBuffer, filename: `${orderNumber}.pdf` });
    } catch (e) {
      console.error("[email] Failed to generate order PDF attachment:", e);
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
): Promise<void> {
  const [submitterEmail, commissaryEmails] = await Promise.all([
    getUserEmail(submittedByUserId),
    getEmailsByRole("commissary"),
  ]);

  const safeNum = escapeHtml(orderNumber);
  const safeName = escapeHtml(storeName);

  // Notify submitter (NO PDF attachment for store)
  if (submitterEmail) {
    const html = notificationEmail({
      title: "Order Approved",
      body: `Your order <strong>${safeNum}</strong> has been approved and is being prepared.`,
      ctaText: "View Order",
      ctaUrl: `${appUrl()}/orders/${encodeURIComponent(orderId)}`,
    });

    await sendEmail({
      to: submitterEmail,
      subject: `Order Approved — ${orderNumber}`,
      html,
    });
  }

  // Notify commissary (WITH PDF attachment)
  if (commissaryEmails.length > 0) {
    const attachments: EmailAttachment[] = [];
    if (orderItems && orderItems.length > 0) {
      try {
        const pdfBuffer = generateOrderPdfBuffer(
          { order_number: orderNumber, status: "approved", created_at: new Date().toISOString() },
          orderItems,
          storeName,
        );
        attachments.push({ content: pdfBuffer, filename: `${orderNumber}.pdf` });
      } catch (e) {
        console.error("[email] Failed to generate order PDF attachment:", e);
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

export async function notifyOrderDeclined(
  orderId: string,
  orderNumber: string,
  submittedByUserId: string,
  declineReason: string | null,
): Promise<void> {
  const submitterEmail = await getUserEmail(submittedByUserId);
  if (!submitterEmail) return;

  const safeNum = escapeHtml(orderNumber);
  const reasonText = declineReason
    ? `<br><br><strong>Reason:</strong> ${escapeHtml(declineReason)}`
    : "";

  const html = notificationEmail({
    title: "Order Declined",
    body: `Your order <strong>${safeNum}</strong> has been declined.${reasonText}`,
    ctaText: "View Order",
    ctaUrl: `${appUrl()}/orders/${encodeURIComponent(orderId)}`,
  });

  await sendEmail({
    to: submitterEmail,
    subject: `Order Declined — ${orderNumber}`,
    html,
  });
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

/**
 * Server-side PDF generation helpers that return Buffers for email attachments.
 * These wrap the existing PDF generators but output arraybuffer → Buffer.
 */

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { INVOICE_LOGO_BASE64 } from "./invoice-logo";

// ── Order PDF Buffer ────────────────────────────────────────────────────────

export function generateOrderPdfBuffer(
  order: { order_number: string; status: string; created_at: string },
  items: { product_name: string; modifier: string; quantity: number; unit_price: number }[],
  storeName: string,
): Buffer {
  const doc = new jsPDF();
  const dateFmt = new Intl.DateTimeFormat("en-CA", { dateStyle: "long" });

  doc.setFontSize(18);
  doc.text("Order Report", 14, 22);
  doc.setFontSize(11);
  doc.text(`Order: ${order.order_number}`, 14, 32);
  doc.text(`Store: ${storeName}`, 14, 39);
  doc.text(`Status: ${order.status}`, 14, 46);
  doc.text(`Date: ${dateFmt.format(new Date(order.created_at))}`, 14, 53);

  const tableData = items.map((item) => [
    item.product_name,
    item.modifier,
    item.quantity.toString(),
    `$${Number(item.unit_price).toFixed(2)}`,
    `$${(Number(item.unit_price) * item.quantity).toFixed(2)}`,
  ]);

  const subtotal = items.reduce((sum, i) => sum + Number(i.unit_price) * i.quantity, 0);

  autoTable(doc, {
    startY: 60,
    head: [["Product", "Modifier", "Qty", "Unit Price", "Total"]],
    body: tableData,
    foot: [["", "", "", "Subtotal:", `$${subtotal.toFixed(2)}`]],
    theme: "striped",
    headStyles: { fillColor: [24, 24, 27] },
    footStyles: { fillColor: [245, 245, 245], textColor: [0, 0, 0], fontStyle: "bold" },
  });

  return Buffer.from(doc.output("arraybuffer"));
}

// ── Invoice PDF Buffer ──────────────────────────────────────────────────────

interface InvoiceData {
  invoice_number: string;
  created_at: string;
  company_name: string | null;
  company_address: string | null;
  company_tax_id: string | null;
  store_name: string;
  store_business_name: string | null;
  store_address: string | null;
  store_postal_code: string | null;
  store_phone: string | null;
  store_email: string | null;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  ad_royalties_fee: number | null;
  grand_total: number;
}

interface InvoiceItem {
  product_name: string;
  modifier: string;
  unit_price: number;
  quantity: number;
  line_total: number;
}

export function generateInvoicePdfBuffer(
  invoice: InvoiceData,
  items: InvoiceItem[],
): Buffer {
  const doc = new jsPDF();
  const dateFmt = new Intl.DateTimeFormat("en-CA", { dateStyle: "long" });
  const fmt = (v: number) => `$${Number(v).toFixed(2)}`;
  const rightX = 196;
  const midX = 110;

  // Header
  doc.addImage(INVOICE_LOGO_BASE64, "PNG", 14, 10, 16, 16);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0);
  doc.text("Scotty Bons", 32, 18);
  doc.text("Caribbean Grill", 32, 24);

  doc.setFontSize(13);
  doc.text(`Invoice - ${invoice.invoice_number}`, rightX, 17, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(80);
  doc.text(dateFmt.format(new Date(invoice.created_at)), rightX, 23, { align: "right" });

  // From / Ship To
  let leftY = 38;
  let rightY = 38;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(0);
  doc.text("From:", 14, leftY);
  leftY += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(60);
  if (invoice.company_name) { doc.text(invoice.company_name, 14, leftY); leftY += 5; }
  if (invoice.company_address) {
    (doc.splitTextToSize(invoice.company_address, 80) as string[]).forEach((line: string) => {
      doc.text(line, 14, leftY); leftY += 5;
    });
  }
  if (invoice.company_tax_id) { doc.text(`Ph# ${invoice.company_tax_id}`, 14, leftY); leftY += 5; }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(0);
  doc.text("Ship to:", midX, rightY);
  rightY += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(60);
  doc.text(invoice.store_business_name || invoice.store_name, midX, rightY); rightY += 5;
  if (invoice.store_address) {
    (doc.splitTextToSize(invoice.store_address, 80) as string[]).forEach((line: string) => {
      doc.text(line, midX, rightY); rightY += 5;
    });
  }
  if (invoice.store_postal_code) { doc.text(invoice.store_postal_code, midX, rightY); rightY += 5; }
  if (invoice.store_phone) { doc.text(invoice.store_phone, midX, rightY); rightY += 5; }
  if (invoice.store_email) { doc.text(invoice.store_email, midX, rightY); rightY += 5; }

  let y = Math.max(leftY, rightY) + 4;

  // Items table
  const tableData = items.map((item) => [
    item.product_name, item.modifier, fmt(Number(item.unit_price)), item.quantity.toString(), fmt(Number(item.line_total)),
  ]);

  autoTable(doc, {
    startY: y,
    head: [["Product", "Modifier", "Unit Price", "Qty", "Line Total"]],
    body: tableData,
    theme: "striped",
    headStyles: { fillColor: [24, 24, 27] },
    columnStyles: { 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" } },
  });

  // Totals
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginRight = 14;
  const valueX = pageWidth - marginRight;
  const labelX = valueX - 45;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let ty = (doc as any).lastAutoTable.finalY + 8;
  const taxRatePercent = (Number(invoice.tax_rate) * 100).toFixed(2);
  const adFee = Number(invoice.ad_royalties_fee ?? 0);

  doc.setFontSize(10);
  doc.setTextColor(0);
  doc.setFont("helvetica", "normal");

  const totalsLines: [string, string][] = [
    ["Subtotal:", fmt(Number(invoice.subtotal))],
    [`HST (${taxRatePercent}%):`, fmt(Number(invoice.tax_amount))],
  ];
  if (adFee > 0) totalsLines.push(["Ad & Royalties Fee:", fmt(adFee)]);
  totalsLines.push(["Grand Total:", fmt(Number(invoice.grand_total))]);

  totalsLines.forEach(([label, value], idx) => {
    const isLast = idx === totalsLines.length - 1;
    if (isLast) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      ty += 2;
      doc.setDrawColor(200);
      doc.line(labelX - 5, ty - 4, valueX, ty - 4);
    }
    doc.text(label, labelX, ty, { align: "right" });
    doc.text(value, valueX, ty, { align: "right" });
    ty += 6;
  });

  return Buffer.from(doc.output("arraybuffer"));
}

// ── Audit PDF Buffer ────────────────────────────────────────────────────────

import { AUDIT_RATING_LABELS } from "@/lib/constants/audit-status";
import type { AuditRating } from "@/lib/types";

const RATING_COLORS: Record<string, [number, number, number]> = {
  good: [34, 197, 94],
  satisfactory: [234, 179, 8],
  poor: [239, 68, 68],
};

export function generateAuditPdfBuffer(
  audit: { score: number | null; conducted_at: string | null; notes: string | null },
  categories: { name: string; items: { label: string; rating: AuditRating | null; notes: string | null }[] }[],
  storeName: string,
  templateName: string,
  conductorName: string,
): Buffer {
  const doc = new jsPDF();
  const dateFmt = new Intl.DateTimeFormat("en-CA", { dateStyle: "long" });

  doc.setFontSize(18);
  doc.text("Audit Report", 14, 22);
  doc.setFontSize(11);
  doc.text(`Store: ${storeName}`, 14, 32);
  doc.text(`Template: ${templateName}`, 14, 39);
  doc.text(`Conducted by: ${conductorName}`, 14, 46);
  if (audit.conducted_at) {
    doc.text(`Date: ${dateFmt.format(new Date(audit.conducted_at))}`, 14, 53);
  }
  if (audit.score !== null) {
    doc.text(`Score: ${audit.score}%`, 14, 60);
  }

  let startY = 68;

  for (const cat of categories) {
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0);
    doc.text(cat.name, 14, startY);
    startY += 2;

    const tableData = cat.items.map((item) => [
      item.label,
      item.rating ? AUDIT_RATING_LABELS[item.rating] : "—",
      item.notes ?? "",
    ]);

    autoTable(doc, {
      startY,
      head: [["Item", "Rating", "Notes"]],
      body: tableData,
      theme: "striped",
      headStyles: { fillColor: [24, 24, 27] },
      bodyStyles: { fontSize: 9 },
      columnStyles: { 0: { cellWidth: 70 }, 2: { cellWidth: 70 } },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 1) {
          const rating = cat.items[data.row.index]?.rating;
          if (rating && RATING_COLORS[rating]) {
            data.cell.styles.textColor = RATING_COLORS[rating];
            data.cell.styles.fontStyle = "bold";
          }
        }
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    startY = (doc as any).lastAutoTable.finalY + 8;
  }

  if (audit.notes) {
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Audit Notes", 14, startY);
    startY += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const lines = doc.splitTextToSize(audit.notes, 180) as string[];
    lines.forEach((line: string) => {
      doc.text(line, 14, startY);
      startY += 4.5;
    });
  }

  return Buffer.from(doc.output("arraybuffer"));
}

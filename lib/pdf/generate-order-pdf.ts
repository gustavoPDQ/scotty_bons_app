import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { INVOICE_LOGO_BASE64 } from "./invoice-logo";

export interface OrderPdfData {
  order_number: string;
  status: string;
  created_at: string;
  submitted_by_name: string | null;
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

export interface OrderPdfItem {
  product_name: string;
  modifier: string;
  unit_price: number;
  quantity: number;
  line_total: number;
}

export function generateOrderPdf(
  order: OrderPdfData,
  items: OrderPdfItem[],
): Blob {
  const doc = new jsPDF();
  const dateFmt = new Intl.DateTimeFormat("en-CA", { dateStyle: "long" });
  const fmt = (v: number) => `$${Number(v).toFixed(2)}`;
  const rightX = 196;
  const midX = 110;

  // ── Header: Logo + brand name (left) / Order number + date (right) ──
  doc.addImage(INVOICE_LOGO_BASE64, "PNG", 14, 11, 16, 16);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0);
  doc.text("Scotty Bons", 32, 18);
  doc.text("Caribbean Grill", 32, 24);

  doc.setFontSize(13);
  doc.text(`Order - ${order.order_number}`, rightX, 17, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(80);
  doc.text(dateFmt.format(new Date(order.created_at)), rightX, 23, {
    align: "right",
  });
  if (order.submitted_by_name) {
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(`Ordered by: ${order.submitted_by_name}`, rightX, 28, {
      align: "right",
    });
  }

  // ── Status badge ──
  const statusColors: Record<string, { bg: [number, number, number]; text: [number, number, number] }> = {
    submitted: { bg: [255, 237, 213], text: [154, 52, 18] },
    approved: { bg: [209, 250, 229], text: [6, 95, 70] },
    declined: { bg: [254, 226, 226], text: [153, 27, 27] },
    fulfilled: { bg: [219, 234, 254], text: [30, 64, 175] },
  };
  const statusLabels: Record<string, string> = {
    submitted: "Submitted",
    approved: "Approved",
    declined: "Declined",
    fulfilled: "Fulfilled",
  };
  const statusKey = order.status.toLowerCase();
  const sColor = statusColors[statusKey] ?? { bg: [229, 231, 235], text: [55, 65, 81] };
  const sLabel = statusLabels[statusKey] ?? order.status;
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  const badgeW = doc.getTextWidth(sLabel) + 8;
  const badgeH = 6;
  const badgeX = rightX - badgeW;
  const badgeY = order.submitted_by_name ? 32 : 26;
  doc.setFillColor(...sColor.bg);
  doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 1.5, 1.5, "F");
  doc.setTextColor(...sColor.text);
  doc.text(sLabel, badgeX + badgeW / 2, badgeY + 4.2, { align: "center" });

  // ── From (left) / Ship To (right) — side by side ──
  let leftY = badgeY + badgeH + 4;
  let rightY = leftY;

  // From
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(0);
  doc.text("From:", 14, leftY);
  leftY += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(60);
  if (order.company_name) {
    doc.text(order.company_name, 14, leftY);
    leftY += 5;
  }
  if (order.company_address) {
    const lines = doc.splitTextToSize(order.company_address, 80) as string[];
    lines.forEach((line: string) => {
      doc.text(line, 14, leftY);
      leftY += 5;
    });
  }
  if (order.company_tax_id) {
    doc.text(`Ph# ${order.company_tax_id}`, 14, leftY);
    leftY += 5;
  }

  // Ship To
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(0);
  doc.text("Ship to:", midX, rightY);
  rightY += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(60);
  doc.text(order.store_business_name || order.store_name, midX, rightY);
  rightY += 5;
  if (order.store_address) {
    const lines = doc.splitTextToSize(order.store_address, 80) as string[];
    lines.forEach((line: string) => {
      doc.text(line, midX, rightY);
      rightY += 5;
    });
  }
  if (order.store_postal_code) {
    doc.text(order.store_postal_code, midX, rightY);
    rightY += 5;
  }
  if (order.store_phone) {
    doc.text(order.store_phone, midX, rightY);
    rightY += 5;
  }
  if (order.store_email) {
    doc.text(order.store_email, midX, rightY);
    rightY += 5;
  }

  let y = Math.max(leftY, rightY) + 4;

  // Items table
  y += 4;
  const tableData = items.map((item) => [
    item.product_name,
    item.modifier,
    fmt(Number(item.unit_price)),
    item.quantity.toString(),
    fmt(Number(item.line_total)),
  ]);

  const taxRatePercent = (Number(order.tax_rate) * 100).toFixed(2);
  const adFee = Number(order.ad_royalties_fee ?? 0);

  autoTable(doc, {
    startY: y,
    head: [["Product", "Modifier", "Unit Price", "Qty", "Line Total"]],
    body: tableData,
    theme: "striped",
    headStyles: { fillColor: [24, 24, 27] },
    columnStyles: {
      2: { halign: "right" },
      3: { halign: "center" },
      4: { halign: "right" },
    },
    didParseCell: (data) => {
      if (data.section === "head") {
        if (data.column.index === 2) data.cell.styles.halign = "right";
        if (data.column.index === 3) data.cell.styles.halign = "center";
        if (data.column.index === 4) data.cell.styles.halign = "right";
      }
    },
  });

  // Totals — rendered manually so values align with the Line Total column
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginRight = 14;
  const valueX = pageWidth - marginRight;
  const labelX = valueX - 45;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let ty = (doc as any).lastAutoTable.finalY + 8;

  doc.setFontSize(10);
  doc.setTextColor(0);

  const totalsLines: [string, string][] = [
    ["Subtotal:", fmt(Number(order.subtotal))],
    [`HST (${taxRatePercent}%):`, fmt(Number(order.tax_amount))],
  ];
  if (adFee > 0) {
    totalsLines.push(["Ad & Royalties Fee:", fmt(adFee)]);
  }
  totalsLines.push(["Grand Total:", fmt(Number(order.grand_total))]);

  totalsLines.forEach(([label, value], idx) => {
    const isLast = idx === totalsLines.length - 1;
    if (isLast) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      ty += 3;
      doc.setDrawColor(200);
      doc.setLineWidth(0.2);
      doc.line(labelX + 2, ty - 5, valueX, ty - 5);
    }
    doc.text(label, labelX, ty, { align: "right" });
    doc.text(value, valueX, ty, { align: "right" });
    ty += 6;
  });

  return doc.output("blob");
}

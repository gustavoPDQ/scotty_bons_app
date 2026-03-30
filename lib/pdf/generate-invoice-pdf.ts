import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { INVOICE_LOGO_BASE64 } from "./invoice-logo";

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

export function generateInvoicePdf(
  invoice: InvoiceData,
  items: InvoiceItem[],
): Blob {
  const doc = new jsPDF();
  const dateFmt = new Intl.DateTimeFormat("en-CA", { dateStyle: "long" });
  const fmt = (v: number) => `$${Number(v).toFixed(2)}`;
  const rightX = 196;
  const midX = 110;

  // ── Header: Logo + brand name (left) / Invoice number + date (right) ──
  doc.addImage(INVOICE_LOGO_BASE64, "PNG", 14, 11, 16, 16);
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
  doc.text(dateFmt.format(new Date(invoice.created_at)), rightX, 23, {
    align: "right",
  });

  // ── From (left) / Ship To (right) — side by side ──
  let leftY = 38;
  let rightY = 38;

  // From
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(0);
  doc.text("From:", 14, leftY);
  leftY += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(60);
  if (invoice.company_name) {
    doc.text(invoice.company_name, 14, leftY);
    leftY += 5;
  }
  if (invoice.company_address) {
    const lines = doc.splitTextToSize(invoice.company_address, 80) as string[];
    lines.forEach((line: string) => {
      doc.text(line, 14, leftY);
      leftY += 5;
    });
  }
  if (invoice.company_tax_id) {
    doc.text(`Ph# ${invoice.company_tax_id}`, 14, leftY);
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
  doc.text(invoice.store_business_name || invoice.store_name, midX, rightY);
  rightY += 5;
  if (invoice.store_address) {
    const lines = doc.splitTextToSize(invoice.store_address, 80) as string[];
    lines.forEach((line: string) => {
      doc.text(line, midX, rightY);
      rightY += 5;
    });
  }
  if (invoice.store_postal_code) {
    doc.text(invoice.store_postal_code, midX, rightY);
    rightY += 5;
  }
  if (invoice.store_phone) {
    doc.text(invoice.store_phone, midX, rightY);
    rightY += 5;
  }
  if (invoice.store_email) {
    doc.text(invoice.store_email, midX, rightY);
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

  const taxRatePercent = (Number(invoice.tax_rate) * 100).toFixed(2);
  const adFee = Number(invoice.ad_royalties_fee ?? 0);

  autoTable(doc, {
    startY: y,
    head: [["Product", "Modifier", "Unit Price", "Qty", "Line Total"]],
    body: tableData,
    theme: "striped",
    headStyles: { fillColor: [24, 24, 27] },
    columnStyles: {
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "right" },
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
    ["Subtotal:", fmt(Number(invoice.subtotal))],
    [`HST (${taxRatePercent}%):`, fmt(Number(invoice.tax_amount))],
  ];
  if (adFee > 0) {
    totalsLines.push(["Ad & Royalties Fee:", fmt(adFee)]);
  }
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

  return doc.output("blob");
}

import type React from "react";
import type { OrderStatus } from "@/lib/types";

export const STATUS_STYLES: Record<OrderStatus, React.CSSProperties> = {
  submitted: { backgroundColor: "#4b5563", color: "#fff", borderColor: "transparent" },
  approved: { backgroundColor: "#15803d", color: "#fff", borderColor: "transparent" },
  declined: { backgroundColor: "#b91c1c", color: "#fff", borderColor: "transparent" },
  fulfilled: { backgroundColor: "#1d4ed8", color: "#fff", borderColor: "transparent" },
};

export const STATUS_BORDER_COLORS: Record<OrderStatus, string> = {
  submitted: "border-gray-400",
  approved: "border-green-600",
  declined: "border-red-600",
  fulfilled: "border-blue-600",
};

export const STATUS_LABELS: Record<OrderStatus, string> = {
  submitted: "Submitted",
  approved: "Approved",
  declined: "Declined",
  fulfilled: "Fulfilled",
};

export const TERMINAL_STATUSES: OrderStatus[] = ["approved", "declined", "fulfilled"];

import type React from "react";
import type { AuditRating } from "@/lib/types";

export function getScoreColor(score: number): string {
  if (score >= 80) return "text-green-600 bg-green-50 border-green-200";
  if (score >= 60) return "text-amber-600 bg-amber-50 border-amber-200";
  return "text-red-600 bg-red-50 border-red-200";
}

export function getScoreLabel(score: number): string {
  if (score >= 80) return "Good";
  if (score >= 60) return "Needs Improvement";
  return "Critical";
}

export const AUDIT_RATING_LABELS: Record<AuditRating, string> = {
  poor: "Poor",
  satisfactory: "Satisfactory",
  good: "Good",
};

export const AUDIT_RATING_STYLES: Record<AuditRating, React.CSSProperties> = {
  poor: { backgroundColor: "#fecaca", color: "#991b1b", borderColor: "transparent" },
  satisfactory: { backgroundColor: "#fef08a", color: "#854d0e", borderColor: "transparent" },
  good: { backgroundColor: "#bbf7d0", color: "#166534", borderColor: "transparent" },
};

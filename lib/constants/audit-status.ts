import type { AuditStatus } from "@/lib/types";

export const AUDIT_STATUS_LABELS: Record<AuditStatus, string> = {
  draft: "Draft",
  completed: "Completed",
};

export const AUDIT_STATUS_COLORS: Record<AuditStatus, string> = {
  draft: "bg-gray-500 text-white",
  completed: "bg-green-600 text-white",
};

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

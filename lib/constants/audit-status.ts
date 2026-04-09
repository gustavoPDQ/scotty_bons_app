import type React from "react";

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

/** Returns a colored badge style based on the rating weight (0 = red, 0.5 = yellow, 1 = green). */
export function getRatingStyle(weight: number): React.CSSProperties {
  if (weight >= 0.75) return { backgroundColor: "#bbf7d0", color: "#166534", borderColor: "transparent" };
  if (weight >= 0.35) return { backgroundColor: "#fef08a", color: "#854d0e", borderColor: "transparent" };
  return { backgroundColor: "#fecaca", color: "#991b1b", borderColor: "transparent" };
}

/** Returns an rgb color tuple for PDF rendering based on weight. */
export function getRatingPdfColor(weight: number): [number, number, number] {
  if (weight >= 0.75) return [34, 197, 94];
  if (weight >= 0.35) return [234, 179, 8];
  return [239, 68, 68];
}

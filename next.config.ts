import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Runtime: Node.js (not Edge) — required for Supabase server-side operations
  // and @react-pdf/renderer (planned Sprint 3). Do NOT add `runtime: 'edge'`.
  // Source: architecture.md — D13
};

export default nextConfig;

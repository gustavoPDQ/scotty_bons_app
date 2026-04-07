import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Clock,
  CheckCircle,
  XCircle,
  PackageCheck,
  ArrowRight,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getUser, getProfile } from "@/lib/supabase/auth-cache";
import { createPageTimer } from "@/lib/perf";
import { Card, CardContent } from "@/components/ui/card";
import { formatPrice } from "@/lib/utils";
import { STATUS_LABELS } from "@/lib/constants/order-status";
import type { OrderStatus } from "@/lib/types";
import { OrderValueChart } from "@/components/dashboard/order-value-chart";
import type { OrderValueDataPoint } from "@/components/dashboard/order-value-chart";
import {
  AuditRankingSection,
  type AuditRankingRow,
  type AuditScoreDataPoint,
} from "@/components/dashboard/audit-ranking-section";
import { TopProductsSection } from "@/components/dashboard/top-products-section";
import { DashboardDateFilter } from "@/components/dashboard/dashboard-date-filter";
import { DashboardStoreFilter } from "@/components/dashboard/dashboard-store-filter";

function getDateRange(range: string): { from: Date; label: string } {
  const now = new Date();
  switch (range) {
    case "7d": {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      return { from: d, label: "Last 7 days" };
    }
    case "30d": {
      const d = new Date(now);
      d.setDate(d.getDate() - 30);
      return { from: d, label: "Last 30 days" };
    }
    case "3m": {
      const d = new Date(now);
      d.setMonth(d.getMonth() - 3);
      return { from: d, label: "Last 3 months" };
    }
    case "6m": {
      const d = new Date(now);
      d.setMonth(d.getMonth() - 6);
      return { from: d, label: "Last 6 months" };
    }
    case "all":
      return { from: new Date(0), label: "All time" };
    case "12m":
    default: {
      const d = new Date(now);
      d.setMonth(d.getMonth() - 12);
      return { from: d, label: "Last 12 months" };
    }
  }
}

const ALL_STATUSES: OrderStatus[] = [
  "submitted",
  "approved",
  "declined",
  "fulfilled",
];

const STATUS_CARD_CONFIG: Record<
  OrderStatus,
  {
    icon: typeof Clock;
    color: string;
    hoverColor: string;
    bg: string;
    hoverBg: string;
    border: string;
    hoverBorder: string;
  }
> = {
  submitted: {
    icon: Clock,
    color: "text-muted-foreground",
    hoverColor: "group-hover:text-orange-600",
    bg: "bg-muted/60",
    hoverBg: "group-hover:bg-orange-50",
    border: "border-l-gray-200",
    hoverBorder: "hover:border-l-orange-500",
  },
  approved: {
    icon: CheckCircle,
    color: "text-muted-foreground",
    hoverColor: "group-hover:text-emerald-600",
    bg: "bg-muted/60",
    hoverBg: "group-hover:bg-emerald-50",
    border: "border-l-gray-200",
    hoverBorder: "hover:border-l-emerald-500",
  },
  declined: {
    icon: XCircle,
    color: "text-muted-foreground",
    hoverColor: "group-hover:text-red-600",
    bg: "bg-muted/60",
    hoverBg: "group-hover:bg-red-50",
    border: "border-l-gray-200",
    hoverBorder: "hover:border-l-red-500",
  },
  fulfilled: {
    icon: PackageCheck,
    color: "text-muted-foreground",
    hoverColor: "group-hover:text-blue-600",
    bg: "bg-muted/60",
    hoverBg: "group-hover:bg-blue-50",
    border: "border-l-gray-200",
    hoverBorder: "hover:border-l-blue-500",
  },
};

const STORE_PALETTE = [
  "#3b82f6",
  "#ef4444",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#84cc16",
  "#f97316",
  "#6366f1",
];

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string; store?: string }>;
}) {
  const { range: rangeParam, from: fromParam, to: toParam, store: storeParam } = await searchParams;

  // Custom date range takes precedence over presets
  const isCustomRange = !!(fromParam && toParam);
  const rangeKey = isCustomRange ? "custom" : (rangeParam ?? "12m");

  let rangeFrom: Date;
  let rangeTo: Date | undefined;
  let rangeLabel: string;

  if (isCustomRange) {
    rangeFrom = new Date(fromParam);
    rangeTo = new Date(toParam + "T23:59:59.999Z");
    const fmt = new Intl.DateTimeFormat("en-CA", { dateStyle: "medium" });
    rangeLabel = `${fmt.format(rangeFrom)} – ${fmt.format(new Date(toParam))}`;
  } else {
    const result = getDateRange(rangeKey);
    rangeFrom = result.from;
    rangeLabel = result.label;
  }

  const timer = createPageTimer("Dashboard");
  const user = await timer.time("auth.getUser(cached)", () => getUser());
  if (!user) redirect("/login");

  const profile = await timer.time("profiles.select(cached)", () => getProfile());
  if (!profile || profile.role !== "admin") redirect("/orders");

  const supabase = await createClient();

  // ── Resolve "all" range to earliest data date ──
  let resolvedRangeFrom = rangeFrom;
  if (rangeKey === "all") {
    const [earliestOrder, earliestAudit] = await timer.time(
      "earliest-dates",
      () =>
        Promise.all([
          supabase
            .from("orders")
            .select("created_at")
            .order("created_at", { ascending: true })
            .limit(1)
            .single(),
          supabase
            .from("audits")
            .select("conducted_at")
            .not("conducted_at", "is", null)
            .order("conducted_at", { ascending: true })
            .limit(1)
            .single(),
        ])
    );

    const dates = [
      earliestOrder.data?.created_at,
      earliestAudit.data?.conducted_at,
    ].filter(Boolean) as string[];

    if (dates.length > 0) {
      dates.sort();
      resolvedRangeFrom = new Date(dates[0]);
    }
  }

  const rangeFromISO = resolvedRangeFrom.toISOString();
  const rangeToISO = rangeTo?.toISOString();

  // ── Resolve store filter ──
  const storeFilterId = storeParam ?? "all";

  // ── Fetch all data in parallel (filtered by date range + store) ──
  let ordersQuery = supabase
    .from("orders")
    .select("id, order_number, store_id, status, created_at")
    .gte("created_at", rangeFromISO)
    .order("created_at", { ascending: false });
  if (rangeToISO) ordersQuery = ordersQuery.lte("created_at", rangeToISO);
  if (storeFilterId !== "all") ordersQuery = ordersQuery.eq("store_id", storeFilterId);

  let auditsQuery = supabase
    .from("audits")
    .select("id, store_id, score, conducted_at")
    .not("conducted_at", "is", null)
    .gte("conducted_at", rangeFromISO)
    .order("conducted_at", { ascending: true });
  if (rangeToISO) auditsQuery = auditsQuery.lte("conducted_at", rangeToISO);
  if (storeFilterId !== "all") auditsQuery = auditsQuery.eq("store_id", storeFilterId);

  const [
    ordersResult,
    itemsResult,
    storesResult,
    completedAuditsResult,
    productsResult,
    categoriesResult,
  ] = await timer.time("main-parallel-queries", () =>
    Promise.all([
      ordersQuery,
      supabase
        .from("order_items")
        .select("order_id, product_name, modifier, unit_price, quantity"),
      supabase.from("stores").select("id, name"),
      auditsQuery,
      supabase.from("products").select("id, name, category_id, product_modifiers(label)"),
      supabase.from("product_categories").select("id, name"),
    ])
  );

  const orders = ordersResult.data ?? [];
  const allRawItems = itemsResult.data ?? [];
  const stores = storesResult.data ?? [];
  const completedAudits = completedAuditsResult.data ?? [];
  const products = productsResult.data ?? [];
  const categories = categoriesResult.data ?? [];

  // Filter items to only those belonging to orders in the date range
  const orderIdSet = new Set(orders.map((o) => o.id));
  const allItems = allRawItems.filter((item) => orderIdSet.has(item.order_id));

  // ── Maps ──
  const storeNameMap: Record<string, string> = {};
  for (const store of stores) storeNameMap[store.id] = store.name;

  const sortedStoreNames = stores
    .map((s) => s.name)
    .sort((a, b) => a.localeCompare(b));

  const storeColors: Record<string, string> = {};
  sortedStoreNames.forEach((name, i) => {
    storeColors[name] = STORE_PALETTE[i % STORE_PALETTE.length];
  });

  const categoryNameMap: Record<string, string> = {};
  for (const cat of categories) categoryNameMap[cat.id] = cat.name;

  const productCategoryMap: Record<string, string> = {};
  for (const p of products) {
    const mods = (p as { product_modifiers?: { label: string }[] }).product_modifiers ?? [];
    if (mods.length > 0) {
      for (const m of mods) {
        const key = `${p.name}|${m.label}`;
        productCategoryMap[key] = categoryNameMap[p.category_id] ?? "Uncategorized";
      }
    } else {
      // Fallback for products without modifiers
      productCategoryMap[`${p.name}|`] = categoryNameMap[p.category_id] ?? "Uncategorized";
    }
  }

  const orderStoreMap: Record<string, string> = {};
  const orderStatusMap: Record<string, string> = {};
  for (const order of orders) {
    orderStoreMap[order.id] = order.store_id;
    orderStatusMap[order.id] = order.status;
  }

  const orderTotals: Record<string, number> = {};
  for (const item of allItems) {
    orderTotals[item.order_id] =
      (orderTotals[item.order_id] ?? 0) +
      Number(item.unit_price) * item.quantity;
  }

  // ══════════════════════════════════════════════
  // 1. ORDER STATUS COUNTS
  // ══════════════════════════════════════════════
  const statusCounts: Record<OrderStatus, number> = {
    submitted: 0,
    approved: 0,
    declined: 0,
    fulfilled: 0,
  };
  for (const order of orders) {
    const s = order.status as OrderStatus;
    if (s in statusCounts) statusCounts[s]++;
  }

  // ══════════════════════════════════════════════
  // 2. ORDER VALUE CHART (per store, within date range)
  // ══════════════════════════════════════════════
  const orderValueByMonthStore: Record<string, Record<string, number>> = {};
  for (const order of orders) {
    const d = new Date(order.created_at);
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const storeName = storeNameMap[order.store_id] ?? "Unknown";

    if (!orderValueByMonthStore[monthKey])
      orderValueByMonthStore[monthKey] = {};
    orderValueByMonthStore[monthKey][storeName] =
      (orderValueByMonthStore[monthKey][storeName] ?? 0) +
      (orderTotals[order.id] ?? 0);
  }

  // Generate month labels from rangeFrom to now
  const orderValueChartData: OrderValueDataPoint[] = [];
  const chartStart = new Date(resolvedRangeFrom.getFullYear(), resolvedRangeFrom.getMonth(), 1);
  const chartEnd = new Date();
  const cursor = new Date(chartStart);
  while (cursor <= chartEnd) {
    const monthKey = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
    const label = new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "short",
    }).format(cursor);

    const point: OrderValueDataPoint = { month: label };
    const monthData = orderValueByMonthStore[monthKey] ?? {};
    for (const storeName of sortedStoreNames) {
      point[storeName] = monthData[storeName] ?? 0;
    }
    orderValueChartData.push(point);
    cursor.setMonth(cursor.getMonth() + 1);
  }

  // ══════════════════════════════════════════════
  // 3. AUDIT RANKING (with per-store score history + total order value)
  // ══════════════════════════════════════════════

  // Total order value per store (all time)
  const storeOrderValue: Record<string, number> = {};
  for (const order of orders) {
    const storeName = storeNameMap[order.store_id] ?? "Unknown";
    storeOrderValue[storeName] =
      (storeOrderValue[storeName] ?? 0) + (orderTotals[order.id] ?? 0);
  }

  // Audit aggregation per store
  const storeAuditAgg: Record<
    string,
    {
      totalScore: number;
      count: number;
      lastDate: string;
      history: { monthKey: string; sum: number; count: number }[];
    }
  > = {};

  // Per-store per-month scores for history chart
  const storeMonthScores: Record<
    string,
    Record<string, { sum: number; count: number }>
  > = {};

  for (const audit of completedAudits) {
    if (audit.score === null || !audit.conducted_at) continue;
    const storeName = storeNameMap[audit.store_id] ?? "Unknown";

    const existing = storeAuditAgg[storeName] ?? {
      totalScore: 0,
      count: 0,
      lastDate: "",
      history: [],
    };
    existing.totalScore += audit.score;
    existing.count++;
    if (audit.conducted_at > existing.lastDate) {
      existing.lastDate = audit.conducted_at;
    }
    storeAuditAgg[storeName] = existing;

    // Monthly scores
    const d = new Date(audit.conducted_at);
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!storeMonthScores[storeName]) storeMonthScores[storeName] = {};
    const monthEntry = storeMonthScores[storeName][monthKey] ?? {
      sum: 0,
      count: 0,
    };
    monthEntry.sum += audit.score;
    monthEntry.count++;
    storeMonthScores[storeName][monthKey] = monthEntry;
  }

  const auditRanking: AuditRankingRow[] = Object.entries(storeAuditAgg)
    .map(([storeName, data]) => {
      const avgScore = data.totalScore / data.count;
      const lastDate = data.lastDate ? new Date(data.lastDate) : null;
      const daysSince = lastDate
        ? Math.floor(
            (Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24),
          )
        : null;

      // Build score history for this store
      const monthScores = storeMonthScores[storeName] ?? {};
      const scoreHistory: AuditScoreDataPoint[] = Object.keys(monthScores)
        .sort()
        .map((mk) => {
          const [y, m] = mk.split("-");
          const label = new Intl.DateTimeFormat("en-CA", {
            year: "numeric",
            month: "short",
          }).format(new Date(Number(y), Number(m) - 1));
          const entry = monthScores[mk];
          return {
            date: label,
            score: Math.round((entry.sum / entry.count) * 100) / 100,
          };
        });

      return {
        storeName,
        avgScore,
        count: data.count,
        lastDate: data.lastDate,
        daysSince,
        totalOrderValue: storeOrderValue[storeName] ?? 0,
        scoreHistory,
        color: storeColors[storeName] ?? "#3b82f6",
      };
    })
    .sort((a, b) => b.avgScore - a.avgScore);

  // ══════════════════════════════════════════════
  // 4. TOP STORES, CATEGORIES & PRODUCTS (raw items for client-side aggregation)
  // ══════════════════════════════════════════════
  const rawItemsForTop = allItems.map((item) => ({
    product_name: item.product_name,
    modifier: item.modifier,
    unit_price: Number(item.unit_price),
    quantity: item.quantity,
    status: orderStatusMap[item.order_id] ?? "",
    store_name: storeNameMap[orderStoreMap[item.order_id]] ?? "Unknown",
  }));

  timer.summary();

  // ── Formatting helpers ──
  const dateFmt = new Intl.DateTimeFormat("en-CA", { dateStyle: "medium" });

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* ── Header ── */}
      <div className="sticky -top-4 sm:-top-6 z-20 bg-background border-b -mx-4 px-4 pt-4 pb-3 sm:-mx-6 sm:px-6 sm:pt-6 -mt-4 sm:-mt-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              {rangeLabel} &middot; {dateFmt.format(new Date())}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <DashboardStoreFilter
              stores={stores
                .map((s) => ({ id: s.id, name: s.name }))
                .sort((a, b) => a.name.localeCompare(b.name))}
              current={storeFilterId}
            />
            <DashboardDateFilter current={rangeKey} />
          </div>
        </div>
      </div>

      {/* ══ 1. Order Status Cards ══ */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {ALL_STATUSES.map((status) => {
          const config = STATUS_CARD_CONFIG[status];
          const Icon = config.icon;
          const count = statusCounts[status];
          const viewOrdersParams = new URLSearchParams({ status });
          if (rangeKey !== "all") {
            const fromStr = rangeFrom.toISOString().slice(0, 10);
            const toStr = (rangeTo ?? new Date()).toISOString().slice(0, 10);
            viewOrdersParams.set("from", fromStr);
            viewOrdersParams.set("to", toStr);
          }
          if (storeFilterId !== "all") {
            viewOrdersParams.set("store_id", storeFilterId);
          }
          return (
            <Card
              key={status}
              className={`group border-l-4 ${config.border} ${config.hoverBorder} hover:shadow-md transition-all`}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div
                    className={`rounded-full ${config.bg} ${config.hoverBg} p-2.5 transition-colors`}
                  >
                    <Icon
                      className={`size-4 ${config.color} ${config.hoverColor} transition-colors`}
                    />
                  </div>
                  <span className="text-3xl font-bold tabular-nums">
                    {count}
                  </span>
                </div>
                <p className="text-sm font-medium text-muted-foreground">
                  {STATUS_LABELS[status]}
                </p>
                <Link
                  href={`/orders?${viewOrdersParams.toString()}`}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground font-medium mt-2 group-hover:text-primary hover:underline transition-colors"
                >
                  View orders <ArrowRight className="size-3" />
                </Link>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ══ 2. Monthly Order Value (bar chart with store filter) ══ */}
      <OrderValueChart
        data={orderValueChartData}
        storeNames={sortedStoreNames}
        colors={storeColors}
        rangeLabel={rangeLabel}
        selectedStoreName={storeFilterId !== "all" ? storeNameMap[storeFilterId] : undefined}
      />

      {/* ══ 3. Audit Ranking (with expandable per-store score chart) ══ */}
      <AuditRankingSection
        rows={auditRanking}
        dateFmt={dateFmt.format(new Date())}
      />

      {/* ══ 4. Top Categories & Products ══ */}
      <TopProductsSection
        stores={stores
          .map((s) => ({ id: s.id, name: s.name }))
          .sort((a, b) => a.name.localeCompare(b.name))}
        rawItems={rawItemsForTop}
        categoryNames={categories.map((c) => c.name).sort()}
        productNames={[...new Set(products.map((p) => p.name))].sort()}
        productCategoryMap={productCategoryMap}
        currentRange={rangeKey}
        currentStoreFilter={storeFilterId}
        currentDateFrom={fromParam}
        currentDateTo={toParam}
      />
    </div>
  );
}

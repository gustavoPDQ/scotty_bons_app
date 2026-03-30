"use client";

import { Fragment, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { ChevronDown, ChevronRight, ClipboardCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getScoreColor } from "@/lib/constants/audit-status";

export interface AuditScoreDataPoint {
  date: string;
  score: number;
}

export interface AuditRankingRow {
  storeName: string;
  avgScore: number;
  count: number;
  lastDate: string;
  daysSince: number | null;
  totalOrderValue: number;
  scoreHistory: AuditScoreDataPoint[];
  color: string;
}

interface AuditRankingSectionProps {
  rows: AuditRankingRow[];
  dateFmt: string;
}

export function AuditRankingSection({ rows, dateFmt }: AuditRankingSectionProps) {
  const [expandedStore, setExpandedStore] = useState<string | null>(null);

  const toggle = (storeName: string) => {
    setExpandedStore((prev) => (prev === storeName ? null : storeName));
  };

  const formatDate = (dateStr: string) => {
    return new Intl.DateTimeFormat("en-CA", { dateStyle: "medium" }).format(
      new Date(dateStr),
    );
  };

  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="p-5">
          <h2 className="text-lg font-semibold mb-4">Audit Ranking</h2>
          <div className="text-center py-8">
            <ClipboardCheck className="mx-auto size-10 text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">
              No completed audits yet.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-5">
        <h2 className="text-lg font-semibold mb-4">Audit Ranking</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="pb-2 font-medium w-12">#</th>
                <th className="pb-2 font-medium">Store</th>
                <th className="pb-2 font-medium text-center">Audits</th>
                <th className="pb-2 font-medium text-center">Avg Score</th>
                <th className="pb-2 font-medium text-right hidden sm:table-cell">Last Audit</th>
                <th className="pb-2 font-medium text-right hidden sm:table-cell">Days Since</th>
                <th className="pb-2 font-medium w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((row, idx) => {
                const isExpanded = expandedStore === row.storeName;
                const hasHistory = row.scoreHistory.length > 1;
                const rowClass = hasHistory
                  ? "cursor-pointer hover:bg-muted/50 transition-colors"
                  : "";
                return (
                  <Fragment key={row.storeName}>
                    {/* Data row */}
                    <tr
                      className={rowClass}
                      onClick={() => hasHistory && toggle(row.storeName)}
                    >
                      <td className="py-2.5">
                        <span
                          className={`flex items-center justify-center size-7 rounded-full text-xs font-bold ${
                            idx === 0
                              ? "bg-primary text-white"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {idx + 1}
                        </span>
                      </td>
                      <td className="py-2.5 font-medium">{row.storeName}</td>
                      <td className="py-2.5 text-center text-muted-foreground">
                        {row.count}
                      </td>
                      <td className="py-2.5 text-center">
                        <Badge
                          variant="outline"
                          className={getScoreColor(row.avgScore)}
                        >
                          {row.avgScore.toFixed(1)}%
                        </Badge>
                      </td>
                      <td className="py-2.5 text-right text-muted-foreground hidden sm:table-cell">
                        {row.lastDate ? formatDate(row.lastDate) : "—"}
                      </td>
                      <td className="py-2.5 text-right hidden sm:table-cell">
                        {row.daysSince !== null ? (
                          <span
                            className={
                              row.daysSince > 30
                                ? "text-red-500/80 font-medium"
                                : row.daysSince > 14
                                  ? "text-amber-500/80 font-medium"
                                  : "text-muted-foreground"
                            }
                          >
                            {row.daysSince}d
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-2.5 text-center">
                        {hasHistory &&
                          (isExpanded ? (
                            <ChevronDown className="size-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="size-4 text-muted-foreground" />
                          ))}
                      </td>
                    </tr>

                    {/* Expanded chart row */}
                    {isExpanded && hasHistory && (
                      <tr>
                        <td colSpan={7} className="p-0">
                          <div className="py-4 px-4 bg-muted/30">
                            <p className="text-xs text-muted-foreground mb-2">
                              Score evolution — {row.storeName}
                            </p>
                            <div className="h-48">
                              <ResponsiveContainer width="100%" height="100%">
                                <LineChart
                                  data={row.scoreHistory}
                                  margin={{
                                    top: 5,
                                    right: 20,
                                    bottom: 5,
                                    left: 0,
                                  }}
                                >
                                  <CartesianGrid
                                    strokeDasharray="3 3"
                                    className="opacity-30"
                                  />
                                  <XAxis
                                    dataKey="date"
                                    tick={{ fontSize: 11 }}
                                    tickLine={false}
                                    axisLine={false}
                                  />
                                  <YAxis
                                    domain={[0, 100]}
                                    tick={{ fontSize: 11 }}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(v) => `${v}%`}
                                  />
                                  <ReferenceLine
                                    y={row.avgScore}
                                    stroke="#9ca3af"
                                    strokeDasharray="4 4"
                                    label={{
                                      value: `Avg ${row.avgScore.toFixed(0)}%`,
                                      position: "right",
                                      style: { fontSize: 10, fill: "#9ca3af" },
                                    }}
                                  />
                                  <Tooltip
                                    contentStyle={{
                                      borderRadius: "8px",
                                      border: "1px solid hsl(var(--border))",
                                      boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                                      fontSize: "13px",
                                    }}
                                    formatter={(value) => [
                                      `${Number(value).toFixed(1)}%`,
                                      "Score",
                                    ]}
                                  />
                                  <Line
                                    type="monotone"
                                    dataKey="score"
                                    stroke={row.color}
                                    strokeWidth={2}
                                    dot={{ r: 4, fill: row.color }}
                                    activeDot={{ r: 6 }}
                                  />
                                </LineChart>
                              </ResponsiveContainer>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

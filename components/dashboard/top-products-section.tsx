"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatPrice } from "@/lib/utils";

export interface ProductAggregate {
  name: string;
  modifier: string;
  quantity: number;
  value: number;
}

export interface CategoryAggregate {
  name: string;
  quantity: number;
  value: number;
}

interface TopProductsSectionProps {
  stores: { id: string; name: string }[];
  productsByStore: Record<string, ProductAggregate[]>;
  categoriesByStore: Record<string, CategoryAggregate[]>;
}

export function TopProductsSection({
  stores,
  productsByStore,
  categoriesByStore,
}: TopProductsSectionProps) {
  const [storeFilter, setStoreFilter] = useState("all");

  const products = productsByStore[storeFilter] ?? [];
  const categories = categoriesByStore[storeFilter] ?? [];

  const maxProductQty = Math.max(...products.map((p) => p.quantity), 1);
  const maxCategoryQty = Math.max(...categories.map((c) => c.quantity), 1);

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-4 mb-5">
          <h2 className="text-lg font-semibold">Top Categories & Products</h2>
          <Select value={storeFilter} onValueChange={setStoreFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Stores" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Stores</SelectItem>
              {stores.map((store) => (
                <SelectItem key={store.id} value={store.id}>
                  {store.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Top Categories */}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Categories
            </h3>
            {categories.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No data available.
              </p>
            ) : (
              <div className="space-y-2.5">
                {categories.map((cat, idx) => (
                  <div key={cat.name} className="flex items-center gap-3">
                    <span
                      className="flex items-center justify-center size-7 rounded-full text-xs font-bold shrink-0 bg-muted text-muted-foreground"
                    >
                      {idx + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium truncate mr-2">
                          {cat.name}
                        </span>
                        <div className="flex items-center gap-2 sm:gap-3 text-sm shrink-0">
                          <span className="text-muted-foreground tabular-nums hidden sm:inline">
                            {cat.quantity} units
                          </span>
                          <span className="font-semibold tabular-nums text-xs sm:text-sm">
                            {formatPrice(cat.value)}
                          </span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary/70 transition-all"
                          style={{
                            width: `${(cat.quantity / maxCategoryQty) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Top Products */}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Products
            </h3>
            {products.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No data available.
              </p>
            ) : (
              <div className="space-y-2.5">
                {products.map((product, idx) => (
                  <div
                    key={`${product.name}|${product.modifier}`}
                    className="flex items-center gap-3"
                  >
                    <span
                      className="flex items-center justify-center size-7 rounded-full text-xs font-bold shrink-0 bg-muted text-muted-foreground"
                    >
                      {idx + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium truncate mr-2">
                          {product.name}
                          {product.modifier && (
                            <span className="text-xs text-muted-foreground ml-1">
                              ({product.modifier})
                            </span>
                          )}
                        </span>
                        <div className="flex items-center gap-2 sm:gap-3 text-sm shrink-0">
                          <span className="text-muted-foreground tabular-nums hidden sm:inline">
                            {product.quantity} units
                          </span>
                          <span className="font-semibold tabular-nums text-xs sm:text-sm">
                            {formatPrice(product.value)}
                          </span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-emerald-500/70 transition-all"
                          style={{
                            width: `${(product.quantity / maxProductQty) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

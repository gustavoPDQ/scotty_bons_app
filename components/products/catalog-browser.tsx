"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Package } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn, formatPrice } from "@/lib/utils";
import type { CategoryRow, ProductRow } from "@/lib/types";

interface CatalogBrowserProps {
  categories: CategoryRow[];
  products: ProductRow[];
}

export function CatalogBrowser({ categories, products }: CatalogBrowserProps) {
  const [activeCategory, setActiveCategory] = useState<string>("");
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Group products by category_id
  const productsByCategory = useMemo(() => {
    const map = new Map<string, ProductRow[]>();
    for (const product of products) {
      const existing = map.get(product.category_id) ?? [];
      existing.push(product);
      map.set(product.category_id, existing);
    }
    return map;
  }, [products]);

  // Only show categories that have products
  const categoriesWithProducts = useMemo(
    () => categories.filter((cat) => (productsByCategory.get(cat.id)?.length ?? 0) > 0),
    [categories, productsByCategory]
  );

  // Set up IntersectionObserver
  useEffect(() => {
    if (categoriesWithProducts.length === 0) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveCategory(entry.target.id);
          }
        }
      },
      { rootMargin: "-80px 0px -80% 0px", threshold: 0 }
    );

    for (const cat of categoriesWithProducts) {
      const el = document.getElementById(cat.id);
      if (el) observerRef.current.observe(el);
    }

    return () => {
      observerRef.current?.disconnect();
    };
  }, [categoriesWithProducts]);

  const scrollToCategory = (categoryId: string) => {
    const el = document.getElementById(categoryId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  // Empty state: no products at all
  if (products.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Package className="mx-auto size-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No products available</h3>
          <p className="text-sm text-muted-foreground">
            The product catalog is empty. Please contact your administrator.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Sticky category navigation */}
      <nav aria-label="Category navigation" className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b">
        <div className="flex gap-2 overflow-x-auto py-3 px-1">
          {categoriesWithProducts.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => scrollToCategory(cat.id)}
              className={cn(
                "px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors",
                activeCategory === cat.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {cat.name} ({productsByCategory.get(cat.id)?.length ?? 0})
            </button>
          ))}
        </div>
      </nav>

      {/* Category sections */}
      {categoriesWithProducts.map((cat) => (
        <section key={cat.id} id={cat.id} className="scroll-mt-16">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{cat.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border divide-y">
                {(productsByCategory.get(cat.id) ?? []).map((product) => (
                  <div
                    key={product.id}
                    className="flex items-center gap-3 px-4 py-3"
                  >
                    {product.image_url ? (
                      <div className="relative size-10 shrink-0 rounded overflow-hidden bg-muted">
                        <Image
                          src={product.image_url}
                          alt={product.name}
                          fill
                          className="object-cover"
                          sizes="40px"
                        />
                      </div>
                    ) : (
                      <Package className="size-4 text-muted-foreground shrink-0" />
                    )}
                    <div>
                      <span className="text-sm font-medium">{product.name}</span>
                      <p className="text-xs text-muted-foreground">
                        {formatPrice(product.price)} &middot; {product.unit_of_measure}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>
      ))}
    </div>
  );
}

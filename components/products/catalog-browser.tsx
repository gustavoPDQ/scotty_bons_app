"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Package, PackageCheck, PackageX, Search, X } from "lucide-react";
import { ProductImageLightbox, type LightboxState } from "@/components/products/product-image-lightbox";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn, formatPrice } from "@/lib/utils";
import type { CategoryRow, ProductRow } from "@/lib/types";
import { toggleProductStock } from "@/app/(dashboard)/products/actions";

interface CatalogBrowserProps {
  categories: CategoryRow[];
  products: ProductRow[];
  userRole?: "commissary" | "store";
}

export function CatalogBrowser({ categories, products, userRole }: CatalogBrowserProps) {
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isTogglingStock, startStockTransition] = useTransition();
  const observerRef = useRef<IntersectionObserver | null>(null);
  const canToggleStock = userRole === "commissary";
  const [lightbox, setLightbox] = useState<LightboxState>(null);

  // Filter products by search query
  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return products;
    const q = searchQuery.toLowerCase();
    return products.filter((p) => p.name.toLowerCase().includes(q));
  }, [products, searchQuery]);

  // Group products by category_id
  const productsByCategory = useMemo(() => {
    const map = new Map<string, ProductRow[]>();
    for (const product of filteredProducts) {
      const existing = map.get(product.category_id) ?? [];
      existing.push(product);
      map.set(product.category_id, existing);
    }
    return map;
  }, [filteredProducts]);

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

  const handleToggleStock = (productId: string) => {
    startStockTransition(async () => {
      const result = await toggleProductStock(productId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Stock status updated.");
      router.refresh();
    });
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
      {/* Search bar */}
      <div className="relative">
        <Input
          type="search"
          placeholder="Search products..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          leftIcon={<Search className="size-4" />}
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {/* No results */}
      {filteredProducts.length === 0 && searchQuery.trim() && (
        <Card>
          <CardContent className="p-8 text-center">
            <Search className="mx-auto size-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No products found</h3>
            <p className="text-sm text-muted-foreground">
              No products match &ldquo;{searchQuery}&rdquo;. Try a different search.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Sticky category navigation */}
      {categoriesWithProducts.length > 0 && (
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
      )}

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
                    className={cn(
                      "flex items-center gap-3 px-4 py-3",
                      !product.in_stock && "opacity-60"
                    )}
                  >
                    {product.images?.[0] ? (
                      <button
                        type="button"
                        onClick={() => setLightbox({ images: product.images, name: product.name, index: 0 })}
                        className="relative size-[60px] shrink-0"
                      >
                        <Image
                          src={product.images[0].url}
                          alt={product.name}
                          fill
                          className="object-cover rounded"
                          sizes="60px"
                        />
                        {product.images.length > 1 && (
                          <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                            {product.images.length}
                          </span>
                        )}
                      </button>
                    ) : (
                      <div className="flex size-[60px] shrink-0 items-center justify-center rounded bg-muted">
                        <Package className="size-5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium truncate">{product.name}</span>
                        {!product.in_stock && (
                          <span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-medium text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 shrink-0">
                            Out of Stock
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {product.modifiers.map((m) =>
                          `${m.label} ${formatPrice(m.price)}`
                        ).join(" · ")}
                      </p>
                    </div>
                    {canToggleStock && (
                      <Button
                        variant={product.in_stock ? "outline" : "default"}
                        size="sm"
                        className="shrink-0 text-xs"
                        disabled={isTogglingStock}
                        onClick={() => handleToggleStock(product.id)}
                      >
                        {product.in_stock ? (
                          <>
                            <PackageX className="size-3.5 mr-1.5" />
                            Mark Out of Stock
                          </>
                        ) : (
                          <>
                            <PackageCheck className="size-3.5 mr-1.5" />
                            Mark In Stock
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>
      ))}

      <ProductImageLightbox state={lightbox} onClose={() => setLightbox(null)} onChange={setLightbox} />
    </div>
  );
}

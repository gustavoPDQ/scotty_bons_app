"use client";

import { useEffect, useMemo, useReducer, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Minus, Package, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn, formatPrice } from "@/lib/utils";
import type { CategoryRow, ProductRow } from "@/lib/types";
import { createOrder } from "@/app/(dashboard)/orders/actions";

// ── Cart types ────────────────────────────────────────────────────────────────

type CartItem = {
  product_id: string;
  product_name: string;
  modifier: string;
  unit_price: number;
  quantity: number;
};

type CartState = {
  items: Map<string, CartItem>;
};

type CartAction =
  | { type: "ADD_ITEM"; payload: CartItem }
  | { type: "REMOVE_ITEM"; payload: { product_id: string } }
  | { type: "UPDATE_QUANTITY"; payload: { product_id: string; quantity: number } }
  | { type: "CLEAR_CART" };

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "ADD_ITEM": {
      const next = new Map(state.items);
      const existing = next.get(action.payload.product_id);
      if (existing) {
        next.set(action.payload.product_id, {
          ...existing,
          quantity: existing.quantity + action.payload.quantity,
        });
      } else {
        next.set(action.payload.product_id, action.payload);
      }
      return { items: next };
    }
    case "REMOVE_ITEM": {
      const next = new Map(state.items);
      next.delete(action.payload.product_id);
      return { items: next };
    }
    case "UPDATE_QUANTITY": {
      const next = new Map(state.items);
      if (action.payload.quantity <= 0) {
        next.delete(action.payload.product_id);
      } else {
        const existing = next.get(action.payload.product_id);
        if (existing) {
          next.set(action.payload.product_id, {
            ...existing,
            quantity: action.payload.quantity,
          });
        }
      }
      return { items: next };
    }
    case "CLEAR_CART":
      return { items: new Map() };
    default:
      return state;
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

interface NewOrderCartProps {
  categories: CategoryRow[];
  products: ProductRow[];
  storeId: string;
}

export function NewOrderCart({ categories, products, storeId }: NewOrderCartProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [phase, setPhase] = useState<"browse" | "review">("browse");
  const [cart, dispatch] = useReducer(cartReducer, { items: new Map() });
  const [activeCategory, setActiveCategory] = useState<string>("");
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Group products by category
  const productsByCategory = useMemo(() => {
    const map = new Map<string, ProductRow[]>();
    for (const product of products) {
      const existing = map.get(product.category_id) ?? [];
      existing.push(product);
      map.set(product.category_id, existing);
    }
    return map;
  }, [products]);

  const categoriesWithProducts = useMemo(
    () => categories.filter((cat) => (productsByCategory.get(cat.id)?.length ?? 0) > 0),
    [categories, productsByCategory]
  );

  // Cart computed values
  const cartItems = useMemo(() => Array.from(cart.items.values()), [cart.items]);
  const itemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotal = cartItems.reduce(
    (sum, item) => sum + item.unit_price * item.quantity,
    0
  );

  // IntersectionObserver for sticky category nav
  useEffect(() => {
    if (phase !== "browse" || categoriesWithProducts.length === 0) return;

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
      const el = document.getElementById(`order-cat-${cat.id}`);
      if (el) observerRef.current.observe(el);
    }

    return () => {
      observerRef.current?.disconnect();
    };
  }, [categoriesWithProducts, phase]);

  const scrollToCategory = (categoryId: string) => {
    const el = document.getElementById(`order-cat-${categoryId}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleAddItem = (product: ProductRow) => {
    dispatch({
      type: "ADD_ITEM",
      payload: {
        product_id: product.id,
        product_name: product.name,
        modifier: product.modifier,
        unit_price: product.price,
        quantity: 1,
      },
    });
  };

  const handleSubmit = () => {
    startTransition(async () => {
      const result = await createOrder({
        store_id: storeId,
        items: cartItems,
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      dispatch({ type: "CLEAR_CART" });
      toast.success("Order submitted! The Admin will be notified.");
      router.push("/orders");
    });
  };

  // ── Empty catalog ─────────────────────────────────────────────────────────

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

  // ── Review phase ──────────────────────────────────────────────────────────

  if (phase === "review") {
    return (
      <div className="space-y-4 pb-24">
        <Card>
          <CardHeader>
            <CardTitle>Review Your Order</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border divide-y">
              {cartItems.map((item) => (
                <div
                  key={item.product_id}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.product_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatPrice(item.unit_price)} &middot; {item.modifier}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-8"
                        onClick={() =>
                          dispatch({
                            type: "UPDATE_QUANTITY",
                            payload: {
                              product_id: item.product_id,
                              quantity: item.quantity - 1,
                            },
                          })
                        }
                      >
                        <Minus className="size-3" />
                      </Button>
                      <Input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          if (!Number.isNaN(val)) {
                            dispatch({
                              type: "UPDATE_QUANTITY",
                              payload: {
                                product_id: item.product_id,
                                quantity: Math.max(1, val),
                              },
                            });
                          }
                        }}
                        className="w-16 text-center h-8"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-8"
                        onClick={() =>
                          dispatch({
                            type: "UPDATE_QUANTITY",
                            payload: {
                              product_id: item.product_id,
                              quantity: item.quantity + 1,
                            },
                          })
                        }
                      >
                        <Plus className="size-3" />
                      </Button>
                    </div>
                    <span className="text-sm font-medium w-24 text-right">
                      {formatPrice(item.unit_price * item.quantity)}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-destructive hover:text-destructive"
                      onClick={() =>
                        dispatch({
                          type: "REMOVE_ITEM",
                          payload: { product_id: item.product_id },
                        })
                      }
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center mt-4 pt-4 border-t">
              <span className="text-lg font-semibold">Order Total</span>
              <span className="text-lg font-semibold">{formatPrice(cartTotal)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Sticky action bar */}
        <div className="fixed bottom-0 left-0 right-0 z-20 border-t bg-background/95 backdrop-blur p-4">
          <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
            <Button variant="outline" onClick={() => setPhase("browse")}>
              Edit Order
            </Button>
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">
                {itemCount} {itemCount === 1 ? "item" : "items"} &middot;{" "}
                {formatPrice(cartTotal)}
              </span>
              <Button
                onClick={handleSubmit}
                disabled={isPending || cartItems.length === 0}
              >
                {isPending ? "Submitting..." : "Submit Order"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Browse phase ──────────────────────────────────────────────────────────

  return (
    <div className="space-y-4 pb-24">
      {/* Sticky category navigation */}
      <nav
        aria-label="Category navigation"
        className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b"
      >
        <div className="flex gap-2 overflow-x-auto py-3 px-1">
          {categoriesWithProducts.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => scrollToCategory(cat.id)}
              className={cn(
                "px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors",
                activeCategory === `order-cat-${cat.id}`
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
        <section key={cat.id} id={`order-cat-${cat.id}`} className="scroll-mt-16">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{cat.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border divide-y">
                {(productsByCategory.get(cat.id) ?? []).map((product) => {
                  const inCart = cart.items.get(product.id);
                  return (
                    <div
                      key={product.id}
                      className="flex items-center gap-3 px-4 py-3"
                    >
                      <Package className="size-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium">{product.name}</span>
                        <p className="text-xs text-muted-foreground">
                          {formatPrice(product.price)} &middot;{" "}
                          {product.modifier}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {inCart ? (
                          <div className="flex items-center gap-1">
                            <Button
                              variant="outline"
                              size="icon"
                              className="size-8"
                              onClick={() =>
                                dispatch({
                                  type: "UPDATE_QUANTITY",
                                  payload: {
                                    product_id: product.id,
                                    quantity: inCart.quantity - 1,
                                  },
                                })
                              }
                            >
                              <Minus className="size-3" />
                            </Button>
                            <span className="text-sm font-medium w-8 text-center">
                              {inCart.quantity}
                            </span>
                            <Button
                              variant="outline"
                              size="icon"
                              className="size-8"
                              onClick={() =>
                                dispatch({
                                  type: "UPDATE_QUANTITY",
                                  payload: {
                                    product_id: product.id,
                                    quantity: inCart.quantity + 1,
                                  },
                                })
                              }
                            >
                              <Plus className="size-3" />
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAddItem(product)}
                            className="min-w-[44px]"
                          >
                            Add
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </section>
      ))}

      {/* Sticky order bar */}
      <div className="fixed bottom-0 left-0 right-0 z-20 border-t bg-background/95 backdrop-blur p-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <ShoppingCart className="size-5" />
            {itemCount > 0 && (
              <Badge variant="secondary">{itemCount}</Badge>
            )}
            <span className="text-sm font-medium">{formatPrice(cartTotal)}</span>
          </div>
          <Button
            onClick={() => setPhase("review")}
            disabled={cartItems.length === 0}
          >
            Review Order
          </Button>
        </div>
        {cartItems.length === 0 && (
          <p className="text-xs text-muted-foreground text-center mt-1">
            Add at least one item to continue
          </p>
        )}
      </div>
    </div>
  );
}

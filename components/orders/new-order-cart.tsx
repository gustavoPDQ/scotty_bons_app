"use client";

import { useEffect, useMemo, useReducer, useRef, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Minus, Package, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn, formatPrice } from "@/lib/utils";
import type { CategoryRow, ProductRow, ProductModifierRow } from "@/lib/types";
import { createOrder, adminCreateOrder } from "@/app/(dashboard)/orders/actions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";

// ── Cart types (keyed by modifier_id) ────────────────────────────────────────

type CartItem = {
  modifier_id: string;
  product_id: string;
  product_name: string;
  modifier_label: string;
  unit_price: number;
  quantity: number;
};

type CartState = {
  items: Map<string, CartItem>; // keyed by modifier_id
};

type CartAction =
  | { type: "ADD_ITEM"; payload: CartItem }
  | { type: "REMOVE_ITEM"; payload: { modifier_id: string } }
  | { type: "UPDATE_QUANTITY"; payload: { modifier_id: string; quantity: number } }
  | { type: "CLEAR_CART" };

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "ADD_ITEM": {
      const next = new Map(state.items);
      const existing = next.get(action.payload.modifier_id);
      if (existing) {
        next.set(action.payload.modifier_id, {
          ...existing,
          quantity: existing.quantity + action.payload.quantity,
        });
      } else {
        next.set(action.payload.modifier_id, action.payload);
      }
      return { items: next };
    }
    case "REMOVE_ITEM": {
      const next = new Map(state.items);
      next.delete(action.payload.modifier_id);
      return { items: next };
    }
    case "UPDATE_QUANTITY": {
      const next = new Map(state.items);
      if (action.payload.quantity <= 0) {
        next.delete(action.payload.modifier_id);
      } else {
        const existing = next.get(action.payload.modifier_id);
        if (existing) {
          next.set(action.payload.modifier_id, {
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
  storeId?: string;
  stores?: { id: string; name: string }[];
}

export function NewOrderCart({ categories, products, storeId, stores }: NewOrderCartProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [phase, setPhase] = useState<"browse" | "review">("browse");
  const [cart, dispatch] = useReducer(cartReducer, { items: new Map() });
  const [activeCategory, setActiveCategory] = useState<string>("");
  const [selectedStoreId, setSelectedStoreId] = useState<string>(storeId ?? "");
  const [lightbox, setLightbox] = useState<{ url: string; name: string } | null>(null);
  const isAdmin = !!stores;
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

  const handleAddModifier = (product: ProductRow, modifier: ProductModifierRow) => {
    dispatch({
      type: "ADD_ITEM",
      payload: {
        modifier_id: modifier.id,
        product_id: product.id,
        product_name: product.name,
        modifier_label: modifier.label,
        unit_price: modifier.price,
        quantity: 1,
      },
    });
  };

  const handleSubmit = () => {
    const targetStoreId = isAdmin ? selectedStoreId : storeId;
    if (!targetStoreId) {
      toast.error("Please select a store.");
      return;
    }

    startTransition(async () => {
      const action = isAdmin ? adminCreateOrder : createOrder;
      const result = await action({
        store_id: targetStoreId,
        items: cartItems.map((item) => ({
          modifier_id: item.modifier_id,
          product_name: item.product_name,
          modifier_label: item.modifier_label,
          unit_price: item.unit_price,
          quantity: item.quantity,
        })),
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      dispatch({ type: "CLEAR_CART" });
      toast.success("Order submitted!");
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
        {/* Store picker for admin */}
        {isAdmin && stores && (
          <Card>
            <CardContent className="p-4">
              <label className="text-sm font-medium mb-2 block">
                Store
              </label>
              <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a store" />
                </SelectTrigger>
                <SelectContent>
                  {stores.map((store) => (
                    <SelectItem key={store.id} value={store.id}>
                      {store.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Review Your Order</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border divide-y">
              {cartItems.map((item) => (
                <div
                  key={item.modifier_id}
                  className="px-4 py-3 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{item.product_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatPrice(item.unit_price)} · {item.modifier_label}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 shrink-0 text-destructive hover:text-destructive"
                      onClick={() =>
                        dispatch({
                          type: "REMOVE_ITEM",
                          payload: { modifier_id: item.modifier_id },
                        })
                      }
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-8"
                        onClick={() =>
                          dispatch({
                            type: "UPDATE_QUANTITY",
                            payload: {
                              modifier_id: item.modifier_id,
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
                                modifier_id: item.modifier_id,
                                quantity: Math.max(1, val),
                              },
                            });
                          }
                        }}
                        className="w-14 text-center h-8 px-1 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-8"
                        onClick={() =>
                          dispatch({
                            type: "UPDATE_QUANTITY",
                            payload: {
                              modifier_id: item.modifier_id,
                              quantity: item.quantity + 1,
                            },
                          })
                        }
                      >
                        <Plus className="size-3" />
                      </Button>
                    </div>
                    <span className="text-sm font-semibold">
                      {formatPrice(item.unit_price * item.quantity)}
                    </span>
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
        <div className="fixed bottom-0 inset-x-0 md:left-60 z-20 border-t bg-background/95 backdrop-blur p-4">
          <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
            <Button variant="outline" onClick={() => setPhase("browse")}>
              Edit Order
            </Button>
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">
                {itemCount} {itemCount === 1 ? "item" : "items"} ·{" "}
                {formatPrice(cartTotal)}
              </span>
              <Button
                onClick={handleSubmit}
                disabled={isPending || cartItems.length === 0 || (isAdmin && !selectedStoreId)}
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

      {/* Category sections — one row per modifier */}
      {categoriesWithProducts.map((cat) => (
        <section key={cat.id} id={`order-cat-${cat.id}`} className="scroll-mt-16">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{cat.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border divide-y">
                {(productsByCategory.get(cat.id) ?? []).flatMap((product) =>
                  product.modifiers.map((modifier) => {
                    const inCart = cart.items.get(modifier.id);
                    return (
                      <div
                        key={modifier.id}
                        className="flex items-center gap-3 px-4 py-3"
                      >
                        {product.image_url ? (
                          <button
                            type="button"
                            onClick={() => setLightbox({ url: product.image_url!, name: product.name })}
                            className="shrink-0"
                          >
                            <Image
                              src={product.image_url}
                              alt={product.name}
                              width={48}
                              height={48}
                              className="size-12 rounded-md object-cover"
                            />
                          </button>
                        ) : (
                          <div className="flex size-12 shrink-0 items-center justify-center rounded-md bg-muted">
                            <Package className="size-5 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium">{product.name}</span>
                          <p className="text-xs text-muted-foreground">
                            {formatPrice(modifier.price)} · {modifier.label}
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
                                      modifier_id: modifier.id,
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
                                      modifier_id: modifier.id,
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
                              onClick={() => handleAddModifier(product, modifier)}
                              className="min-w-[44px]"
                            >
                              Add
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </section>
      ))}

      {/* Sticky order bar */}
      <div className="fixed bottom-0 inset-x-0 md:left-60 z-20 border-t bg-background/95 backdrop-blur p-4">
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

      {/* Image lightbox */}
      <Dialog open={!!lightbox} onOpenChange={() => setLightbox(null)}>
        <DialogContent className="max-w-md p-2 sm:p-4">
          <DialogTitle className="sr-only">{lightbox?.name}</DialogTitle>
          {lightbox && (
            <Image
              src={lightbox.url}
              alt={lightbox.name}
              width={400}
              height={400}
              className="w-full h-auto rounded-md object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

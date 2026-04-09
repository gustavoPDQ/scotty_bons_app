"use client";

import { useMemo, useReducer, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Minus, Package, Plus, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatPrice } from "@/lib/utils";
import type { CategoryRow, ProductRow, ProductModifierRow } from "@/lib/types";
import { editOrderItems } from "@/app/(dashboard)/orders/[order-id]/actions";

type CartItem = {
  modifier_id: string;
  product_id: string;
  product_name: string;
  modifier_label: string;
  unit_price: number;
  quantity: number;
};

type CartState = { items: Map<string, CartItem> }; // keyed by modifier_id

type CartAction =
  | { type: "ADD_ITEM"; payload: CartItem }
  | { type: "REMOVE_ITEM"; payload: { modifier_id: string } }
  | { type: "UPDATE_QUANTITY"; payload: { modifier_id: string; quantity: number } };

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
    default:
      return state;
  }
}

interface EditOrderCartProps {
  orderId: string;
  categories: CategoryRow[];
  products: ProductRow[];
  currentItems: { product_id: string; product_name: string; modifier: string; unit_price: number; quantity: number }[];
}

export function EditOrderCart({ orderId, categories, products, currentItems }: EditOrderCartProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Build a lookup: product_id + modifier label → modifier_id
  const modifierLookup = useMemo(() => {
    const map = new Map<string, ProductModifierRow>();
    for (const product of products) {
      for (const mod of product.modifiers) {
        map.set(`${product.id}|${mod.label}`, mod);
      }
    }
    return map;
  }, [products]);

  const initialItems = useMemo(() => {
    const map = new Map<string, CartItem>();
    for (const item of currentItems) {
      // Try to match to a current modifier
      const mod = modifierLookup.get(`${item.product_id}|${item.modifier}`);
      const key = mod?.id ?? `legacy-${item.product_id}-${item.modifier}`;
      map.set(key, {
        modifier_id: key,
        product_id: item.product_id,
        product_name: item.product_name,
        modifier_label: item.modifier,
        unit_price: mod?.price ?? item.unit_price,
        quantity: item.quantity,
      });
    }
    return map;
  }, [currentItems, modifierLookup]);

  const [cart, dispatch] = useReducer(cartReducer, { items: initialItems });
  const [searchQuery, setSearchQuery] = useState("");

  // Filter products by search query
  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return products;
    const q = searchQuery.toLowerCase();
    return products.filter((p) => p.name.toLowerCase().includes(q));
  }, [products, searchQuery]);

  const productsByCategory = useMemo(() => {
    const map = new Map<string, ProductRow[]>();
    for (const product of filteredProducts) {
      const existing = map.get(product.category_id) ?? [];
      existing.push(product);
      map.set(product.category_id, existing);
    }
    return map;
  }, [filteredProducts]);

  const categoriesWithProducts = useMemo(
    () => categories.filter((cat) => (productsByCategory.get(cat.id)?.length ?? 0) > 0),
    [categories, productsByCategory]
  );

  const cartItems = useMemo(() => Array.from(cart.items.values()), [cart.items]);
  const cartTotal = cartItems.reduce(
    (sum, item) => sum + item.unit_price * item.quantity,
    0
  );

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

  const handleSave = () => {
    startTransition(async () => {
      const items = cartItems.map((item) => ({
        modifier_id: item.modifier_id,
        quantity: item.quantity,
      }));

      const result = await editOrderItems(orderId, items);
      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Order updated.");
      router.push(`/orders/${orderId}`);
    });
  };

  return (
    <div className="space-y-4 pb-24">
      {/* Current items */}
      <Card>
        <CardHeader>
          <CardTitle>Order Items</CardTitle>
        </CardHeader>
        <CardContent>
          {cartItems.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No items. Add products from the catalog below.
            </p>
          ) : (
            <div className="rounded-md border divide-y">
              {cartItems.map((item) => (
                <div
                  key={item.modifier_id}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.product_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatPrice(item.unit_price)} · {item.modifier_label}
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
                            payload: { modifier_id: item.modifier_id, quantity: item.quantity - 1 },
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
                              payload: { modifier_id: item.modifier_id, quantity: Math.max(1, val) },
                            });
                          }
                        }}
                        className="w-16 text-center h-8 px-1 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-8"
                        onClick={() =>
                          dispatch({
                            type: "UPDATE_QUANTITY",
                            payload: { modifier_id: item.modifier_id, quantity: item.quantity + 1 },
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
                        dispatch({ type: "REMOVE_ITEM", payload: { modifier_id: item.modifier_id } })
                      }
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
              <div className="flex justify-between items-center px-4 py-3 bg-muted/50">
                <span className="font-semibold">Total</span>
                <span className="font-semibold">{formatPrice(cartTotal)}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

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

      {/* Product catalog — one row per modifier */}
      {categoriesWithProducts.map((cat) => (
        <Card key={cat.id}>
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
                      <Package className="size-4 text-muted-foreground shrink-0" />
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
                                  payload: { modifier_id: modifier.id, quantity: inCart.quantity - 1 },
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
                                  payload: { modifier_id: modifier.id, quantity: inCart.quantity + 1 },
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
      ))}

      {/* Sticky action bar */}
      <div className="fixed bottom-0 inset-x-0 md:left-60 z-20 border-t bg-background/95 backdrop-blur p-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <Button variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              {cartItems.length} {cartItems.length === 1 ? "item" : "items"} ·{" "}
              {formatPrice(cartTotal)}
            </span>
            <Button
              onClick={handleSave}
              disabled={isPending || cartItems.length === 0}
            >
              {isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

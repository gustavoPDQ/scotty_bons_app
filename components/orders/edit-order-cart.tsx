"use client";

import { useMemo, useReducer, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Minus, Package, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatPrice } from "@/lib/utils";
import type { CategoryRow, ProductRow } from "@/lib/types";
import { editOrderItems } from "@/app/(dashboard)/orders/[order-id]/actions";

type CartItem = {
  product_id: string;
  product_name: string;
  modifier: string;
  unit_price: number;
  quantity: number;
};

type CartState = { items: Map<string, CartItem> };

type CartAction =
  | { type: "ADD_ITEM"; payload: CartItem }
  | { type: "REMOVE_ITEM"; payload: { product_id: string } }
  | { type: "UPDATE_QUANTITY"; payload: { product_id: string; quantity: number } };

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

  const initialItems = useMemo(() => {
    const map = new Map<string, CartItem>();
    for (const item of currentItems) {
      map.set(item.product_id, item);
    }
    return map;
  }, [currentItems]);

  const [cart, dispatch] = useReducer(cartReducer, { items: initialItems });

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

  const cartItems = useMemo(() => Array.from(cart.items.values()), [cart.items]);
  const cartTotal = cartItems.reduce(
    (sum, item) => sum + item.unit_price * item.quantity,
    0
  );

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

  const handleSave = () => {
    startTransition(async () => {
      const items = cartItems.map((item) => ({
        product_id: item.product_id,
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
                            payload: { product_id: item.product_id, quantity: item.quantity - 1 },
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
                              payload: { product_id: item.product_id, quantity: Math.max(1, val) },
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
                            payload: { product_id: item.product_id, quantity: item.quantity + 1 },
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
                        dispatch({ type: "REMOVE_ITEM", payload: { product_id: item.product_id } })
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

      {/* Product catalog */}
      {categoriesWithProducts.map((cat) => (
        <Card key={cat.id}>
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
                        {formatPrice(product.price)} &middot; {product.modifier}
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
                                payload: { product_id: product.id, quantity: inCart.quantity - 1 },
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
                                payload: { product_id: product.id, quantity: inCart.quantity + 1 },
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
      ))}

      {/* Sticky action bar */}
      <div className="fixed bottom-0 left-0 right-0 z-20 border-t bg-background/95 backdrop-blur p-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <Button variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              {cartItems.length} {cartItems.length === 1 ? "item" : "items"} &middot;{" "}
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

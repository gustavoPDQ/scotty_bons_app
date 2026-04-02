import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NewOrderCart } from "@/components/orders/new-order-cart";
import type { CategoryRow, ProductRow, ProductModifierRow } from "@/lib/types";

export default async function NewOrderPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, store_id")
    .eq("user_id", user.id)
    .single();

  if (!profile) redirect("/orders");

  const isAdmin = profile.role === "admin";
  const isStore = profile.role === "store" && !!profile.store_id;

  // Only store users and admins can create orders
  if (!isAdmin && !isStore) {
    redirect("/orders");
  }

  // Fetch categories, products, and stores (for admin) in parallel
  const [categoriesResult, productsResult, storesResult] = await Promise.all([
    supabase
      .from("product_categories")
      .select("id, name, sort_order")
      .order("sort_order"),
    supabase
      .from("products")
      .select("id, name, category_id, image_url, sort_order, product_modifiers(id, label, price, sort_order)")
      .eq("active", true)
      .order("sort_order"),
    isAdmin
      ? supabase.from("stores").select("id, name").order("name")
      : Promise.resolve({ data: null }),
  ]);

  const categories: CategoryRow[] = (categoriesResult.data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    product_count: 0,
    sort_order: c.sort_order,
  }));

  const products: ProductRow[] = (productsResult.data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    category_id: p.category_id,
    image_url: p.image_url,
    sort_order: p.sort_order,
    modifiers: ((p.product_modifiers ?? []) as ProductModifierRow[])
      .map((m) => ({
        id: m.id,
        product_id: p.id,
        label: m.label,
        price: Number(m.price),
        sort_order: m.sort_order,
      }))
      .sort((a, b) => a.sort_order - b.sort_order),
  }));

  const stores = isAdmin
    ? (storesResult.data ?? []).map((s: { id: string; name: string }) => ({
        id: s.id,
        name: s.name,
      }))
    : undefined;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          Orders &gt; New Order
        </p>
        <h1 className="text-2xl font-bold">New Order</h1>
      </div>
      <NewOrderCart
        categories={categories}
        products={products}
        storeId={isStore ? profile.store_id! : undefined}
        stores={stores}
      />
    </div>
  );
}

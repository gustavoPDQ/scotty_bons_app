import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NewOrderCart } from "@/components/orders/new-order-cart";
import type { CategoryRow, ProductRow } from "@/lib/types";

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

  // Only store users can create orders
  if (profile?.role !== "store" || !profile.store_id) {
    redirect("/orders");
  }

  // Fetch categories and products (RLS allows store users to SELECT both)
  const [categoriesResult, productsResult] = await Promise.all([
    supabase
      .from("product_categories")
      .select("id, name")
      .order("name"),
    supabase
      .from("products")
      .select("id, name, price, unit_of_measure, category_id, image_url")
      .order("name"),
  ]);

  const categories: CategoryRow[] = (categoriesResult.data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    product_count: 0,
  }));

  const products: ProductRow[] = (productsResult.data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    price: Number(p.price),
    unit_of_measure: p.unit_of_measure,
    category_id: p.category_id,
    image_url: p.image_url,
  }));

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          Orders &gt; New Order
        </p>
        <h1 className="text-2xl font-bold">New Order</h1>
      </div>
      <NewOrderCart
        categories={categories}
        products={products}
        storeId={profile.store_id}
      />
    </div>
  );
}

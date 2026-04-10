import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getUser, getProfile } from "@/lib/supabase/auth-cache";
import { EditOrderCart } from "@/components/orders/edit-order-cart";
import type { CategoryRow, ProductRow, ProductModifierRow, ProductImageRow, OrderStatus } from "@/lib/types";

export default async function EditOrderPage({
  params,
}: {
  params: Promise<{ "order-id": string }>;
}) {
  const { "order-id": orderId } = await params;

  const user = await getUser();
  if (!user) redirect("/login");

  const profile = await getProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();

  // Fetch order
  const { data: order } = await supabase
    .from("orders")
    .select("id, order_number, status, store_id")
    .eq("id", orderId)
    .single();

  if (!order) redirect("/orders");

  const status = order.status as OrderStatus;
  const role = profile.role;

  // Permission check
  const canEdit =
    (["admin", "commissary"].includes(role) && status !== "fulfilled") ||
    (role === "store" && status === "submitted");

  if (!canEdit) redirect(`/orders/${orderId}`);

  // Fetch current order items
  const { data: items } = await supabase
    .from("order_items")
    .select("product_id, product_name, modifier, unit_price, quantity")
    .eq("order_id", orderId);

  const currentItems = (items ?? []).map((i) => ({
    product_id: i.product_id,
    product_name: i.product_name,
    modifier: i.modifier,
    unit_price: Number(i.unit_price),
    quantity: i.quantity,
  }));

  // Fetch categories and products
  const [categoriesResult, productsResult] = await Promise.all([
    supabase
      .from("product_categories")
      .select("id, name, sort_order")
      .order("sort_order"),
    supabase
      .from("products")
      .select("id, name, category_id, sort_order, in_stock, product_modifiers(id, label, price, sort_order), product_images(id, url, sort_order)")
      .eq("active", true)
      .order("sort_order"),
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
    images: ((p.product_images ?? []) as ProductImageRow[])
      .sort((a, b) => a.sort_order - b.sort_order),
    sort_order: p.sort_order,
    in_stock: p.in_stock ?? true,
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

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <nav
        aria-label="Breadcrumb"
        className="text-sm flex items-center gap-1.5"
      >
        <Link
          href={`/orders/${orderId}`}
          className="text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
        >
          <ArrowLeft className="size-3.5" />
          {order.order_number}
        </Link>
        <span className="text-muted-foreground">/</span>
        <span className="font-medium">Edit</span>
      </nav>

      <h1 className="text-2xl font-bold">Edit Order</h1>

      <EditOrderCart
        orderId={orderId}
        categories={categories}
        products={products}
        currentItems={currentItems}
      />
    </div>
  );
}

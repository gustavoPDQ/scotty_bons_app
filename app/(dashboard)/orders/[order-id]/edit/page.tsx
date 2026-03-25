import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { EditOrderCart } from "@/components/orders/edit-order-cart";
import type { CategoryRow, ProductRow, OrderStatus } from "@/lib/types";

export default async function EditOrderPage({
  params,
}: {
  params: Promise<{ "order-id": string }>;
}) {
  const { "order-id": orderId } = await params;
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

  if (!profile) redirect("/login");

  // Fetch order
  const { data: order } = await supabase
    .from("orders")
    .select("id, status, store_id")
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
      .select("id, name")
      .order("name"),
    supabase
      .from("products")
      .select("id, name, price, modifier, category_id, image_url")
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
    modifier: p.modifier,
    category_id: p.category_id,
    image_url: p.image_url,
  }));

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <nav
        aria-label="Breadcrumb"
        className="text-sm flex items-center gap-1.5"
      >
        <Link
          href={`/orders/${orderId}`}
          className="text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
        >
          <ArrowLeft className="size-3.5" />
          Order #{orderId.slice(0, 8)}
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

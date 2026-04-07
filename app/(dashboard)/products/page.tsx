import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUser, getProfile } from "@/lib/supabase/auth-cache";
import { createPageTimer } from "@/lib/perf";
import { CatalogAdmin } from "@/components/products/catalog-admin";
import { CatalogBrowser } from "@/components/products/catalog-browser";
import type { CategoryRow, ProductRow, ProductModifierRow } from "@/lib/types";

export default async function ProductsPage() {
  const timer = createPageTimer("Products");

  const user = await timer.time("auth.getUser(cached)", () => getUser());
  if (!user) redirect("/login");

  const profile = await timer.time("profiles.select(cached)", () => getProfile());
  if (profile?.role === "commissary") redirect("/orders");

  const isAdmin = profile?.role === "admin";
  const supabase = await createClient();

  const [categoriesRes, productsRes] = await timer.time("parallel-queries", () =>
    Promise.all([
      supabase
        .from("product_categories")
        .select("id, name, sort_order")
        .order("sort_order"),
      supabase
        .from("products")
        .select("id, name, category_id, image_url, sort_order, product_modifiers(id, label, price, sort_order)")
        .eq("active", true)
        .order("sort_order"),
    ])
  );

  timer.summary();

  const { data: categoriesRaw, error: categoriesError } = categoriesRes;
  const { data: productsRaw, error: productsError } = productsRes;

  const queryError = categoriesError || productsError;

  const products: ProductRow[] = (productsRaw ?? []).map((p) => ({
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

  // Compute product counts per category
  const countMap = new Map<string, number>();
  for (const p of products) {
    countMap.set(p.category_id, (countMap.get(p.category_id) ?? 0) + 1);
  }

  const categories: CategoryRow[] = (categoriesRaw ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    product_count: countMap.get(c.id) ?? 0,
    sort_order: c.sort_order,
  }));

  // Enrich products with category names
  const categoryNameMap = new Map<string, string>();
  for (const c of categories) {
    categoryNameMap.set(c.id, c.name);
  }
  const productsWithCategory: ProductRow[] = products.map((p) => ({
    ...p,
    category_name: categoryNameMap.get(p.category_id) ?? "Unknown",
  }));

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <h1 className="text-xl font-bold">Products</h1>
      {queryError && (
        <div className="rounded-md border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
          Failed to load some data. Please refresh the page.
        </div>
      )}
      {isAdmin ? (
        <CatalogAdmin
          products={productsWithCategory}
          categories={categories}
        />
      ) : (
        <CatalogBrowser
          categories={categories}
          products={productsWithCategory}
        />
      )}
    </div>
  );
}

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CategoriesClient } from "@/components/products/categories-client";
import { ProductsClient } from "@/components/products/products-client";
import { CatalogBrowser } from "@/components/products/catalog-browser";
import type { CategoryRow, ProductRow } from "@/lib/types";

export default async function ProductsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (profile?.role === "factory") redirect("/orders");

  const isAdmin = profile?.role === "admin";

  const { data: categoriesRaw, error: categoriesError } = await supabase
    .from("product_categories")
    .select("id, name")
    .order("name");

  const { data: productsRaw, error: productsError } = await supabase
    .from("products")
    .select("id, name, price, unit_of_measure, category_id, image_url")
    .order("name");

  const queryError = categoriesError || productsError;

  const products: ProductRow[] = (productsRaw ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    price: Number(p.price),
    unit_of_measure: p.unit_of_measure,
    category_id: p.category_id,
    image_url: p.image_url,
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
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Products</h1>
      {queryError && (
        <div className="rounded-md border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
          Failed to load some data. Please refresh the page.
        </div>
      )}
      {isAdmin ? (
        <>
          <CategoriesClient categories={categories} isAdmin={isAdmin} />
          <ProductsClient
            products={productsWithCategory}
            categories={categories}
            isAdmin={isAdmin}
          />
        </>
      ) : (
        <CatalogBrowser
          categories={categories}
          products={productsWithCategory}
        />
      )}
    </div>
  );
}

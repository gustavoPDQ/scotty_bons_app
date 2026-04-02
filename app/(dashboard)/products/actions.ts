"use server";

import { createClient } from "@/lib/supabase/server";
import type { ActionResult, CategoryRow, ProductRow } from "@/lib/types";
import { z } from "zod";
import {
  createCategorySchema,
  updateCategorySchema,
  createProductSchema,
  updateProductSchema,
  type CreateCategoryValues,
  type UpdateCategoryValues,
  type CreateProductValues,
  type UpdateProductValues,
} from "@/lib/validations/products";

/** Verifies the current session belongs to an admin. Returns the supabase client or null. */
async function verifyAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  return profile?.role === "admin" ? supabase : null;
}

const idSchema = z.string().uuid("Invalid ID.");

export async function createCategory(
  values: CreateCategoryValues
): Promise<ActionResult<CategoryRow | null>> {
  const parsed = createCategorySchema.safeParse(values);
  if (!parsed.success) {
    return { data: null, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await verifyAdmin();
  if (!supabase) return { data: null, error: "Unauthorized." };

  // Assign sort_order to end of list
  const { data: maxRow } = await supabase
    .from("product_categories")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .single();
  const nextSortOrder = (maxRow?.sort_order ?? -1) + 1;

  const { data, error } = await supabase
    .from("product_categories")
    .insert({ name: parsed.data.name, sort_order: nextSortOrder })
    .select("id, name, sort_order")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { data: null, error: "A category with this name already exists." };
    }
    return { data: null, error: "Failed to create category. Please try again." };
  }

  return { data: { ...(data as { id: string; name: string; sort_order: number }), product_count: 0 }, error: null };
}

export async function updateCategory(
  categoryId: string,
  values: UpdateCategoryValues
): Promise<ActionResult<null>> {
  const idParsed = idSchema.safeParse(categoryId);
  if (!idParsed.success) return { data: null, error: "Invalid category ID." };

  const parsed = updateCategorySchema.safeParse(values);
  if (!parsed.success) {
    return { data: null, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await verifyAdmin();
  if (!supabase) return { data: null, error: "Unauthorized." };

  const { error } = await supabase
    .from("product_categories")
    .update({ name: parsed.data.name })
    .eq("id", categoryId)
    .select("id")
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return { data: null, error: "Category not found." };
    }
    if (error.code === "23505") {
      return { data: null, error: "A category with this name already exists." };
    }
    return { data: null, error: "Failed to update category. Please try again." };
  }

  return { data: null, error: null };
}

export async function deleteCategory(
  categoryId: string
): Promise<ActionResult<null>> {
  const idParsed = idSchema.safeParse(categoryId);
  if (!idParsed.success) return { data: null, error: "Invalid category ID." };

  const supabase = await verifyAdmin();
  if (!supabase) return { data: null, error: "Unauthorized." };

  // Check if any active products are assigned to this category
  const { count, error: countError } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("category_id", categoryId)
    .eq("active", true);

  if (countError) {
    // 42P01 = undefined_table — products table doesn't exist yet, safe to proceed
    if (countError.code !== "42P01") {
      return { data: null, error: "Failed to check category products. Please try again." };
    }
  } else if (count !== null && count > 0) {
    return {
      data: null,
      error: "This category has active products. Remove the products before deleting.",
    };
  }

  const { error } = await supabase
    .from("product_categories")
    .delete()
    .eq("id", categoryId);

  if (error) {
    if (error.code === "23503") {
      return { data: null, error: "This category still has deleted products linked to past orders. It cannot be removed." };
    }
    return { data: null, error: "Failed to delete category. Please try again." };
  }
  return { data: null, error: null };
}

export async function createProduct(
  values: CreateProductValues
): Promise<ActionResult<{ id: string } | null>> {
  const parsed = createProductSchema.safeParse(values);
  if (!parsed.success) {
    return { data: null, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await verifyAdmin();
  if (!supabase) return { data: null, error: "Unauthorized." };

  // Assign sort_order to end of category
  const { data: maxProd } = await supabase
    .from("products")
    .select("sort_order")
    .eq("category_id", parsed.data.category_id)
    .eq("active", true)
    .order("sort_order", { ascending: false })
    .limit(1)
    .single();
  const nextProductSort = (maxProd?.sort_order ?? -1) + 1;

  // Insert product
  const { data, error } = await supabase
    .from("products")
    .insert({
      name: parsed.data.name,
      category_id: parsed.data.category_id,
      sort_order: nextProductSort,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23503") {
      return { data: null, error: "Invalid category. Please select a valid category." };
    }
    return { data: null, error: "Failed to create product. Please try again." };
  }

  // Insert modifiers
  const modifierRows = parsed.data.modifiers.map((m, i) => ({
    product_id: data.id,
    label: m.label,
    price: m.price,
    sort_order: m.sort_order ?? i,
  }));

  const { error: modError } = await supabase
    .from("product_modifiers")
    .insert(modifierRows);

  if (modError) {
    // Rollback: delete the product
    await supabase.from("products").delete().eq("id", data.id);
    if (modError.code === "23505") {
      return { data: null, error: "Duplicate modifier labels. Each modifier must have a unique label." };
    }
    return { data: null, error: "Failed to create modifiers. Please try again." };
  }

  return { data: { id: data.id }, error: null };
}

export async function updateProduct(
  productId: string,
  values: UpdateProductValues
): Promise<ActionResult<null>> {
  const idParsed = idSchema.safeParse(productId);
  if (!idParsed.success) return { data: null, error: "Invalid product ID." };

  const parsed = updateProductSchema.safeParse(values);
  if (!parsed.success) {
    return { data: null, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await verifyAdmin();
  if (!supabase) return { data: null, error: "Unauthorized." };

  // Update product name/category
  const { error } = await supabase
    .from("products")
    .update({
      name: parsed.data.name,
      category_id: parsed.data.category_id,
    })
    .eq("id", productId)
    .select("id")
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return { data: null, error: "Product not found." };
    }
    if (error.code === "23503") {
      return { data: null, error: "Invalid category. Please select a valid category." };
    }
    return { data: null, error: "Failed to update product. Please try again." };
  }

  // Sync modifiers: delete all existing, re-insert
  await supabase
    .from("product_modifiers")
    .delete()
    .eq("product_id", productId);

  const modifierRows = parsed.data.modifiers.map((m, i) => ({
    product_id: productId,
    label: m.label,
    price: m.price,
    sort_order: m.sort_order ?? i,
  }));

  const { error: modError } = await supabase
    .from("product_modifiers")
    .insert(modifierRows);

  if (modError) {
    if (modError.code === "23505") {
      return { data: null, error: "Duplicate modifier labels. Each modifier must have a unique label." };
    }
    return { data: null, error: "Failed to update modifiers. Please try again." };
  }

  return { data: null, error: null };
}

export async function deleteProduct(
  productId: string
): Promise<ActionResult<null>> {
  const idParsed = idSchema.safeParse(productId);
  if (!idParsed.success) return { data: null, error: "Invalid product ID." };

  const supabase = await verifyAdmin();
  if (!supabase) return { data: null, error: "Unauthorized." };

  const { error } = await supabase
    .from("products")
    .update({ active: false })
    .eq("id", productId)
    .eq("active", true)
    .select("id")
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return { data: null, error: "Product not found." };
    }
    return { data: null, error: "Failed to delete product. Please try again." };
  }
  return { data: null, error: null };
}

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGE_SIZE = 2 * 1024 * 1024; // 2 MB

export async function uploadProductImage(
  productId: string,
  formData: FormData
): Promise<ActionResult<string | null>> {
  const idParsed = idSchema.safeParse(productId);
  if (!idParsed.success) return { data: null, error: "Invalid product ID." };

  const supabase = await verifyAdmin();
  if (!supabase) return { data: null, error: "Unauthorized." };

  const file = formData.get("file") as File | null;
  if (!file) return { data: null, error: "No file provided." };

  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return { data: null, error: "Only JPEG, PNG, and WebP images are allowed." };
  }
  if (file.size > MAX_IMAGE_SIZE) {
    return { data: null, error: "Image must be smaller than 2 MB." };
  }

  const ext = file.name.split(".").pop() ?? "jpg";
  const filePath = `${productId}.${ext}`;

  // Upload (upsert to replace existing image)
  const { error: uploadError } = await supabase.storage
    .from("product-images")
    .upload(filePath, file, { upsert: true, contentType: file.type });

  if (uploadError) {
    return { data: null, error: "Failed to upload image. Please try again." };
  }

  // Get the public URL
  const { data: urlData } = supabase.storage
    .from("product-images")
    .getPublicUrl(filePath);

  const imageUrl = urlData.publicUrl;

  // Update the product record
  const { error: updateError } = await supabase
    .from("products")
    .update({ image_url: imageUrl })
    .eq("id", productId);

  if (updateError) {
    return { data: null, error: "Image uploaded but failed to save. Please try again." };
  }

  return { data: imageUrl, error: null };
}

export async function removeProductImage(
  productId: string
): Promise<ActionResult<null>> {
  const idParsed = idSchema.safeParse(productId);
  if (!idParsed.success) return { data: null, error: "Invalid product ID." };

  const supabase = await verifyAdmin();
  if (!supabase) return { data: null, error: "Unauthorized." };

  // Get current image_url to find the file path
  const { data: product } = await supabase
    .from("products")
    .select("image_url")
    .eq("id", productId)
    .single();

  if (product?.image_url) {
    const url = new URL(product.image_url);
    const pathParts = url.pathname.split("/product-images/");
    if (pathParts[1]) {
      await supabase.storage.from("product-images").remove([pathParts[1]]);
    }
  }

  const { error } = await supabase
    .from("products")
    .update({ image_url: null })
    .eq("id", productId);

  if (error) return { data: null, error: "Failed to remove image." };
  return { data: null, error: null };
}

// ── Reorder actions ────────────────────────────────────────────────────────

const reorderSchema = z.array(z.string().uuid()).min(1);

export async function reorderCategories(
  orderedIds: string[]
): Promise<ActionResult<null>> {
  const parsed = reorderSchema.safeParse(orderedIds);
  if (!parsed.success) return { data: null, error: "Invalid input." };

  const supabase = await verifyAdmin();
  if (!supabase) return { data: null, error: "Unauthorized." };

  const updates = parsed.data.map((id, index) =>
    supabase
      .from("product_categories")
      .update({ sort_order: index })
      .eq("id", id)
  );

  const results = await Promise.all(updates);
  const failed = results.find((r) => r.error);
  if (failed?.error) {
    return { data: null, error: "Failed to reorder categories. Please try again." };
  }

  return { data: null, error: null };
}

export async function reorderProducts(
  categoryId: string,
  orderedIds: string[]
): Promise<ActionResult<null>> {
  const idParsed = idSchema.safeParse(categoryId);
  if (!idParsed.success) return { data: null, error: "Invalid category ID." };

  const parsed = reorderSchema.safeParse(orderedIds);
  if (!parsed.success) return { data: null, error: "Invalid input." };

  const supabase = await verifyAdmin();
  if (!supabase) return { data: null, error: "Unauthorized." };

  const updates = parsed.data.map((id, index) =>
    supabase
      .from("products")
      .update({ sort_order: index })
      .eq("id", id)
      .eq("category_id", categoryId)
  );

  const results = await Promise.all(updates);
  const failed = results.find((r) => r.error);
  if (failed?.error) {
    return { data: null, error: "Failed to reorder products. Please try again." };
  }

  return { data: null, error: null };
}

import { z } from "zod";

export const createCategorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Category name must be at least 2 characters.")
    .max(100, "Category name must be at most 100 characters."),
});

export type CreateCategoryValues = z.infer<typeof createCategorySchema>;

export const updateCategorySchema = createCategorySchema;

export type UpdateCategoryValues = CreateCategoryValues;

export const createProductSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Product name must be at least 2 characters.")
    .max(200, "Product name must be at most 200 characters."),
  price: z
    .number({ error: "Price must be a number." })
    .positive("Price must be greater than zero.")
    .max(99999999.99, "Price must be at most 99,999,999.99."),
  unit_of_measure: z
    .string()
    .trim()
    .min(1, "Unit of measure is required.")
    .max(50, "Unit of measure must be at most 50 characters."),
  category_id: z.string().uuid("Invalid category."),
});

export type CreateProductValues = z.infer<typeof createProductSchema>;

export const updateProductSchema = createProductSchema;

export type UpdateProductValues = CreateProductValues;

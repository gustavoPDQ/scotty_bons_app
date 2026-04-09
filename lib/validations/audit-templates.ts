import { z } from "zod";

const templateItemSchema = z.object({
  label: z
    .string()
    .trim()
    .min(1, "Item label is required.")
    .max(500, "Item label must be 500 characters or less."),
  description: z.string().trim().max(1000).optional(),
});

const templateCategorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Category name is required.")
    .max(100, "Category name must be 100 characters or less."),
  items: z
    .array(templateItemSchema)
    .min(1, "Each category must have at least one item."),
});

const ratingOptionSchema = z.object({
  key: z.string().trim().min(1).max(50),
  label: z.string().trim().min(1, "Label is required.").max(50),
  weight: z.number().min(0, "Weight must be >= 0.").max(1, "Weight must be <= 1."),
});

export const createTemplateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Template name is required.")
    .max(100, "Template name must be 100 characters or less."),
  description: z.string().trim().max(500).optional(),
  rating_options: z
    .array(ratingOptionSchema)
    .min(2, "At least 2 rating options are required.")
    .optional(),
  categories: z
    .array(templateCategorySchema)
    .min(1, "A template must have at least one category."),
});

export type CreateTemplateValues = z.infer<typeof createTemplateSchema>;
export type UpdateTemplateValues = CreateTemplateValues;

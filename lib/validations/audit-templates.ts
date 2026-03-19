import { z } from "zod";

const templateItemSchema = z.object({
  label: z
    .string()
    .trim()
    .min(1, "Item label is required.")
    .max(500, "Item label must be 500 characters or less."),
});

export const createTemplateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Template name is required.")
    .max(100, "Template name must be 100 characters or less."),
  description: z.string().trim().max(500).optional(),
  items: z
    .array(templateItemSchema)
    .min(1, "A template must have at least one checklist item."),
});

export type CreateTemplateValues = z.infer<typeof createTemplateSchema>;
export type UpdateTemplateValues = CreateTemplateValues;

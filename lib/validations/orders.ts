import { z } from "zod";

export const createOrderSchema = z.object({
  store_id: z.string().uuid("Invalid store."),
  items: z
    .array(
      z.object({
        product_id: z.string().uuid("Invalid product."),
        product_name: z.string().min(1, "Product name is required."),
        unit_of_measure: z.string().min(1, "Unit of measure is required."),
        unit_price: z.number().positive("Price must be greater than zero."),
        quantity: z.number().int().positive("Quantity must be at least 1."),
      })
    )
    .min(1, "At least one item is required."),
});

export type CreateOrderValues = z.infer<typeof createOrderSchema>;

import { z } from "zod";

export const createUserSchema = z
  .object({
    name: z.string().min(2, "Name must be at least 2 characters."),
    email: z.string().email("Please enter a valid email address."),
    role: z.enum(["admin", "factory", "store"]),
    store_id: z.string().uuid().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.role === "store" && !data.store_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Store is required for Store Users.",
        path: ["store_id"],
      });
    }
  });

export type CreateUserValues = z.infer<typeof createUserSchema>;

export const updateUserSchema = z
  .object({
    name: z.string().min(2, "Name must be at least 2 characters."),
    email: z.string().email("Please enter a valid email address."),
    role: z.enum(["admin", "factory", "store"]),
    store_id: z.string().uuid().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.role === "store" && !data.store_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Store is required for Store Users.",
        path: ["store_id"],
      });
    }
  });

export type UpdateUserValues = z.infer<typeof updateUserSchema>;

export const createStoreSchema = z.object({
  name: z.string().min(2, "Store name must be at least 2 characters."),
});

export type CreateStoreValues = z.infer<typeof createStoreSchema>;

export const updateStoreSchema = z.object({
  name: z.string().min(2, "Store name must be at least 2 characters."),
});

export type UpdateStoreValues = z.infer<typeof updateStoreSchema>;

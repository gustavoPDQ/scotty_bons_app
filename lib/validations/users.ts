import { z } from "zod";

export const createUserSchema = z
  .object({
    name: z.string().min(2, "Name must be at least 2 characters."),
    email: z.string().email("Please enter a valid email address."),
    password: z.string().min(6, "Password must be at least 6 characters.").optional().or(z.literal("")),
    role: z.enum(["admin", "commissary", "store"]),
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
    role: z.enum(["admin", "commissary", "store"]),
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
  business_name: z.string().max(200, "Business name is too long."),
  address: z.string().max(500, "Address is too long."),
  postal_code: z.string().max(20, "Postal code is too long."),
  phone: z.string().max(50, "Phone number is too long."),
});

export type CreateStoreValues = z.infer<typeof createStoreSchema>;

export const updateStoreSchema = z.object({
  name: z.string().min(2, "Store name must be at least 2 characters."),
  business_name: z.string().max(200, "Business name is too long."),
  address: z.string().max(500, "Address is too long."),
  postal_code: z.string().max(20, "Postal code is too long."),
  phone: z.string().max(50, "Phone number is too long."),
});

export type UpdateStoreValues = z.infer<typeof updateStoreSchema>;

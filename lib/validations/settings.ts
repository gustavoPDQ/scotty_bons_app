import { z } from "zod";

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required."),
    newPassword: z.string().min(6, "Password must be at least 6 characters."),
    confirmPassword: z.string().min(1, "Please confirm your new password."),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    message: "New password must be different from your current password.",
    path: ["newPassword"],
  });

export type ChangePasswordValues = z.infer<typeof changePasswordSchema>;

export const changeEmailSchema = z.object({
  newEmail: z.string().email("Please enter a valid email address."),
});

export type ChangeEmailValues = z.infer<typeof changeEmailSchema>;

export const financialSettingsSchema = z.object({
  tax_rate: z
    .number({ error: "Tax rate must be a number." })
    .min(0, "Tax rate cannot be negative.")
    .max(100, "Tax rate cannot exceed 100%."),
  currency: z
    .string()
    .min(1, "Currency is required.")
    .max(10, "Currency code is too long."),
  payment_terms: z.string().max(500, "Payment terms is too long."),
  company_name: z.string().max(200, "Company name is too long."),
  company_address: z.string().max(500, "Address is too long."),
  company_phone: z.string().max(50, "Phone number is too long."),
  company_email: z
    .string()
    .max(200, "Email is too long.")
    .refine(
      (val) => val === "" || z.string().email().safeParse(val).success,
      "Please enter a valid email address.",
    ),
});

export type FinancialSettingsValues = z.infer<typeof financialSettingsSchema>;

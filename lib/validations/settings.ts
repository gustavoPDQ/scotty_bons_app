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

export const generalSettingsSchema = z.object({
  hst_rate: z
    .number({ error: "HST rate must be a number." })
    .min(0, "HST rate cannot be negative.")
    .max(100, "HST rate cannot exceed 100%."),
  ad_royalties_fee: z
    .number({ error: "Fee must be a number." })
    .min(0, "Fee cannot be negative."),
  commissary_name: z.string().max(200, "Business name is too long."),
  commissary_address: z.string().max(500, "Address is too long."),
  commissary_postal_code: z.string().max(20, "Postal code is too long."),
  commissary_phone: z.string().max(50, "Phone number is too long."),
});

export type GeneralSettingsValues = z.infer<typeof generalSettingsSchema>;

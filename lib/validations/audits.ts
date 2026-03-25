import { z } from "zod";

export const createAuditSchema = z.object({
  template_id: z.string().uuid("Invalid template ID."),
  store_id: z.string().uuid("Invalid store ID."),
});

export type CreateAuditValues = z.infer<typeof createAuditSchema>;

export const saveResponseSchema = z.object({
  audit_id: z.string().uuid("Invalid audit ID."),
  template_item_id: z.string().uuid("Invalid template item ID."),
  rating: z.enum(["poor", "satisfactory", "good"], {
    message: "Rating must be poor, satisfactory, or good.",
  }),
  notes: z.string().trim().max(1000).optional(),
});

export type SaveResponseValues = z.infer<typeof saveResponseSchema>;

export const completeAuditSchema = z.object({
  audit_id: z.string().uuid("Invalid audit ID."),
  notes: z.string().trim().max(2000).optional(),
});

export type CompleteAuditValues = z.infer<typeof completeAuditSchema>;

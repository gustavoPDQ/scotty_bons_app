import { z } from "zod";

export const createAuditSchema = z.object({
  template_id: z.string().uuid("Invalid template ID."),
  store_id: z.string().uuid("Invalid store ID."),
});

export type CreateAuditValues = z.infer<typeof createAuditSchema>;

export const saveResponseSchema = z.object({
  audit_id: z.string().uuid("Invalid audit ID."),
  template_item_id: z.string().uuid("Invalid template item ID."),
  rating: z.string().trim().min(1, "Rating is required.").max(50),
  notes: z.string().trim().max(1000).optional(),
});

export type SaveResponseValues = z.infer<typeof saveResponseSchema>;

export const completeAuditSchema = z.object({
  audit_id: z.string().uuid("Invalid audit ID."),
  notes: z.string().trim().max(2000).optional(),
});

export type CompleteAuditValues = z.infer<typeof completeAuditSchema>;

export const updateResponseSchema = z.object({
  response_id: z.string().uuid("Invalid response ID."),
  audit_id: z.string().uuid("Invalid audit ID."),
  rating: z.string().trim().min(1, "Rating is required.").max(50),
  notes: z.string().trim().max(1000).optional(),
});

export type UpdateResponseValues = z.infer<typeof updateResponseSchema>;

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult, AuditEvidenceRow } from "@/lib/types";
import { z } from "zod";

/** Verifies the current session belongs to an admin or commissary. Returns the supabase client or null. */
async function verifyAdminOrCommissary() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (profile?.role !== "admin" && profile?.role !== "commissary") return null;
  return supabase;
}

const idSchema = z.string().uuid("Invalid ID.");
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGE_SIZE = 2 * 1024 * 1024; // 2 MB
const MAX_EVIDENCE_PER_ITEM = 3;

export async function uploadAuditEvidence(
  auditResponseId: string,
  formData: FormData
): Promise<ActionResult<AuditEvidenceRow | null>> {
  const idParsed = idSchema.safeParse(auditResponseId);
  if (!idParsed.success) return { data: null, error: "Invalid response ID." };

  const supabase = await verifyAdminOrCommissary();
  if (!supabase) return { data: null, error: "Unauthorized." };

  const file = formData.get("file") as File | null;
  if (!file) return { data: null, error: "No file provided." };

  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return { data: null, error: "Only JPEG, PNG, and WebP images are allowed." };
  }
  if (file.size > MAX_IMAGE_SIZE) {
    return { data: null, error: "Image must be smaller than 2 MB." };
  }

  const caption = (formData.get("caption") as string)?.trim() || null;
  if (caption && caption.length > 200) {
    return { data: null, error: "Caption must be 200 characters or less." };
  }

  // Check max evidence per item
  const { count } = await supabase
    .from("audit_evidence")
    .select("id", { count: "exact", head: true })
    .eq("audit_response_id", auditResponseId);

  if (count !== null && count >= MAX_EVIDENCE_PER_ITEM) {
    return { data: null, error: `Maximum ${MAX_EVIDENCE_PER_ITEM} photos per item.` };
  }

  // Upload to storage — derive extension from validated MIME type, not user filename
  const MIME_TO_EXT: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };
  const ext = MIME_TO_EXT[file.type] ?? "jpg";
  const filePath = `${auditResponseId}/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("audit-evidence")
    .upload(filePath, file, { contentType: file.type });

  if (uploadError) {
    return { data: null, error: "Failed to upload image. Please try again." };
  }

  const { data: urlData } = supabase.storage
    .from("audit-evidence")
    .getPublicUrl(filePath);

  const imageUrl = urlData.publicUrl;

  // Insert evidence record
  const { data, error } = await supabase
    .from("audit_evidence")
    .insert({
      audit_response_id: auditResponseId,
      image_url: imageUrl,
      caption,
    })
    .select("id, audit_response_id, image_url, caption, created_at")
    .single();

  if (error) {
    // Clean up uploaded file
    await supabase.storage.from("audit-evidence").remove([filePath]);
    return { data: null, error: "Failed to save evidence. Please try again." };
  }

  revalidatePath("/audits");
  return { data: data as AuditEvidenceRow, error: null };
}

export async function removeAuditEvidence(
  evidenceId: string
): Promise<ActionResult<null>> {
  const idParsed = idSchema.safeParse(evidenceId);
  if (!idParsed.success) return { data: null, error: "Invalid evidence ID." };

  const supabase = await verifyAdminOrCommissary();
  if (!supabase) return { data: null, error: "Unauthorized." };

  // Fetch to get file path
  const { data: evidence } = await supabase
    .from("audit_evidence")
    .select("id, image_url")
    .eq("id", evidenceId)
    .single();

  if (!evidence) return { data: null, error: "Evidence not found." };

  // Delete from storage
  if (evidence.image_url) {
    const url = new URL(evidence.image_url);
    const pathParts = url.pathname.split("/audit-evidence/");
    if (pathParts[1]) {
      await supabase.storage.from("audit-evidence").remove([pathParts[1]]);
    }
  }

  // Delete DB record
  const { error } = await supabase
    .from("audit_evidence")
    .delete()
    .eq("id", evidenceId);

  if (error) return { data: null, error: "Failed to remove evidence." };
  revalidatePath("/audits");
  return { data: null, error: null };
}

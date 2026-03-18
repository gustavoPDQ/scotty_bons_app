# Story 6.3: Admin — Attach Photo Evidence to Audit Items

Status: ready-for-dev

## Story

As an Admin,
I want to attach photo evidence to individual audit checklist items,
so that I can document findings with visual proof during or after conducting an audit.

## Acceptance Criteria

1. **Given** an Admin is conducting or reviewing an audit,
   **When** they view a checklist item (audit response),
   **Then** an "Add Photo" button is visible for that item.

2. **Given** an Admin clicks "Add Photo" for a checklist item,
   **When** they select an image file,
   **Then** the file is validated (JPEG, PNG, or WebP; max 2 MB) and uploaded to Supabase Storage, with a loading indicator shown during upload.

3. **Given** a checklist item already has 3 photos attached,
   **When** the Admin views that item,
   **Then** the "Add Photo" button is hidden or disabled — max 3 photos per checklist item.

4. **Given** an Admin has uploaded a photo,
   **When** the upload completes,
   **Then** a thumbnail of the photo appears inline with the checklist item, and the image URL is persisted in the `audit_evidence` table.

5. **Given** an Admin views a checklist item with existing photos,
   **When** the page loads,
   **Then** photo thumbnails are displayed with optional captions below each.

6. **Given** an Admin clicks a photo thumbnail,
   **When** the lightbox/preview opens,
   **Then** the full-size image is displayed.

7. **Given** an Admin wants to add context to a photo,
   **When** they type a caption (optional, max 200 characters),
   **Then** the caption is saved alongside the photo in `audit_evidence`.

8. **Given** an Admin wants to remove a photo,
   **When** they click the remove/delete button on a photo thumbnail,
   **Then** a confirmation is shown; on confirm, the file is deleted from Storage, the `audit_evidence` row is removed, and the thumbnail disappears.

9. **Given** a Store user views audit results for their store (future story 6-4),
   **When** the audit has evidence photos,
   **Then** they can view the photos (SELECT access via RLS) but cannot upload or delete.

10. **Given** the upload fails (network error, storage error),
    **When** the error is returned,
    **Then** an error toast is displayed and no evidence row is created.

## Tasks / Subtasks

- [ ] Task 1 — DB migration: create `audit_evidence` table with RLS (AC: #4, #7, #9)
  - [ ] Create `supabase/migrations/YYYYMMDDHHMMSS_create_audit_evidence.sql`
  - [ ] Create `audit_evidence` table:
    ```sql
    CREATE TABLE audit_evidence (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      audit_response_id uuid NOT NULL REFERENCES audit_responses(id) ON DELETE CASCADE,
      image_url text NOT NULL,
      caption text CHECK (char_length(caption) <= 200),
      created_at timestamptz NOT NULL DEFAULT now()
    );
    ```
  - [ ] Add index: `CREATE INDEX idx_audit_evidence_response ON audit_evidence(audit_response_id);`
  - [ ] Enable RLS: `ALTER TABLE audit_evidence ENABLE ROW LEVEL SECURITY;`
  - [ ] RLS — admin SELECT: `CREATE POLICY "audit_evidence_select_admin" ON audit_evidence FOR SELECT USING (auth_role() = 'admin');`
  - [ ] RLS — admin INSERT: `CREATE POLICY "audit_evidence_insert_admin" ON audit_evidence FOR INSERT WITH CHECK (auth_role() = 'admin');`
  - [ ] RLS — admin DELETE: `CREATE POLICY "audit_evidence_delete_admin" ON audit_evidence FOR DELETE USING (auth_role() = 'admin');`
  - [ ] RLS — store SELECT (for 6-4): `CREATE POLICY "audit_evidence_select_store" ON audit_evidence FOR SELECT USING (auth_role() = 'store' AND audit_response_id IN (SELECT ar.id FROM audit_responses ar JOIN audits a ON ar.audit_id = a.id WHERE a.store_id = auth_store_id()));`

- [ ] Task 2 — Storage bucket: create `audit-evidence` bucket with policies (AC: #2, #8)
  - [ ] In the same migration (or a separate one), create the storage bucket:
    ```sql
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('audit-evidence', 'audit-evidence', true)
    ON CONFLICT (id) DO NOTHING;
    ```
  - [ ] Storage SELECT policy (authenticated): `CREATE POLICY "audit_evidence_storage_select" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'audit-evidence');`
  - [ ] Storage INSERT policy (admin only): `CREATE POLICY "audit_evidence_storage_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'audit-evidence' AND auth_role() = 'admin');`
  - [ ] Storage UPDATE policy (admin only): `CREATE POLICY "audit_evidence_storage_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'audit-evidence' AND auth_role() = 'admin');`
  - [ ] Storage DELETE policy (admin only): `CREATE POLICY "audit_evidence_storage_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'audit-evidence' AND auth_role() = 'admin');`

- [ ] Task 3 — Server Actions: `uploadAuditEvidence` and `removeAuditEvidence` (AC: #2, #3, #4, #7, #8, #10)
  - [ ] Create `app/(dashboard)/audits/[audit-id]/evidence-actions.ts` (or add to existing audit actions file)
  - [ ] `uploadAuditEvidence(auditResponseId: string, formData: FormData): Promise<ActionResult<{ id: string; image_url: string } | null>>`
    - Auth check → admin only
    - Extract file from FormData, validate type (JPEG/PNG/WebP) and size (max 2 MB)
    - Count existing evidence for this response — if >= 3, return error: "Maximum 3 photos per checklist item."
    - Generate file path: `${auditResponseId}/${crypto.randomUUID()}.${ext}`
    - Upload to `audit-evidence` bucket via `supabase.storage.from("audit-evidence").upload(...)`
    - Get public URL
    - Extract optional caption from FormData (`formData.get("caption")`)
    - Insert row into `audit_evidence` table: `{ audit_response_id, image_url, caption }`
    - Return `{ data: { id, image_url }, error: null }`
  - [ ] `removeAuditEvidence(evidenceId: string): Promise<ActionResult<null>>`
    - Auth check → admin only
    - Fetch the `audit_evidence` row to get `image_url`
    - Parse the storage path from the URL (split on `/audit-evidence/`)
    - Delete from storage: `supabase.storage.from("audit-evidence").remove([storagePath])`
    - Delete row: `supabase.from("audit_evidence").delete().eq("id", evidenceId)`
    - Return `{ data: null, error: null }`

- [ ] Task 4 — Client Component: `AuditEvidenceUploader` (AC: #1, #2, #3, #5, #6, #7, #8)
  - [ ] Create `components/audits/audit-evidence-uploader.tsx` with `"use client"` directive
  - [ ] Props: `auditResponseId: string`, `existingEvidence: AuditEvidenceRow[]`, `isAdmin: boolean`
  - [ ] Display existing photo thumbnails (small, e.g. 80x80) with captions below
  - [ ] Click thumbnail to open a lightbox/dialog showing the full-size image
  - [ ] "Add Photo" button: hidden if `!isAdmin` or if `existingEvidence.length >= 3`
  - [ ] File input (hidden, triggered by button): accept `image/jpeg,image/png,image/webp`
  - [ ] On file select: show loading spinner, call `uploadAuditEvidence` via FormData
  - [ ] On success: append new thumbnail to the list, toast success
  - [ ] On error: toast error
  - [ ] Remove button (X icon) on each thumbnail: only shown if `isAdmin`
  - [ ] On remove confirm: call `removeAuditEvidence`, remove thumbnail from list, toast success
  - [ ] Optional caption input: text field below file input, max 200 chars

- [ ] Task 5 — Integrate `AuditEvidenceUploader` into audit conduct/detail page (AC: #1, #5)
  - [ ] In the audit conduct or detail page, for each checklist item (audit response), render `<AuditEvidenceUploader>`
  - [ ] Query `audit_evidence` joined with `audit_responses` when loading audit detail
  - [ ] Pass evidence array per response to each uploader instance

- [ ] Task 6 — Types (AC: all)
  - [ ] Add `AuditEvidenceRow` type to `lib/types/index.ts`:
    ```typescript
    export type AuditEvidenceRow = {
      id: string;
      audit_response_id: string;
      image_url: string;
      caption: string | null;
      created_at: string;
    };
    ```

- [ ] Task 7 — Build and lint verification (AC: all)
  - [ ] Run `npm run build` — zero errors
  - [ ] Run `npm run lint` — zero warnings/errors
  - [ ] Verify TypeScript compilation passes

## Quick Reference — Existing Code to Reuse

```
Supabase server client:  import { createClient } from "@/lib/supabase/server"
Types:                   import type { ActionResult, AuditEvidenceRow } from "@/lib/types"
CN utility:              import { cn } from "@/lib/utils"
UI components:           Button, Dialog, DialogContent from @/components/ui/*
Toast:                   import { toast } from "sonner"
Icons:                   ImagePlus, X, Camera from lucide-react
revalidatePath:          import { revalidatePath } from "next/cache"
useRouter:               import { useRouter } from "next/navigation"
useTransition:           import { useTransition } from "react"
Upload pattern:          app/(dashboard)/products/actions.ts (uploadProductImage, removeProductImage)
Storage bucket pattern:  supabase/migrations/20260316180000_add_product_images.sql
verifyAdmin helper:      app/(dashboard)/products/actions.ts (verifyAdmin pattern)
```

## Dev Notes

### Migration — `audit_evidence` Table

Create the table and RLS in a single migration. Follow the established naming convention from prior migrations.

```sql
-- Migration: create_audit_evidence
-- Adds audit_evidence table for photo attachments on audit checklist items.
-- Depends on: audit_responses table (from story 6-2)

CREATE TABLE audit_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_response_id uuid NOT NULL REFERENCES audit_responses(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  caption text CHECK (char_length(caption) <= 200),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_evidence_response ON audit_evidence(audit_response_id);

ALTER TABLE audit_evidence ENABLE ROW LEVEL SECURITY;

-- Admin: full access
CREATE POLICY "audit_evidence_select_admin"
  ON audit_evidence FOR SELECT
  USING (auth_role() = 'admin');

CREATE POLICY "audit_evidence_insert_admin"
  ON audit_evidence FOR INSERT
  WITH CHECK (auth_role() = 'admin');

CREATE POLICY "audit_evidence_delete_admin"
  ON audit_evidence FOR DELETE
  USING (auth_role() = 'admin');

-- Store: read-only access for their own audits (enables story 6-4)
CREATE POLICY "audit_evidence_select_store"
  ON audit_evidence FOR SELECT
  USING (
    auth_role() = 'store'
    AND audit_response_id IN (
      SELECT ar.id FROM audit_responses ar
      JOIN audits a ON ar.audit_id = a.id
      WHERE a.store_id = auth_store_id()
    )
  );
```

### Storage Bucket Setup

Follow the exact pattern from `20260316180000_add_product_images.sql`:

```sql
-- Create storage bucket for audit evidence photos (public for serving)
INSERT INTO storage.buckets (id, name, public)
VALUES ('audit-evidence', 'audit-evidence', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: authenticated can read, only admins can write/delete
CREATE POLICY "audit_evidence_storage_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'audit-evidence');

CREATE POLICY "audit_evidence_storage_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'audit-evidence'
    AND auth_role() = 'admin'
  );

CREATE POLICY "audit_evidence_storage_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'audit-evidence'
    AND auth_role() = 'admin'
  );

CREATE POLICY "audit_evidence_storage_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'audit-evidence'
    AND auth_role() = 'admin'
  );
```

### Upload Pattern — Follow `uploadProductImage`

The upload Server Action follows the exact same pattern as `uploadProductImage` in `app/(dashboard)/products/actions.ts`:

```typescript
"use server";

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGE_SIZE = 2 * 1024 * 1024; // 2 MB
const MAX_PHOTOS_PER_ITEM = 3;

export async function uploadAuditEvidence(
  auditResponseId: string,
  formData: FormData
): Promise<ActionResult<{ id: string; image_url: string } | null>> {
  const supabase = await verifyAdmin();
  if (!supabase) return { data: null, error: "Unauthorized." };

  // Validate auditResponseId
  const idParsed = z.string().uuid().safeParse(auditResponseId);
  if (!idParsed.success) return { data: null, error: "Invalid response ID." };

  // Validate file
  const file = formData.get("file") as File | null;
  if (!file) return { data: null, error: "No file provided." };
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return { data: null, error: "Only JPEG, PNG, and WebP images are allowed." };
  }
  if (file.size > MAX_IMAGE_SIZE) {
    return { data: null, error: "Image must be smaller than 2 MB." };
  }

  // Enforce max 3 photos per checklist item
  const { count } = await supabase
    .from("audit_evidence")
    .select("id", { count: "exact", head: true })
    .eq("audit_response_id", auditResponseId);
  if (count !== null && count >= MAX_PHOTOS_PER_ITEM) {
    return { data: null, error: "Maximum 3 photos per checklist item." };
  }

  // Upload to storage
  const ext = file.name.split(".").pop() ?? "jpg";
  const filePath = `${auditResponseId}/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("audit-evidence")
    .upload(filePath, file, { contentType: file.type });
  if (uploadError) return { data: null, error: "Failed to upload image. Please try again." };

  // Get public URL
  const { data: urlData } = supabase.storage
    .from("audit-evidence")
    .getPublicUrl(filePath);

  // Optional caption
  const caption = (formData.get("caption") as string | null) || null;

  // Insert evidence row
  const { data, error } = await supabase
    .from("audit_evidence")
    .insert({
      audit_response_id: auditResponseId,
      image_url: urlData.publicUrl,
      caption,
    })
    .select("id, image_url")
    .single();

  if (error) return { data: null, error: "Failed to save evidence. Please try again." };

  return { data: data as { id: string; image_url: string }, error: null };
}
```

### Remove Pattern — Follow `removeProductImage`

```typescript
export async function removeAuditEvidence(
  evidenceId: string
): Promise<ActionResult<null>> {
  const supabase = await verifyAdmin();
  if (!supabase) return { data: null, error: "Unauthorized." };

  const idParsed = z.string().uuid().safeParse(evidenceId);
  if (!idParsed.success) return { data: null, error: "Invalid evidence ID." };

  // Get current image_url to find storage path
  const { data: evidence } = await supabase
    .from("audit_evidence")
    .select("image_url")
    .eq("id", evidenceId)
    .single();

  if (!evidence) return { data: null, error: "Evidence not found." };

  // Delete from storage
  const url = new URL(evidence.image_url);
  const pathParts = url.pathname.split("/audit-evidence/");
  if (pathParts[1]) {
    await supabase.storage.from("audit-evidence").remove([pathParts[1]]);
  }

  // Delete DB row
  const { error } = await supabase
    .from("audit_evidence")
    .delete()
    .eq("id", evidenceId);

  if (error) return { data: null, error: "Failed to remove evidence." };
  return { data: null, error: null };
}
```

### Component Guidance — `AuditEvidenceUploader`

The component manages its own optimistic state for thumbnails. Key implementation details:

- **Thumbnail grid:** Use a flex/grid layout with small thumbnails (80x80 or similar). Use `next/image` with `fill` and `object-cover` for consistent sizing.
- **File input:** Hidden `<input type="file" accept="image/jpeg,image/png,image/webp" />` triggered by the "Add Photo" button.
- **Upload flow:** On file select, wrap the call in `useTransition` for pending state. Build a `FormData` with the file and optional caption, then call `uploadAuditEvidence`.
- **Lightbox:** Use a `Dialog` from shadcn/ui. On thumbnail click, open the dialog with the full-size image.
- **Remove flow:** Show an X icon on hover over each thumbnail (admin only). On click, confirm via a small dialog or inline confirm, then call `removeAuditEvidence`.
- **Caption input:** Optional text input below the file picker. Cleared after successful upload.
- **Non-admin view:** When `isAdmin` is false, render thumbnails and captions only (no add/remove controls). This supports store user viewing in story 6-4.

```tsx
"use client";

export function AuditEvidenceUploader({
  auditResponseId,
  existingEvidence,
  isAdmin,
}: Props) {
  const [evidence, setEvidence] = useState(existingEvidence);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [caption, setCaption] = useState("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    if (caption.trim()) formData.append("caption", caption.trim());

    startTransition(async () => {
      const result = await uploadAuditEvidence(auditResponseId, formData);
      if (result.error) {
        toast.error(result.error);
      } else if (result.data) {
        setEvidence((prev) => [...prev, { ...result.data!, audit_response_id: auditResponseId, caption: caption.trim() || null, created_at: new Date().toISOString() }]);
        setCaption("");
        toast.success("Photo uploaded.");
      }
    });
    // Reset input so same file can be re-selected
    e.target.value = "";
  };

  // ... render thumbnails, add button, remove button, lightbox dialog
}
```

### File Path Convention for Storage

Use `{auditResponseId}/{randomUUID}.{ext}` to organize files by checklist item and avoid collisions. Unlike product images (which use upsert to a single file path), audit evidence supports multiple files per item, so each upload gets a unique UUID filename.

### Testing Requirements

- Run `npm run build` — zero errors
- Run `npm run lint` — zero warnings/errors
- Manual: Admin opens audit detail with checklist items — "Add Photo" button visible on each item
- Manual: Admin uploads a JPEG — thumbnail appears inline, evidence row created in DB
- Manual: Admin uploads a 3 MB file — error toast: "Image must be smaller than 2 MB."
- Manual: Admin uploads a .gif file — error toast: "Only JPEG, PNG, and WebP images are allowed."
- Manual: Admin uploads 3 photos to one item — "Add Photo" button disabled/hidden for that item
- Manual: Admin attempts 4th photo — error toast: "Maximum 3 photos per checklist item."
- Manual: Admin clicks thumbnail — lightbox opens with full-size image
- Manual: Admin adds caption "Damaged packaging" — caption saved and displayed under thumbnail
- Manual: Admin removes a photo — confirmation shown, photo deleted from Storage and DB, thumbnail removed
- Manual: Store user views audit detail (future 6-4 RLS test) — photos visible, no upload/remove controls
- Manual: Verify storage bucket `audit-evidence` contains uploaded files under correct paths
- Manual: Verify `audit_evidence` table rows match uploaded files

### Previous Story Intelligence (from Stories 2-2, 3-1 through 3-5)

1. **`date-fns` is NOT installed** — use `Intl.DateTimeFormat("en-CA", ...)` for all date formatting.
2. **Server Action: do NOT call `redirect()` inside** — return `ActionResult`, let the Client Component handle navigation/refresh.
3. **`ActionResult<T>` pattern** — return `{ data: T, error: null }` for success, `{ data: null, error: "message" }` for failure.
4. **RLS is the enforcement layer** — role check in the Server Action is defense-in-depth.
5. **UI Language is English** — all button labels, dialog text, toast messages in English.
6. **`useTransition` for pending state** — disable all interactive elements while `isPending === true`.
7. **`verifyAdmin()` helper** — reuse the same pattern from `app/(dashboard)/products/actions.ts`.
8. **Storage upload pattern** — follow `uploadProductImage` exactly: validate type/size, upload to bucket, get public URL, save URL to DB.

### Architecture Compliance

**D7 — Server Actions:** `uploadAuditEvidence` and `removeAuditEvidence` follow the established Server Action pattern: auth check -> role check -> validation -> DB/Storage mutation -> return `ActionResult`.

**D5 — RLS:** Access enforced at the RLS layer for both the `audit_evidence` table and `storage.objects`. No `service_role` key.

**D11 — Storage:** Public bucket for serving images. Admin-only write/delete policies on `storage.objects`.

**Anti-Patterns — NEVER DO:**
- Upload without server-side file validation — always validate type and size in the Server Action
- Use `service_role` key for storage operations — use the user's authenticated client
- Skip the max-3-per-item count check on the server — client-side hiding is not sufficient
- Store files with predictable/sequential names — use UUID to prevent enumeration
- Call `redirect()` inside the Server Action — return `ActionResult`, let the client handle UI updates
- Hard-code storage URLs — always use `getPublicUrl()` to construct URLs

### Library & Framework Requirements

**Already installed — no new packages needed:**

| Package | Purpose | Notes |
|---------|---------|-------|
| shadcn/ui `Dialog` | Lightbox for full-size image | Already available |
| shadcn/ui `Button` | Add Photo / Remove buttons | Already available |
| `sonner` | Toast notifications | Already installed |
| `lucide-react` | `ImagePlus`, `X`, `Camera` icons | Already installed |
| `next/image` | Thumbnail rendering | Built-in |
| `zod` | Input validation | Already installed |

**No new packages to install.**

### Recommended Commit Message

`feat: add photo evidence uploads for audit checklist items (story 6-3)`

### References

- [Source: Story 6-2] `audits` and `audit_responses` tables — prerequisite for this story
- [Source: products/actions.ts] `uploadProductImage` and `removeProductImage` — upload/remove pattern to follow exactly
- [Source: 20260316180000_add_product_images.sql] Storage bucket and policy pattern
- [Source: lib/types/index.ts] `ActionResult<T>` type definition
- [Source: memory/feedback_ui_language.md] UI must be in English

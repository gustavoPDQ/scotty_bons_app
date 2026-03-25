"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ActionResult, UserRow, StoreRow } from "@/lib/types";
import { z } from "zod";
import { createUserSchema, createStoreSchema, updateUserSchema, updateStoreSchema, type CreateUserValues, type CreateStoreValues, type UpdateUserValues, type UpdateStoreValues } from "@/lib/validations/users";

const userIdSchema = z.string().uuid("Invalid user ID.");

/** Verifies the current session belongs to an admin. Returns the user or null. */
async function verifyAdmin() {
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

  return profile?.role === "admin" ? user : null;
}

export async function createUser(
  values: CreateUserValues
): Promise<ActionResult<UserRow | null>> {
  // Server-side validation — Server Actions can be called directly, bypassing client Zod
  const parsed = createUserSchema.safeParse(values);
  if (!parsed.success) {
    return { data: null, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const safeValues = parsed.data;

  const caller = await verifyAdmin();
  if (!caller) return { data: null, error: "Unauthorized." };

  const adminClient = createAdminClient();

  // Create auth user — no password set; user must use Forgot Password to sign in
  const { data: authData, error: authError } =
    await adminClient.auth.admin.createUser({
      email: safeValues.email,
      email_confirm: true,
      user_metadata: { name: safeValues.name },
    });

  if (authError) {
    const msg = authError.message.toLowerCase().includes("already")
      ? "A user with this email already exists."
      : "Failed to create user. Please try again.";
    return { data: null, error: msg };
  }

  // The on_auth_user_created trigger auto-creates a profile with role='store' on insert.
  // Upsert with onConflict ensures we win regardless of trigger timing: if trigger ran
  // first, we override; if we run first, trigger's insert will conflict and be ignored.
  const { error: profileError } = await adminClient
    .from("profiles")
    .upsert(
      {
        user_id: authData.user.id,
        role: safeValues.role,
        store_id: safeValues.store_id ?? null,
      },
      { onConflict: "user_id" }
    );

  if (profileError) {
    // Rollback: remove the auth user we just created
    await adminClient.auth.admin.deleteUser(authData.user.id);
    return { data: null, error: "Failed to set user role. Please try again." };
  }

  // Fetch store name for the response
  let store_name: string | null = null;
  if (safeValues.store_id) {
    const { data: store } = await adminClient
      .from("stores")
      .select("name")
      .eq("id", safeValues.store_id)
      .single();
    store_name = store?.name ?? null;
  }

  return {
    data: {
      id: authData.user.id,
      email: safeValues.email,
      name: safeValues.name,
      role: safeValues.role,
      store_id: safeValues.store_id ?? null,
      store_name,
      is_active: true, // new user is always active at creation time
    },
    error: null,
  };
}

export async function updateUser(
  userId: string,
  values: UpdateUserValues
): Promise<ActionResult<null>> {
  const idParsed = userIdSchema.safeParse(userId);
  if (!idParsed.success) return { data: null, error: "Invalid user ID." };

  const parsed = updateUserSchema.safeParse(values);
  if (!parsed.success) {
    return { data: null, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const safeValues = parsed.data;

  const caller = await verifyAdmin();
  if (!caller) return { data: null, error: "Unauthorized." };

  const adminClient = createAdminClient();

  // Prevent admin from changing their own role
  if (caller.id === userId) {
    const { data: currentProfile } = await adminClient
      .from("profiles")
      .select("role")
      .eq("user_id", userId)
      .single();
    if (currentProfile?.role !== safeValues.role) {
      return { data: null, error: "You cannot change your own role." };
    }
  }

  // Update auth user (email + metadata)
  const { error: authError } = await adminClient.auth.admin.updateUserById(userId, {
    email: safeValues.email,
    user_metadata: { name: safeValues.name },
  });
  if (authError) {
    const msg = authError.message.toLowerCase().includes("already")
      ? "A user with this email already exists."
      : "Failed to update user. Please try again.";
    return { data: null, error: msg };
  }

  // Update profile (role + store_id)
  const { error: profileError } = await adminClient
    .from("profiles")
    .update({
      role: safeValues.role,
      store_id: safeValues.role === "store" ? (safeValues.store_id ?? null) : null,
    })
    .eq("user_id", userId);

  if (profileError) {
    console.error(
      `[updateUser] Profile update failed after auth update succeeded for userId=${userId}. Auth changes (email/name) persisted but role/store_id did not.`,
      profileError.message
    );
    return { data: null, error: "Failed to update user role. Please try again." };
  }

  return { data: null, error: null };
}

export async function deactivateUser(
  userId: string
): Promise<ActionResult<null>> {
  const idParsed = userIdSchema.safeParse(userId);
  if (!idParsed.success) return { data: null, error: "Invalid user ID." };

  const caller = await verifyAdmin();
  if (!caller) return { data: null, error: "Unauthorized." };
  if (caller.id === userId) {
    return { data: null, error: "You cannot deactivate your own account." };
  }

  const adminClient = createAdminClient();
  const { error } = await adminClient.auth.admin.updateUserById(userId, {
    ban_duration: "876000h",
  });

  if (error) return { data: null, error: "Failed to deactivate user. Please try again." };
  return { data: null, error: null };
}

export async function reactivateUser(
  userId: string
): Promise<ActionResult<null>> {
  const idParsed = userIdSchema.safeParse(userId);
  if (!idParsed.success) return { data: null, error: "Invalid user ID." };

  const caller = await verifyAdmin();
  if (!caller) return { data: null, error: "Unauthorized." };

  const adminClient = createAdminClient();
  const { error } = await adminClient.auth.admin.updateUserById(userId, {
    ban_duration: "none",
  });

  if (error) return { data: null, error: "Failed to reactivate user. Please try again." };
  return { data: null, error: null };
}

export async function createStore(
  values: CreateStoreValues
): Promise<ActionResult<StoreRow | null>> {
  // Server-side validation
  const parsed = createStoreSchema.safeParse(values);
  if (!parsed.success) {
    return { data: null, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const caller = await verifyAdmin();
  if (!caller) return { data: null, error: "Unauthorized." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stores")
    .insert({
      name: parsed.data.name,
      business_name: parsed.data.business_name ?? "",
      address: parsed.data.address ?? "",
      postal_code: parsed.data.postal_code ?? "",
      phone: parsed.data.phone ?? "",
      email: parsed.data.email ?? "",
    })
    .select("id, name, business_name, address, postal_code, phone, email")
    .single();

  if (error) return { data: null, error: "Failed to create store. Please try again." };
  return { data: data as StoreRow, error: null };
}

export async function updateStore(
  storeId: string,
  values: UpdateStoreValues
): Promise<ActionResult<null>> {
  const idParsed = z.string().uuid("Invalid store ID.").safeParse(storeId);
  if (!idParsed.success) return { data: null, error: "Invalid store ID." };

  const parsed = updateStoreSchema.safeParse(values);
  if (!parsed.success) {
    return { data: null, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const caller = await verifyAdmin();
  if (!caller) return { data: null, error: "Unauthorized." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("stores")
    .update({
      name: parsed.data.name,
      business_name: parsed.data.business_name ?? "",
      address: parsed.data.address ?? "",
      postal_code: parsed.data.postal_code ?? "",
      phone: parsed.data.phone ?? "",
      email: parsed.data.email ?? "",
    })
    .eq("id", storeId);

  if (error) return { data: null, error: "Failed to update store. Please try again." };
  return { data: null, error: null };
}

export async function deleteStore(
  storeId: string
): Promise<ActionResult<null>> {
  const idParsed = z.string().uuid("Invalid store ID.").safeParse(storeId);
  if (!idParsed.success) return { data: null, error: "Invalid store ID." };

  const caller = await verifyAdmin();
  if (!caller) return { data: null, error: "Unauthorized." };

  const supabase = await createClient();

  // Check if any users are assigned to this store
  const { count } = await supabase
    .from("profiles")
    .select("user_id", { count: "exact", head: true })
    .eq("store_id", storeId);

  if (count && count > 0) {
    return { data: null, error: "Cannot delete a store that has users assigned to it. Reassign or remove users first." };
  }

  const { error } = await supabase
    .from("stores")
    .delete()
    .eq("id", storeId);

  if (error) return { data: null, error: "Failed to delete store. Please try again." };
  return { data: null, error: null };
}

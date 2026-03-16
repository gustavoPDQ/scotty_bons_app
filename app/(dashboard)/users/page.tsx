import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { UsersPageClient } from "@/components/users/users-page-client";
import type { UserRow, StoreRow } from "@/lib/types";

const PER_PAGE = 20;

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (profile?.role !== "admin") redirect("/orders");

  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? "1"));

  const adminClient = createAdminClient();

  // Fetch paginated auth users
  const { data: listData } = await adminClient.auth.admin.listUsers({
    page,
    perPage: PER_PAGE,
  });
  const authUsers = listData?.users ?? [];
  // nextPage is null when on the last page — more reliable than comparing list length
  const hasMore =
    !!listData && "nextPage" in listData && listData.nextPage !== null;

  // Fetch profiles + store names for the listed users
  const userIds = authUsers.map((u) => u.id);
  const { data: profiles } =
    userIds.length > 0
      ? await adminClient
          .from("profiles")
          .select("user_id, role, store_id, stores(name)")
          .in("user_id", userIds)
      : { data: [] };

  // Merge auth users with profile data
  const users: UserRow[] = authUsers.map((u) => {
    const p = (profiles ?? []).find((pr) => pr.user_id === u.id);
    const storeData = p?.stores as unknown as { name: string } | null;
    return {
      id: u.id,
      email: u.email ?? "",
      name: (u.user_metadata?.name as string | undefined) ?? u.email ?? "",
      role: (p?.role as UserRow["role"]) ?? "store",
      store_id: p?.store_id ?? null,
      store_name: storeData?.name ?? null,
      is_active: !(u.banned_until && new Date(u.banned_until) > new Date()),
    };
  });

  // Fetch all stores for the dropdowns — use adminClient to bypass RLS on stores table
  const { data: stores } = await adminClient
    .from("stores")
    .select("id, name")
    .order("name");

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">User Management</h1>
      <UsersPageClient
        users={users}
        stores={(stores as StoreRow[]) ?? []}
        page={page}
        hasMore={hasMore}
        currentUserId={user.id}
      />
    </div>
  );
}

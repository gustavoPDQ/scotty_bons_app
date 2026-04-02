import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/shared/sidebar";
import { Header } from "@/components/shared/header";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  const role = profile?.role ?? "store";
  const userName = (user.user_metadata?.name as string | undefined) ?? user.email ?? "";
  const userEmail = user.email ?? "";

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar role={role} />
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <Header role={role} userName={userName} userEmail={userEmail} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}

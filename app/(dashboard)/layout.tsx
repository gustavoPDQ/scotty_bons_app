import { redirect } from "next/navigation";
import { Sidebar } from "@/components/shared/sidebar";
import { Header } from "@/components/shared/header";
import { getUser, getProfile } from "@/lib/supabase/auth-cache";
import { createPageTimer } from "@/lib/perf";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const timer = createPageTimer("Layout");
  const user = await timer.time("auth.getUser(cached)", () => getUser());

  if (!user) {
    redirect("/login");
  }

  const profile = await timer.time("profiles.select(cached)", () => getProfile());

  timer.summary();

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

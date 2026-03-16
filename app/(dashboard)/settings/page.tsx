import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ChangePasswordForm } from "@/components/settings/change-password-form";
import { ChangeEmailForm } from "@/components/settings/change-email-form";

export default async function SettingsPage() {
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

  const isAdmin = profile?.role === "admin";

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold">Settings</h1>

      <section className="space-y-6">
        <h2 className="text-lg font-semibold">Account</h2>
        <ChangePasswordForm />
        <ChangeEmailForm />
      </section>

      {isAdmin && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Financial Configuration</h2>
          <p className="text-muted-foreground text-sm">
            Financial configuration settings — coming soon (Story 5.1).
          </p>
        </section>
      )}
    </div>
  );
}

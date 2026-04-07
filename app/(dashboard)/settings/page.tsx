import { createClient } from "@/lib/supabase/server";
import { getUser, getProfile } from "@/lib/supabase/auth-cache";
import { redirect } from "next/navigation";
import { ChangePasswordForm } from "@/components/settings/change-password-form";
import { ChangeEmailForm } from "@/components/settings/change-email-form";
import { FinancialSettingsForm } from "@/components/settings/financial-settings-form";

export default async function SettingsPage() {
  const user = await getUser();
  if (!user) redirect("/login");

  const profile = await getProfile();
  const isAdmin = profile?.role === "admin";
  if (!isAdmin) redirect("/orders");

  const supabase = await createClient();

  const financialSettings: Record<string, string> = {};
  if (isAdmin) {
    const { data: fsRows } = await supabase
      .from("financial_settings")
      .select("key, value");

    for (const row of fsRows ?? []) {
      financialSettings[row.key] = row.value;
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <h1 className="text-xl font-bold">Settings</h1>

      <section className="space-y-6">
        <h2 className="text-lg font-semibold">Account</h2>
        <ChangePasswordForm />
        <ChangeEmailForm />
      </section>

      {isAdmin && (
        <section className="space-y-6">
          <h2 className="text-lg font-semibold">General Settings</h2>
          <FinancialSettingsForm initialValues={financialSettings} />
        </section>
      )}
    </div>
  );
}

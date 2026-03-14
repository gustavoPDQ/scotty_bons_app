import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function RootPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (!data?.claims) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", data.claims.sub)
    .single();

  redirect(profile?.role === "admin" ? "/dashboard" : "/orders");
}

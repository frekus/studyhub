import { createClient } from "@/lib/supabase/server";
import { ok, err } from "@/lib/response";

export async function GET() {
  const supabase = await createClient();

  // getUser() verifies the JWT with Supabase on every call — never trust getSession() alone
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) return err("Unauthorized", 401);

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

  if (profileError) return err(profileError.message, 500);

  return ok({ user: { ...profile, email: user.email } });
}

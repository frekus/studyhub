import { createClient } from "@/lib/supabase/server";
import { ok, err } from "@/lib/response";

export async function POST() {
  const supabase = await createClient();

  const { error } = await supabase.auth.signOut();

  if (error) return err(error.message, 500);

  return ok({ success: true });
}

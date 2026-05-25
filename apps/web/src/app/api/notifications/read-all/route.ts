import { createClient, requireUser } from "@/lib/supabase/server";
import { ok, err } from "@/lib/response";

export async function PATCH() {
  const supabase = await createClient();
  const { user, authErr } = await requireUser(supabase);
  if (authErr) return authErr;

  const { error } = await supabase
    .from("group_notifications")
    .update({ is_read: true })
    .eq("user_id", user.id)
    .eq("is_read", false);

  if (error) return err(error.message, 500);
  return ok({ success: true });
}

import { createClient, requireUser } from "@/lib/supabase/server";
import { ok, err } from "@/lib/response";

export async function GET() {
  const supabase = await createClient();
  const { user, authErr } = await requireUser(supabase);
  if (authErr) return authErr;

  const { data: notifications, error } = await supabase
    .from("group_notifications")
    .select("*")
    .eq("user_id", user.id)
    .eq("is_read", false)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) return err(error.message, 500);

  return ok({ notifications: notifications ?? [], unread_count: (notifications ?? []).length });
}

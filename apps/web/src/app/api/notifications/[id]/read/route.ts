import { createClient, requireUser } from "@/lib/supabase/server";
import { ok, err } from "@/lib/response";

type Params = Promise<{ id: string }>;

export async function PATCH(_request: Request, { params }: { params: Params }) {
  const { id } = await params;
  const supabase = await createClient();
  const { user, authErr } = await requireUser(supabase);
  if (authErr) return authErr;

  const { error } = await supabase
    .from("group_notifications")
    .update({ is_read: true })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return err(error.message, 500);
  return ok({ success: true });
}

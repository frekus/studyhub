import { createClient, requireUser } from "@/lib/supabase/server";
import { ok, err } from "@/lib/response";

export async function GET() {
  const supabase = await createClient();
  const { user, authErr } = await requireUser(supabase);
  if (authErr) return authErr;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: conversations, error } = await (supabase as any)
    .from("ai_conversations")
    .select("id, title, created_at, updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(20);

  if (error) return err((error as { message: string }).message, 500);

  return ok({ conversations: conversations ?? [] });
}

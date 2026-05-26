import { createClient, requireUser } from "@/lib/supabase/server";
import { ok, err } from "@/lib/response";

type Params = Promise<{ id: string }>;

export async function GET(_req: Request, { params }: { params: Params }) {
  const { id } = await params;
  const supabase = await createClient();
  const { user, authErr } = await requireUser(supabase);
  if (authErr) return authErr;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: conversation, error: convErr } = await (supabase as any)
    .from("ai_conversations")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (convErr?.code === "PGRST116") return err("Conversation not found", 404);
  if (convErr) return err((convErr as { message: string }).message, 500);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: messages, error: msgErr } = await (supabase as any)
    .from("ai_messages")
    .select("id, role, content, attachments, created_at")
    .eq("conversation_id", id)
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (msgErr) return err((msgErr as { message: string }).message, 500);

  return ok({ conversation, messages: messages ?? [] });
}

export async function DELETE(_req: Request, { params }: { params: Params }) {
  const { id } = await params;
  const supabase = await createClient();
  const { user, authErr } = await requireUser(supabase);
  if (authErr) return authErr;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("ai_conversations")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return err((error as { message: string }).message, 500);
  return ok({ success: true });
}

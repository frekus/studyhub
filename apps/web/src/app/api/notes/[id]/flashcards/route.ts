import { createClient, requireUser } from "@/lib/supabase/server";
import { ok, err } from "@/lib/response";

type Params = Promise<{ id: string }>;

export async function GET(_request: Request, { params }: { params: Params }) {
  const { id } = await params;
  const supabase = await createClient();
  const { user, authErr } = await requireUser(supabase);
  if (authErr) return authErr;

  // Filter by both note_id and user_id — ownership check without a join
  const { data: flashcards, error } = await supabase
    .from("flashcards")
    .select("id, question, answer, created_at")
    .eq("note_id", id)
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (error) return err(error.message, 500);

  return ok({ flashcards });
}

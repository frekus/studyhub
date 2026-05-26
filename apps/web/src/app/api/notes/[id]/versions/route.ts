import { createClient, requireUser } from "@/lib/supabase/server";
import { ok, err } from "@/lib/response";

type Params = Promise<{ id: string }>;

export async function GET(_req: Request, { params }: { params: Params }) {
  const { id: noteId } = await params;
  const supabase = await createClient();
  const { user, authErr } = await requireUser(supabase);
  if (authErr) return authErr;

  // Verify the note belongs to this user
  const { error: noteErr } = await supabase
    .from("study_notes")
    .select("id")
    .eq("id", noteId)
    .eq("user_id", user.id)
    .single();

  if (noteErr) return err("Note not found", 404);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: versions, error } = await (supabase as any)
    .from("note_versions")
    .select("id, version_number, title, created_at, content")
    .eq("note_id", noteId)
    .eq("user_id", user.id)
    .order("version_number", { ascending: false });

  if (error) return err(error.message, 500);

  const result = (versions ?? []).map((v: Record<string, unknown>) => ({
    id:             v.id,
    version_number: v.version_number,
    title:          v.title,
    created_at:     v.created_at,
    content_preview: typeof v.content === "string"
      ? v.content.slice(0, 120) + (v.content.length > 120 ? "…" : "")
      : null,
  }));

  return ok({ versions: result });
}

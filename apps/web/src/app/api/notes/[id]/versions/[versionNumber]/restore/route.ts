import { createClient, requireUser } from "@/lib/supabase/server";
import { ok, err } from "@/lib/response";
import { tryDel, cacheKeys } from "@/lib/cache";

type Params = Promise<{ id: string; versionNumber: string }>;

export async function POST(_req: Request, { params }: { params: Params }) {
  const { id: noteId, versionNumber } = await params;
  const vNum = parseInt(versionNumber, 10);
  if (isNaN(vNum)) return err("Invalid version number", 400);

  const supabase = await createClient();
  const { user, authErr } = await requireUser(supabase);
  if (authErr) return authErr;

  // Fetch the version to restore
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: version, error: vErr } = await (supabase as any)
    .from("note_versions")
    .select("*")
    .eq("note_id", noteId)
    .eq("user_id", user.id)
    .eq("version_number", vNum)
    .single();

  if (vErr?.code === "PGRST116") return err("Version not found", 404);
  if (vErr) return err(vErr.message, 500);

  // Fetch the current note to save as a new version first
  const { data: current, error: noteErr } = await supabase
    .from("study_notes")
    .select("title, content")
    .eq("id", noteId)
    .eq("user_id", user.id)
    .single();

  if (noteErr) return err("Note not found", 404);

  // Get next version number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: latest } = await (supabase as any)
    .from("note_versions")
    .select("version_number")
    .eq("note_id", noteId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVNum = ((latest?.version_number as number | null) ?? 0) + 1;

  // Save current as new version
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from("note_versions")
    .insert({
      note_id:        noteId,
      user_id:        user.id,
      version_number: nextVNum,
      title:          current.title,
      content:        current.content,
    });

  // Restore the selected version to the note
  const { data: updatedNote, error: updateErr } = await supabase
    .from("study_notes")
    .update({
      title:   (version as { title: string }).title,
      content: (version as { content: string | null }).content ?? "",
    })
    .eq("id", noteId)
    .eq("user_id", user.id)
    .select()
    .single();

  if (updateErr) return err(updateErr.message, 500);

  await tryDel(
    cacheKeys.noteSingle(user.id, noteId),
    cacheKeys.notesList(user.id),
  );

  return ok({ note: updatedNote, restoredFrom: vNum });
}

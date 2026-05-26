import { createClient, requireUser } from "@/lib/supabase/server";
import { ok, err } from "@/lib/response";

type Params = Promise<{ id: string; versionNumber: string }>;

export async function GET(_req: Request, { params }: { params: Params }) {
  const { id: noteId, versionNumber } = await params;
  const vNum = parseInt(versionNumber, 10);
  if (isNaN(vNum)) return err("Invalid version number", 400);

  const supabase = await createClient();
  const { user, authErr } = await requireUser(supabase);
  if (authErr) return authErr;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: version, error } = await (supabase as any)
    .from("note_versions")
    .select("*")
    .eq("note_id", noteId)
    .eq("user_id", user.id)
    .eq("version_number", vNum)
    .single();

  if (error?.code === "PGRST116") return err("Version not found", 404);
  if (error) return err(error.message, 500);

  return ok({ version });
}

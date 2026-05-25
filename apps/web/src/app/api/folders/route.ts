import { z } from "zod";
import { createClient, requireUser } from "@/lib/supabase/server";
import { ok, err, validationErr } from "@/lib/response";

const ALLOWED_COLORS = ["#14B8A7","#F97316","#8B5CF6","#EF4444","#10B981","#3B82F6","#F59E0B","#EC4899"];
const ALLOWED_ICONS  = ["folder","book-open","brain","target","users","star"];

const CreateFolderSchema = z.object({
  name:  z.string().min(1, "Name required").max(50, "Max 50 characters"),
  color: z.string().refine((c) => ALLOWED_COLORS.includes(c), "Invalid color"),
  icon:  z.string().refine((i) => ALLOWED_ICONS.includes(i),  "Invalid icon"),
});

export async function GET() {
  const supabase = await createClient();
  const { user, authErr } = await requireUser(supabase);
  if (authErr) return authErr;

  const [{ data: foldersData }, { data: notesData }, { count: uncategorizedCount }] =
    await Promise.all([
      supabase.from("note_folders").select("*").order("created_at"),
      supabase.from("study_notes").select("folder_id").not("folder_id", "is", null),
      supabase
        .from("study_notes")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .is("folder_id", null),
    ]);

  const countMap: Record<string, number> = {};
  (notesData ?? []).forEach((n) => {
    if (n.folder_id) countMap[n.folder_id] = (countMap[n.folder_id] ?? 0) + 1;
  });

  const folders = (foldersData ?? []).map((f) => ({
    ...f,
    note_count: countMap[f.id] ?? 0,
  }));

  return ok({ folders, uncategorized_count: uncategorizedCount ?? 0 });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { user, authErr } = await requireUser(supabase);
  if (authErr) return authErr;

  let body: unknown;
  try { body = await request.json(); } catch { return err("Invalid JSON body", 400); }

  const parsed = CreateFolderSchema.safeParse(body);
  if (!parsed.success) return validationErr(parsed.error);

  const { data: folder, error } = await supabase
    .from("note_folders")
    .insert({ ...parsed.data, user_id: user.id })
    .select()
    .single();

  if (error) return err(error.message, 500);

  return ok({ folder }, 201);
}

import { z } from "zod";
import { createClient, requireUser } from "@/lib/supabase/server";
import { ok, err, validationErr } from "@/lib/response";

const ALLOWED_COLORS = ["#14B8A7","#F97316","#8B5CF6","#EF4444","#10B981","#3B82F6","#F59E0B","#EC4899"];
const ALLOWED_ICONS  = ["folder","book-open","brain","target","users","star"];

const UpdateFolderSchema = z
  .object({
    name:  z.string().min(1).max(50).optional(),
    color: z.string().refine((c) => ALLOWED_COLORS.includes(c), "Invalid color").optional(),
    icon:  z.string().refine((i) => ALLOWED_ICONS.includes(i),  "Invalid icon").optional(),
  })
  .refine((d) => d.name !== undefined || d.color !== undefined || d.icon !== undefined, {
    message: "At least one field must be provided",
  });

type Params = Promise<{ id: string }>;

export async function PATCH(request: Request, { params }: { params: Params }) {
  const { id } = await params;
  const supabase = await createClient();
  const { authErr } = await requireUser(supabase);
  if (authErr) return authErr;

  let body: unknown;
  try { body = await request.json(); } catch { return err("Invalid JSON body", 400); }

  const parsed = UpdateFolderSchema.safeParse(body);
  if (!parsed.success) return validationErr(parsed.error);

  const { data: folder, error } = await supabase
    .from("note_folders")
    .update(parsed.data)
    .eq("id", id)
    .select()
    .single();

  if (error?.code === "PGRST116") return err("Folder not found", 404);
  if (error) return err(error.message, 500);

  return ok({ folder });
}

export async function DELETE(_request: Request, { params }: { params: Params }) {
  const { id } = await params;
  const supabase = await createClient();
  const { authErr } = await requireUser(supabase);
  if (authErr) return authErr;

  // ON DELETE SET NULL handles nullifying note folder_ids in the DB
  const { error } = await supabase
    .from("note_folders")
    .delete()
    .eq("id", id);

  if (error) return err(error.message, 500);

  return ok({ success: true });
}

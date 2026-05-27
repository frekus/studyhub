import { createClient, requireUser } from "@/lib/supabase/server";
import { createAdminClient } from "@studyhub/database";
import { ok, err } from "@/lib/response";

type Params = Promise<{ id: string; uploadId: string }>;

export async function DELETE(_request: Request, { params }: { params: Params }) {
  const { uploadId } = await params;
  const supabase = await createClient();
  const { user, authErr } = await requireUser(supabase);
  if (authErr) return authErr;

  const admin = createAdminClient();

  // Verify ownership — only the uploader can delete
  const { data: upload } = await admin
    .from("group_exam_uploads")
    .select("id")
    .eq("id", uploadId)
    .eq("uploaded_by", user.id)
    .maybeSingle();

  if (!upload) return err("Not found or access denied", 403);

  const { error } = await admin
    .from("group_exam_uploads")
    .delete()
    .eq("id", uploadId);

  if (error) return err(error.message, 500);

  return ok({ success: true });
}

import { createClient, requireUser } from "@/lib/supabase/server";
import { createAdminClient } from "@studyhub/database";
import { ok, err } from "@/lib/response";

type Params = Promise<{ id: string; predictionId: string }>;

export async function DELETE(_request: Request, { params }: { params: Params }) {
  const { id: groupId, predictionId } = await params;
  const supabase = await createClient();
  const { user, authErr } = await requireUser(supabase);
  if (authErr) return authErr;

  const admin = createAdminClient();

  const { data: membership } = await admin
    .from("study_group_members")
    .select("id")
    .eq("group_id", groupId)
    .eq("user_id", user.id)
    .single();

  if (!membership) return err("Not a group member", 403);

  // Verify the user is the creator of this prediction
  const { data: prediction } = await admin
    .from("group_predictions")
    .select("created_by")
    .eq("id", predictionId)
    .eq("group_id", groupId)
    .single();

  if (!prediction) return err("Prediction not found", 404);
  if (prediction.created_by !== user.id) return err("Only the creator can delete this prediction", 403);

  const { error } = await admin
    .from("group_predictions")
    .delete()
    .eq("id", predictionId)
    .eq("group_id", groupId);

  if (error) return err(error.message, 500);

  return ok({ success: true });
}

import { z } from "zod";
import { createClient, requireUser } from "@/lib/supabase/server";
import { createAdminClient } from "@studyhub/database";
import { ok, err, validationErr } from "@/lib/response";

type Params = Promise<{ id: string; sessionId: string }>;

const UpdateSessionSchema = z.object({
  current_card_index: z.number().int().min(0).optional(),
  is_active:          z.boolean().optional(),
}).refine((d) => d.current_card_index !== undefined || d.is_active !== undefined, {
  message: "At least one field required",
});

export async function PATCH(request: Request, { params }: { params: Params }) {
  const { sessionId } = await params;
  const supabase = await createClient();
  const { user, authErr } = await requireUser(supabase);
  if (authErr) return authErr;

  const admin = createAdminClient();

  const { data: session } = await admin
    .from("study_sessions").select("host_id").eq("id", sessionId).maybeSingle();
  if (!session) return err("Session not found", 404);
  if (session.host_id !== user.id) return err("Only the host can update the session", 403);

  let body: unknown;
  try { body = await request.json(); } catch { return err("Invalid JSON", 400); }
  const parsed = UpdateSessionSchema.safeParse(body);
  if (!parsed.success) return validationErr(parsed.error);

  const { data: updated, error } = await admin
    .from("study_sessions")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", sessionId).select().single();

  if (error) return err(error.message, 500);
  return ok({ session: updated });
}

export async function DELETE(_request: Request, { params }: { params: Params }) {
  const { sessionId } = await params;
  const supabase = await createClient();
  const { user, authErr } = await requireUser(supabase);
  if (authErr) return authErr;

  const admin = createAdminClient();

  const { data: session } = await admin
    .from("study_sessions").select("host_id").eq("id", sessionId).maybeSingle();
  if (!session) return err("Session not found", 404);
  if (session.host_id !== user.id) return err("Only the host can end the session", 403);

  await admin
    .from("study_sessions")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", sessionId);

  return ok({ success: true });
}

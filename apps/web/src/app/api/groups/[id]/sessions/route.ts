import { z } from "zod";
import { createClient, requireUser } from "@/lib/supabase/server";
import { createAdminClient } from "@studyhub/database";
import { ok, err, validationErr } from "@/lib/response";

type Params = Promise<{ id: string }>;

const CreateSessionSchema = z.object({
  noteId:    z.string().uuid(),
  noteTitle: z.string().min(1),
});

async function assertMember(admin: ReturnType<typeof createAdminClient>, groupId: string, userId: string) {
  const { data } = await admin
    .from("study_group_members").select("id")
    .eq("group_id", groupId).eq("user_id", userId).maybeSingle();
  return !!data;
}

export async function POST(request: Request, { params }: { params: Params }) {
  const { id } = await params;
  const supabase = await createClient();
  const { user, authErr } = await requireUser(supabase);
  if (authErr) return authErr;

  const admin = createAdminClient();
  if (!(await assertMember(admin, id, user.id))) return err("Access denied", 403);

  let body: unknown;
  try { body = await request.json(); } catch { return err("Invalid JSON", 400); }
  const parsed = CreateSessionSchema.safeParse(body);
  if (!parsed.success) return validationErr(parsed.error);

  // End any existing active sessions for this group first
  await admin.from("study_sessions")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("group_id", id).eq("is_active", true);

  const { data: session, error } = await admin
    .from("study_sessions")
    .insert({
      group_id: id, host_id: user.id,
      note_id: parsed.data.noteId, note_title: parsed.data.noteTitle,
    })
    .select().single();

  if (error) return err(error.message, 500);

  // Add host as first participant
  await admin.from("session_participants").insert({ session_id: session.id, user_id: user.id });

  return ok({ session }, 201);
}

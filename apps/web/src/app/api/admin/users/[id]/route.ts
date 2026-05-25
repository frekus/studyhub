import { createClient, requireUser } from "@/lib/supabase/server";
import { createAdminClient } from "@studyhub/database";
import { ok, err } from "@/lib/response";
import { requireAdmin } from "@/lib/admin";
import { z } from "zod";

type Params = Promise<{ id: string }>;

const UpdateSchema = z.object({
  subscription_tier: z.enum(["free", "popular", "pro"]).optional(),
  subscription_status: z.enum(["active", "cancelled", "past_due", "suspended"]).optional(),
  subscription_expires_at: z.string().nullable().optional(),
  full_name: z.string().min(1).max(200).optional(),
});

export async function GET(_request: Request, { params }: { params: Params }) {
  const { id } = await params;
  const supabase = await createClient();
  const { user, authErr } = await requireUser(supabase);
  if (authErr) return authErr;

  const admin = createAdminClient();
  try { await requireAdmin(admin, user.id); } catch { return err("Forbidden", 403); }

  const [
    { data: profile },
    { data: authUserResp },
    { count: notesCount },
    { count: flashcardsCount },
    { count: examsCount },
    { data: streak },
    { data: recentNotes },
  ] = await Promise.all([
    admin.from("users").select("*").eq("id", id).maybeSingle(),
    admin.auth.admin.getUserById(id),
    admin.from("study_notes").select("id", { count: "exact", head: true }).eq("user_id", id),
    admin.from("flashcards").select("id", { count: "exact", head: true }).eq("user_id", id),
    admin.from("exam_uploads").select("id", { count: "exact", head: true }).eq("user_id", id),
    admin.from("study_streaks").select("current_streak, total_study_days").eq("user_id", id).maybeSingle(),
    admin.from("study_notes").select("id, title, created_at").eq("user_id", id).order("created_at", { ascending: false }).limit(5),
  ]);

  if (!profile) return err("User not found", 404);

  const authUser = authUserResp.user;

  return ok({
    profile,
    auth: authUser ? {
      email: authUser.email ?? "",
      created_at: authUser.created_at,
      last_sign_in_at: authUser.last_sign_in_at ?? null,
      app_metadata: authUser.app_metadata,
    } : null,
    stats: {
      notes_count: notesCount ?? 0,
      flashcards_count: flashcardsCount ?? 0,
      exams_count: examsCount ?? 0,
      current_streak: streak?.current_streak ?? 0,
      total_study_days: streak?.total_study_days ?? 0,
    },
    recent_notes: recentNotes ?? [],
  });
}

export async function PATCH(request: Request, { params }: { params: Params }) {
  const { id } = await params;
  const supabase = await createClient();
  const { user, authErr } = await requireUser(supabase);
  if (authErr) return authErr;

  const admin = createAdminClient();
  try { await requireAdmin(admin, user.id); } catch { return err("Forbidden", 403); }

  let body: unknown;
  try { body = await request.json(); } catch { return err("Invalid JSON", 400); }

  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Invalid input", 400);

  const { data: updated, error } = await admin
    .from("users")
    .update(parsed.data)
    .eq("id", id)
    .select()
    .single();

  if (error) return err(error.message, 500);
  return ok({ user: updated });
}

export async function DELETE(_request: Request, { params }: { params: Params }) {
  const { id } = await params;
  const supabase = await createClient();
  const { user, authErr } = await requireUser(supabase);
  if (authErr) return authErr;

  const admin = createAdminClient();
  try { await requireAdmin(admin, user.id); } catch { return err("Forbidden", 403); }

  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) return err(error.message, 500);
  return ok({ success: true });
}

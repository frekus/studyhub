import { createClient, requireUser } from "@/lib/supabase/server";
import { createAdminClient } from "@studyhub/database";
import { ok, err } from "@/lib/response";
import { requireAdmin } from "@/lib/admin";

export async function GET() {
  const supabase = await createClient();
  const { user, authErr } = await requireUser(supabase);
  if (authErr) return authErr;

  const admin = createAdminClient();
  try { await requireAdmin(admin, user.id); } catch { return err("Forbidden", 403); }

  const [{ data: signupProfiles }, { data: notes }, { data: exams }] = await Promise.all([
    admin.from("users")
      .select("id, full_name, created_at, subscription_tier")
      .order("created_at", { ascending: false }).limit(20),
    admin.from("study_notes").select("id, title, created_at, user_id")
      .order("created_at", { ascending: false }).limit(20),
    admin.from("exam_uploads").select("id, title, created_at, user_id")
      .order("created_at", { ascending: false }).limit(10),
  ]);

  // Get emails for all relevant user IDs via auth admin
  const signupIds = (signupProfiles ?? []).map((u) => u.id);
  const noteUserIds = [...new Set((notes ?? []).map((n) => n.user_id))];
  const examUserIds = [...new Set((exams ?? []).map((e) => e.user_id))];
  const allIds = [...new Set([...signupIds, ...noteUserIds, ...examUserIds])];

  // Fetch auth users to get emails
  const emailMap: Record<string, string> = {};
  const { data: authList } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  for (const u of authList?.users ?? []) emailMap[u.id] = u.email ?? "";

  return ok({
    signups: (signupProfiles ?? []).map((u) => ({
      id: u.id,
      type: "signup",
      email: emailMap[u.id] ?? u.id.slice(0, 8),
      name: u.full_name ?? "",
      plan: u.subscription_tier ?? "free",
      created_at: u.created_at,
    })),
    notes: (notes ?? []).map((n) => ({
      id: n.id,
      type: "note_created",
      title: n.title,
      user_email: emailMap[n.user_id] ?? n.user_id.slice(0, 8),
      created_at: n.created_at,
    })),
    exams: (exams ?? []).map((e) => ({
      id: e.id,
      type: "exam_uploaded",
      title: e.title,
      user_email: emailMap[e.user_id] ?? e.user_id.slice(0, 8),
      created_at: e.created_at,
    })),
  });
}

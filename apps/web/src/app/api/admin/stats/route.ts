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

  const now = new Date();
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const weekStart  = new Date(now); weekStart.setDate(now.getDate() - 7);

  const [
    { count: totalUsers },
    { count: newToday },
    { count: newThisWeek },
    { count: totalNotes },
    { count: totalExams },
    { count: totalFlashcards },
    { data: planCounts },
    { data: activeToday },
  ] = await Promise.all([
    admin.from("users").select("id", { count: "exact", head: true }),
    admin.from("users").select("id", { count: "exact", head: true }).gte("created_at", todayStart.toISOString()),
    admin.from("users").select("id", { count: "exact", head: true }).gte("created_at", weekStart.toISOString()),
    admin.from("study_notes").select("id", { count: "exact", head: true }),
    admin.from("exam_uploads").select("id", { count: "exact", head: true }),
    admin.from("flashcards").select("id", { count: "exact", head: true }),
    admin.from("users").select("subscription_tier"),
    admin.from("study_activity").select("user_id", { count: "exact" }).eq("activity_date", todayStart.toISOString().slice(0, 10)),
  ]);

  const plans = (planCounts ?? []).reduce<Record<string, number>>((acc, u) => {
    const t = (u.subscription_tier as string) ?? "free";
    acc[t] = (acc[t] ?? 0) + 1;
    return acc;
  }, {});

  const freeUsers    = plans["free"] ?? 0;
  const popularUsers = plans["popular"] ?? 0;
  const proUsers     = plans["pro"] ?? 0;
  const revenueThisMonth = popularUsers * 5000 + proUsers * 10000;

  return ok({
    total_users: totalUsers ?? 0,
    new_users_today: newToday ?? 0,
    new_users_this_week: newThisWeek ?? 0,
    active_users_today: activeToday?.length ?? 0,
    free_users: freeUsers,
    popular_users: popularUsers,
    pro_users: proUsers,
    total_notes: totalNotes ?? 0,
    total_exams: totalExams ?? 0,
    total_flashcards: totalFlashcards ?? 0,
    revenue_this_month: revenueThisMonth,
  });
}

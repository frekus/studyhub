import { createClient, requireUser } from "@/lib/supabase/server";
import { createAdminClient } from "@studyhub/database";
import { ok, err } from "@/lib/response";
import { requireAdmin } from "@/lib/admin";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { user, authErr } = await requireUser(supabase);
  if (authErr) return authErr;

  const admin = createAdminClient();
  try { await requireAdmin(admin, user.id); } catch { return err("Forbidden", 403); }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search")?.trim() ?? "";
  const plan   = searchParams.get("plan") ?? "";
  const status = searchParams.get("status") ?? "";
  const page   = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit  = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));

  // Get auth users (includes email)
  const { data: authData, error: authError } = await admin.auth.admin.listUsers({
    page: search ? 1 : page,
    perPage: search ? 1000 : limit,
  });
  if (authError) return err(authError.message, 500);

  let authUsers = authData.users;

  // Search filter in memory (auth.admin has no server-side email search)
  if (search) {
    const q = search.toLowerCase();
    authUsers = authUsers.filter(
      (u) => u.email?.toLowerCase().includes(q)
    );
  }

  const allIds = authUsers.map((u) => u.id);

  // Get subscription info from public.users
  let pubQuery = admin.from("users").select(
    "id, full_name, subscription_tier, subscription_status, subscription_expires_at, created_at"
  ).in("id", allIds.length > 0 ? allIds : ["00000000-0000-0000-0000-000000000000"]);

  if (plan)   pubQuery = pubQuery.eq("subscription_tier", plan) as typeof pubQuery;
  if (status) pubQuery = pubQuery.eq("subscription_status", status) as typeof pubQuery;

  const { data: pubUsers, error: pubError } = await pubQuery;
  if (pubError) return err(pubError.message, 500);

  // Build public user map
  const pubMap: Record<string, typeof pubUsers[number]> = {};
  for (const p of pubUsers ?? []) pubMap[p.id] = p;

  // Filter auth users to only those with public profile matching plan/status filters
  let filtered = allIds.filter((id) => pubMap[id]);
  if (plan || status) {
    // Already filtered by pubQuery; re-align
    filtered = (pubUsers ?? []).map((p) => p.id);
  }

  // Apply pagination on filtered set
  const total       = filtered.length;
  const totalPages  = Math.ceil(total / limit);
  const sliced      = search ? filtered.slice((page - 1) * limit, page * limit) : filtered;

  // Build email map from auth
  const emailMap: Record<string, string> = {};
  for (const u of authUsers) emailMap[u.id] = u.email ?? "";

  // Get notes counts
  const pageIds = sliced;
  let notesMap: Record<string, number> = {};
  if (pageIds.length > 0) {
    const { data: noteCounts } = await admin
      .from("study_notes").select("user_id").in("user_id", pageIds);
    for (const n of noteCounts ?? []) notesMap[n.user_id] = (notesMap[n.user_id] ?? 0) + 1;
  }

  // Get last activity
  let lastActiveMap: Record<string, string | null> = {};
  if (pageIds.length > 0) {
    const { data: activity } = await admin
      .from("study_activity").select("user_id, activity_date").in("user_id", pageIds)
      .order("activity_date", { ascending: false });
    for (const a of activity ?? []) {
      if (!lastActiveMap[a.user_id]) lastActiveMap[a.user_id] = a.activity_date;
    }
  }

  const result = sliced.map((id) => {
    const pub = pubMap[id];
    return {
      id,
      email: emailMap[id] ?? "",
      full_name: pub?.full_name ?? null,
      subscription_tier: pub?.subscription_tier ?? "free",
      subscription_status: pub?.subscription_status ?? "active",
      subscription_expires_at: pub?.subscription_expires_at ?? null,
      created_at: pub?.created_at ?? "",
      notes_count: notesMap[id] ?? 0,
      last_active: lastActiveMap[id] ?? null,
    };
  });

  return ok({ users: result, total, page, limit, total_pages: totalPages });
}

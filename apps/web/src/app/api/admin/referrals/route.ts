import { createClient, requireUser } from "@/lib/supabase/server";
import { createAdminClient } from "@studyhub/database";
import { ok, err } from "@/lib/response";

export async function GET() {
  const supabase = await createClient();
  const { user, authErr } = await requireUser(supabase);
  if (authErr) return authErr;

  const admin = createAdminClient();

  // Verify admin
  const { data: adminRow } = await admin
    .from("admin_users").select("role").eq("user_id", user.id).maybeSingle();
  if (!adminRow) return err("Access denied", 403);

  // Get all referrals with usage counts
  const { data: referrals, error } = await admin
    .from("referrals")
    .select("id, code, created_at, referrer_id, referral_uses(id, signed_up_at, subscribed_at, subscription_tier, rewarded)")
    .order("created_at", { ascending: false });

  if (error) return err(error.message, 500);

  // Get referrer names
  const referrerIds = [...new Set((referrals ?? []).map(r => r.referrer_id))];
  const { data: users } = await admin
    .from("users").select("id, full_name").in("id", referrerIds);

  const nameMap = Object.fromEntries((users ?? []).map(u => [u.id, u.full_name ?? "Unknown"]));

  const enriched = (referrals ?? []).map(r => ({
    id: r.id,
    code: r.code,
    created_at: r.created_at,
    referrer_id: r.referrer_id,
    referrer_name: nameMap[r.referrer_id] ?? "Unknown",
    total_signups:   r.referral_uses?.length ?? 0,
    total_subscribed: r.referral_uses?.filter((u: {subscribed_at: string|null}) => u.subscribed_at).length ?? 0,
    total_rewarded:  r.referral_uses?.filter((u: {rewarded: boolean}) => u.rewarded).length ?? 0,
  }));

  const totalCodes      = enriched.length;
  const totalSignups    = enriched.reduce((s, r) => s + r.total_signups, 0);
  const totalSubscribed = enriched.reduce((s, r) => s + r.total_subscribed, 0);
  const totalRewarded   = enriched.reduce((s, r) => s + r.total_rewarded, 0);

  return ok({ stats: { totalCodes, totalSignups, totalSubscribed, totalRewarded }, referrals: enriched });
}

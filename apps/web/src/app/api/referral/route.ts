import { createClient, requireUser } from "@/lib/supabase/server";
import { createAdminClient } from "@studyhub/database";
import { ok, err } from "@/lib/response";

function generateCode(userId: string): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const prefix = userId.slice(0, 4).toUpperCase().replace(/-/g, "X");
  let suffix = "";
  for (let i = 0; i < 4; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return `${prefix}${suffix}`;
}

export async function GET() {
  const supabase = await createClient();
  const { user, authErr } = await requireUser(supabase);
  if (authErr) return authErr;

  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("referrals")
    .select("id, code, created_at")
    .eq("referrer_id", user.id)
    .maybeSingle();

  if (existing) {
    const { data: uses } = await admin
      .from("referral_uses")
      .select("id, signed_up_at, subscribed_at, rewarded, subscription_tier")
      .eq("referral_id", existing.id)
      .order("signed_up_at", { ascending: false });

    const total      = uses?.length ?? 0;
    const subscribed = uses?.filter(u => u.subscribed_at).length ?? 0;
    const rewarded   = uses?.filter(u => u.rewarded).length ?? 0;
    const progress   = subscribed % 10;

    return ok({ code: existing.code, referralId: existing.id, stats: { total, subscribed, rewarded, progress, nextRewardAt: 10 }, uses: uses ?? [] });
  }

  let code = generateCode(user.id);
  for (let i = 0; i < 5; i++) {
    const { data: clash } = await admin.from("referrals").select("id").eq("code", code).maybeSingle();
    if (!clash) break;
    code = generateCode(user.id + i);
  }

  const { data: created, error } = await admin
    .from("referrals")
    .insert({ referrer_id: user.id, code })
    .select()
    .single();

  if (error) return err(error.message, 500);

  return ok({ code: created.code, referralId: created.id, stats: { total: 0, subscribed: 0, rewarded: 0, progress: 0, nextRewardAt: 10 }, uses: [] });
}

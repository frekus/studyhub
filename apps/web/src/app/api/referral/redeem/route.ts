import { createClient, requireUser } from "@/lib/supabase/server";
import { createAdminClient } from "@studyhub/database";
import { ok, err } from "@/lib/response";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { user, authErr } = await requireUser(supabase);
  if (authErr) return authErr;

  const admin = createAdminClient();

  let body: { code?: string };
  try { body = await request.json(); } catch { return err("Invalid request", 400); }

  const code = body.code?.trim().toUpperCase();
  if (!code) return err("Referral code is required", 400);

  const { data: referral } = await admin
    .from("referrals").select("id, referrer_id").eq("code", code).maybeSingle();

  if (!referral) return err("Invalid referral code. Please check and try again.", 404);
  if (referral.referrer_id === user.id) return err("You cannot use your own referral code.", 400);

  const { data: alreadyUsed } = await admin
    .from("referral_uses").select("id").eq("referred_id", user.id).maybeSingle();

  if (alreadyUsed) return err("You have already used a referral code.", 400);

  const { error } = await admin.from("referral_uses").insert({ referral_id: referral.id, referred_id: user.id });
  if (error) return err(error.message, 500);

  return ok({ message: "Referral code applied successfully!" });
}

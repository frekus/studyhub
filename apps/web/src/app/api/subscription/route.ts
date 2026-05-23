import { createClient, requireUser } from "@/lib/supabase/server";
import { createAdminClient } from "@studyhub/database";
import { ok, err } from "@/lib/response";
import { PLANS } from "@/lib/plans";
import type { PlanTier } from "@/lib/plans";

const FEATURES = ["notes", "ai_summaries", "flashcards", "exam_predictions"] as const;

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export async function GET() {
  const supabase = await createClient();
  const { user, authErr } = await requireUser(supabase);
  if (authErr) return authErr;

  const admin = createAdminClient();
  const month = currentMonth();

  const [userRes, usageRes] = await Promise.all([
    admin
      .from("users")
      .select("subscription_tier, subscription_status, subscription_expires_at")
      .eq("id", user.id)
      .maybeSingle(),
    admin
      .from("usage_tracking")
      .select("feature, count")
      .eq("user_id", user.id)
      .eq("month", month),
  ]);

  if (userRes.error) return err(userRes.error.message, 500);

  const tier = ((userRes.data?.subscription_tier as string | null) ?? "free") as PlanTier;
  const plan = PLANS[tier] ?? PLANS.free;

  const usageMap = Object.fromEntries(
    (usageRes.data ?? []).map((row) => [row.feature, row.count as number]),
  );

  const usage = Object.fromEntries(
    FEATURES.map((feature) => {
      const limit = plan.limits[feature] as number;
      const used  = usageMap[feature] ?? 0;
      return [feature, { used, limit }];
    }),
  );

  return ok({
    tier,
    status:     userRes.data?.subscription_status ?? null,
    expires_at: userRes.data?.subscription_expires_at ?? null,
    usage,
  });
}

import { PLANS } from "./plans";
import type { PlanTier } from "./plans";

type UsageFeature = "ai_summaries" | "flashcards" | "exam_predictions" | "notes";

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function checkLimit(
  userId: string,
  feature: UsageFeature,
  supabase: any,
): Promise<{ allowed: boolean; limit: number; used: number; tier: string }> {
  const { data: userRow } = await supabase
    .from("users")
    .select("subscription_tier")
    .eq("id", userId)
    .maybeSingle();

  const tier = ((userRow?.subscription_tier as string | null) ?? "free") as PlanTier;
  const plan = PLANS[tier] ?? PLANS.free;
  const limit = plan.limits[feature] as number;

  if (limit === -1) return { allowed: true, limit: -1, used: 0, tier };
  if (limit === 0)  return { allowed: false, limit: 0, used: 0, tier };

  const month = currentMonth();
  const { data: usageRow } = await supabase
    .from("usage_tracking")
    .select("count")
    .eq("user_id", userId)
    .eq("feature", feature)
    .eq("month", month)
    .maybeSingle();

  const used: number = (usageRow?.count as number | null) ?? 0;
  return { allowed: used < limit, limit, used, tier };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function incrementUsage(
  userId: string,
  feature: string,
  supabase: any,
): Promise<void> {
  const month = currentMonth();
  try {
    const { data: existing } = await supabase
      .from("usage_tracking")
      .select("count")
      .eq("user_id", userId)
      .eq("feature", feature)
      .eq("month", month)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("usage_tracking")
        .update({ count: (existing.count as number) + 1 })
        .eq("user_id", userId)
        .eq("feature", feature)
        .eq("month", month);
    } else {
      await supabase
        .from("usage_tracking")
        .insert({ user_id: userId, feature, month, count: 1 });
    }
  } catch {
    // Non-fatal — usage tracking should not block the main operation
  }
}

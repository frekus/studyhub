import { createClient, requireUser } from "@/lib/supabase/server";
import { createAdminClient } from "@studyhub/database";
import { ok, err } from "@/lib/response";
import { requireAdmin } from "@/lib/admin";
import { z } from "zod";

const BulkSchema = z.object({
  action: z.enum(["upgrade_popular", "upgrade_pro", "downgrade_free", "suspend", "delete", "reset_password"]),
  userIds: z.array(z.string().uuid()).min(1).max(100),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const { user, authErr } = await requireUser(supabase);
  if (authErr) return authErr;

  const admin = createAdminClient();
  try { await requireAdmin(admin, user.id); } catch { return err("Forbidden", 403); }

  let body: unknown;
  try { body = await request.json(); } catch { return err("Invalid JSON", 400); }

  const parsed = BulkSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Invalid input", 400);

  const { action, userIds } = parsed.data;
  let successCount = 0;
  let failedCount  = 0;
  const errors: string[] = [];

  for (const uid of userIds) {
    try {
      switch (action) {
        case "upgrade_popular":
          await admin.from("users").update({ subscription_tier: "popular", subscription_status: "active" }).eq("id", uid);
          break;
        case "upgrade_pro":
          await admin.from("users").update({ subscription_tier: "pro", subscription_status: "active" }).eq("id", uid);
          break;
        case "downgrade_free":
          await admin.from("users").update({ subscription_tier: "free", subscription_status: "active" }).eq("id", uid);
          break;
        case "suspend":
          await admin.from("users").update({ subscription_status: "suspended" }).eq("id", uid);
          await admin.auth.admin.updateUserById(uid, { ban_duration: "876600h" });
          break;
        case "delete":
          await admin.auth.admin.deleteUser(uid);
          break;
        case "reset_password": {
          const { data: authUser } = await admin.auth.admin.getUserById(uid);
          if (authUser.user?.email) {
            await admin.auth.admin.generateLink({ type: "recovery", email: authUser.user.email });
          }
          break;
        }
      }
      successCount++;
    } catch (e) {
      failedCount++;
      errors.push(`${uid}: ${(e as Error).message}`);
    }
  }

  return ok({ success: successCount, failed: failedCount, errors });
}

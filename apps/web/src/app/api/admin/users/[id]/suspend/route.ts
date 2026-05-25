import { createClient, requireUser } from "@/lib/supabase/server";
import { createAdminClient } from "@studyhub/database";
import { ok, err } from "@/lib/response";
import { requireAdmin } from "@/lib/admin";

type Params = Promise<{ id: string }>;

export async function POST(_request: Request, { params }: { params: Params }) {
  const { id } = await params;
  const supabase = await createClient();
  const { user, authErr } = await requireUser(supabase);
  if (authErr) return authErr;

  const admin = createAdminClient();
  try { await requireAdmin(admin, user.id); } catch { return err("Forbidden", 403); }

  const [dbResult, authResult] = await Promise.all([
    admin.from("users").update({ subscription_status: "suspended" }).eq("id", id),
    admin.auth.admin.updateUserById(id, { ban_duration: "876600h" }),
  ]);

  if (dbResult.error) return err(dbResult.error.message, 500);
  if (authResult.error) return err(authResult.error.message, 500);

  return ok({ success: true });
}

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

  // Get email from auth, not public.users
  const { data: authUser, error: authErr2 } = await admin.auth.admin.getUserById(id);
  if (authErr2 || !authUser.user?.email) return err("User not found or no email", 404);

  const { data, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email: authUser.user.email,
  });

  if (error) return err(error.message, 500);
  return ok({ success: true, link: data.properties?.action_link ?? null });
}

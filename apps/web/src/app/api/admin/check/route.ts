import { createClient, requireUser } from "@/lib/supabase/server";
import { createAdminClient } from "@studyhub/database";
import { ok } from "@/lib/response";

export async function GET() {
  const supabase = await createClient();
  const { user, authErr } = await requireUser(supabase);
  if (authErr) return ok({ isAdmin: false });

  const admin = createAdminClient();
  // admin_role / is_admin are not yet in generated types — cast via any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (admin as any)
    .from("users")
    .select("is_admin, admin_role, admin_expires_at")
    .eq("id", user.id)
    .maybeSingle();

  const d = data as {
    is_admin: boolean;
    admin_role: string | null;
    admin_expires_at: string | null;
  } | null;

  if (!d?.is_admin) return ok({ isAdmin: false, role: null });

  const isExpired = d.admin_expires_at
    ? new Date(d.admin_expires_at) < new Date()
    : false;

  if (isExpired) return ok({ isAdmin: false, role: null });

  return ok({ isAdmin: true, role: d.admin_role ?? "admin" });
}

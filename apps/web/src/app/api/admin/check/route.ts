import { createClient, requireUser } from "@/lib/supabase/server";
import { createAdminClient } from "@studyhub/database";
import { ok } from "@/lib/response";

export async function GET() {
  const supabase = await createClient();
  const { user, authErr } = await requireUser(supabase);
  if (authErr) return ok({ isAdmin: false });

  const admin = createAdminClient();
  // admin_users is not in generated types — cast via rpc workaround
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (admin as any)
    .from("admin_users")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  return ok({ isAdmin: !!data, role: (data as { role: string } | null)?.role ?? null });
}

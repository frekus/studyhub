import { createClient, requireUser } from "@/lib/supabase/server";
import { createAdminClient } from "@studyhub/database";
import { ok } from "@/lib/response";

export async function GET() {
  const supabase = await createClient();
  const { user, authErr } = await requireUser(supabase);
  if (authErr) return ok({ isAdmin: false });

  try {
    const admin = createAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (admin as any)
      .from("admin_users")
      .select("role, expires_at")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!data) return ok({ isAdmin: false });

    const isExpired = data.expires_at
      ? new Date(data.expires_at as string) < new Date()
      : false;

    if (isExpired) return ok({ isAdmin: false });

    return ok({ isAdmin: true, role: (data.role as string) ?? "admin" });
  } catch {
    return ok({ isAdmin: false });
  }
}

import { createClient, requireUser } from "@/lib/supabase/server";
import { createAdminClient } from "@studyhub/database";
import { requireAdmin } from "@/lib/admin";
import { ok, err } from "@/lib/response";
import { z } from "zod";

type Params = Promise<{ id: string }>;

const RoleSchema = z.object({
  is_admin: z.boolean(),
  role: z.enum(["admin", "super_admin", "moderator", "support_agent"]).optional(),
  privileges: z.record(z.string(), z.boolean()).optional().nullable(),
  expires_at: z.string().optional().nullable(),
});

export async function PATCH(request: Request, { params }: { params: Params }) {
  const { id: targetId } = await params;
  const supabase = await createClient();
  const { user, authErr } = await requireUser(supabase);
  if (authErr) return authErr;

  const admin = createAdminClient();
  let adminInfo: Awaited<ReturnType<typeof requireAdmin>>;
  try {
    adminInfo = await requireAdmin(admin, user.id);
  } catch (e) {
    return err((e as Error).message, 403);
  }

  if (adminInfo.role !== "super_admin") {
    return err("Only super admins can manage admin access", 403);
  }

  if (targetId === user.id) {
    return err("Cannot modify your own admin access this way", 400);
  }

  const body = await request.json().catch(() => null);
  const parsed = RoleSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Invalid body", 400);

  const { is_admin, role, privileges, expires_at } = parsed.data;

  if (is_admin) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: upsertErr } = await (admin as any)
      .from("admin_users")
      .upsert(
        {
          user_id: targetId,
          role: role ?? "admin",
          privileges: privileges ?? null,
          expires_at: expires_at ?? null,
          granted_by: user.id,
        },
        { onConflict: "user_id" },
      );
    if (upsertErr) return err(upsertErr.message, 500);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: userErr } = await (admin as any)
      .from("users")
      .update({ is_admin: true, admin_expires_at: expires_at ?? null })
      .eq("id", targetId);
    if (userErr) return err(userErr.message, 500);
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: delErr } = await (admin as any)
      .from("admin_users")
      .delete()
      .eq("user_id", targetId);
    if (delErr) return err(delErr.message, 500);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: userErr } = await (admin as any)
      .from("users")
      .update({ is_admin: false, admin_expires_at: null })
      .eq("id", targetId);
    if (userErr) return err(userErr.message, 500);
  }

  return ok({ message: is_admin ? "Admin access granted" : "Admin access revoked" });
}

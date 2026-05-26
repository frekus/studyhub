import { createClient, requireUser } from "@/lib/supabase/server";
import { createAdminClient } from "@studyhub/database";
import { requireAdmin } from "@/lib/admin";
import { ok, err } from "@/lib/response";
import { z } from "zod";

type Params = Promise<{ userId: string }>;

const UpdateSchema = z.object({
  role:       z.enum(["admin", "super_admin", "moderator", "support_agent"]).optional(),
  privileges: z.record(z.string(), z.boolean()).optional().nullable(),
  expires_at: z.string().optional().nullable(),
});

export async function PATCH(request: Request, { params }: { params: Params }) {
  const { userId: targetUserId } = await params;
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
    return err("Only super admins can modify admin privileges", 403);
  }

  const body = await request.json().catch(() => null);
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Invalid body", 400);

  const update: Record<string, unknown> = {};
  if (parsed.data.role !== undefined)       update.admin_role       = parsed.data.role;
  if (parsed.data.privileges !== undefined) update.admin_privileges = parsed.data.privileges;
  if (parsed.data.expires_at !== undefined) update.admin_expires_at = parsed.data.expires_at;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any)
    .from("users")
    .update(update)
    .eq("id", targetUserId);

  if (error) return err(error.message, 500);

  return ok({ message: "Admin updated" });
}

export async function DELETE(_request: Request, { params }: { params: Params }) {
  const { userId: targetUserId } = await params;
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
    return err("Only super admins can revoke admin privileges", 403);
  }

  if (targetUserId === user.id) {
    return err("Cannot revoke your own admin access", 400);
  }

  // Prevent removing another super_admin
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: target } = await (admin as any)
    .from("users")
    .select("admin_role")
    .eq("id", targetUserId)
    .maybeSingle();

  if ((target as { admin_role: string } | null)?.admin_role === "super_admin") {
    return err("Cannot revoke super admin access", 403);
  }

  // Clear all admin columns — keep the row, just revoke access
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any)
    .from("users")
    .update({ is_admin: false, admin_role: null, admin_privileges: null, admin_expires_at: null })
    .eq("id", targetUserId);

  if (error) return err(error.message, 500);

  return ok({ message: "Admin access revoked" });
}

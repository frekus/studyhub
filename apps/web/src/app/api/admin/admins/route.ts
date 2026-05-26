import { createClient, requireUser } from "@/lib/supabase/server";
import { createAdminClient } from "@studyhub/database";
import { requireAdmin } from "@/lib/admin";
import { ok, err } from "@/lib/response";
import { z } from "zod";

const GrantSchema = z.object({
  user_id: z.string().uuid(),
  role: z.enum(["admin", "super_admin", "moderator", "support_agent"]).default("admin"),
  privileges: z.record(z.string(), z.boolean()).optional().nullable(),
  expires_at: z.string().optional().nullable(),
});

export async function GET() {
  const supabase = await createClient();
  const { user, authErr } = await requireUser(supabase);
  if (authErr) return authErr;

  const admin = createAdminClient();
  try {
    await requireAdmin(admin, user.id);
  } catch (e) {
    return err((e as Error).message, 403);
  }

  // Query users table for all admins (profiles approach — no admin_users table)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: adminRows, error } = await (admin as any)
    .from("users")
    .select("id, admin_role, admin_privileges, admin_expires_at, created_at")
    .eq("is_admin", true)
    .order("created_at", { ascending: false });

  if (error) return err(error.message, 500);

  // Resolve emails via auth API
  const { data: authList } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const emailMap = new Map(authList.users.map((u) => [u.id, u.email ?? ""]));

  const result = (adminRows as Record<string, unknown>[]).map((row) => ({
    id:              row.id,
    user_id:         row.id,
    email:           emailMap.get(row.id as string) ?? "—",
    role:            (row.admin_role as string | null) ?? "admin",
    privileges:      (row.admin_privileges as Record<string, boolean> | null) ?? null,
    expires_at:      (row.admin_expires_at as string | null) ?? null,
    notes:           null,
    granted_by_email: null,
    created_at:      row.created_at as string,
  }));

  return ok({ admins: result });
}

export async function POST(request: Request) {
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
    return err("Only super admins can grant admin privileges", 403);
  }

  const body = await request.json().catch(() => null);
  const parsed = GrantSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Invalid body", 400);

  const { user_id, role, privileges, expires_at } = parsed.data;

  if (user_id === user.id) return err("Cannot grant admin to yourself this way", 400);

  // Verify target user exists in auth
  const { data: targetUser } = await admin.auth.admin.getUserById(user_id);
  if (!targetUser?.user) return err("User not found", 404);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any)
    .from("users")
    .update({
      is_admin:         true,
      admin_role:       role,
      admin_privileges: privileges ?? null,
      admin_expires_at: expires_at ?? null,
    })
    .eq("id", user_id);

  if (error) return err(error.message, 500);

  return ok({ message: "Admin access granted" });
}

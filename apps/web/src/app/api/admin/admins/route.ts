import { createClient, requireUser } from "@/lib/supabase/server";
import { createAdminClient } from "@studyhub/database";
import { requireAdmin } from "@/lib/admin";
import { ok, err } from "@/lib/response";
import { z } from "zod";

const GrantSchema = z.object({
  user_id: z.string().uuid(),
  role: z.enum(["admin", "super_admin"]).default("admin"),
  privileges: z.record(z.string(), z.boolean()).optional(),
  expires_at: z.string().optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: admins, error } = await (admin as any)
    .from("admin_users")
    .select("id, user_id, role, privileges, expires_at, notes, granted_by, created_at")
    .order("created_at", { ascending: false });

  if (error) return err(error.message, 500);

  // Resolve emails via auth API
  const { data: authList } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const emailMap = new Map(authList.users.map((u) => [u.id, u.email ?? ""]));

  const result = (admins as Record<string, unknown>[]).map((a) => ({
    ...a,
    email: emailMap.get(a.user_id as string) ?? "—",
    granted_by_email: a.granted_by ? (emailMap.get(a.granted_by as string) ?? "—") : null,
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

  const { user_id, role, privileges, expires_at, notes } = parsed.data;

  if (user_id === user.id) return err("Cannot grant admin to yourself this way", 400);

  // Verify target user exists
  const { data: targetUser } = await admin.auth.admin.getUserById(user_id);
  if (!targetUser?.user) return err("User not found", 404);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any)
    .from("admin_users")
    .upsert(
      {
        user_id,
        role,
        privileges: privileges ?? null,
        expires_at: expires_at ?? null,
        notes: notes ?? null,
        granted_by: user.id,
      },
      { onConflict: "user_id" },
    );

  if (error) return err(error.message, 500);

  return ok({ message: "Admin access granted" });
}

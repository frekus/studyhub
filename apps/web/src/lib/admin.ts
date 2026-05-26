// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function requireAdmin(supabase: any, userId: string) {
  // admin_role / admin_privileges / admin_expires_at are new columns not yet
  // in the generated types, so we cast through any.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("users")
    .select("is_admin, admin_role, admin_privileges, admin_expires_at")
    .eq("id", userId)
    .single();

  if (error || !data) {
    throw new Error("Unauthorized: Admin access required");
  }

  const d = data as {
    is_admin: boolean;
    admin_role: string | null;
    admin_privileges: Record<string, boolean> | null;
    admin_expires_at: string | null;
  };

  if (!d.is_admin) {
    throw new Error("Unauthorized: Admin access required");
  }

  if (d.admin_expires_at && new Date(d.admin_expires_at) < new Date()) {
    throw new Error("Admin access has expired");
  }

  return {
    role: d.admin_role ?? "admin",
    privileges: d.admin_privileges ?? {},
    expiresAt: d.admin_expires_at,
  };
}

export function checkPrivilege(
  privileges: Record<string, boolean> | null | undefined,
  required: string,
): boolean {
  if (!privileges) return false;
  if (privileges.full_access) return true;
  return privileges[required] === true;
}

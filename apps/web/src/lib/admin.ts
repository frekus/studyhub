// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function requireAdmin(supabase: any, userId: string) {
  // admin_users table is not in generated types, cast via any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("admin_users")
    .select("role, privileges, expires_at")
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    throw new Error("Unauthorized: Admin access required");
  }

  const d = data as {
    role: string;
    privileges: Record<string, boolean> | null;
    expires_at: string | null;
  };

  if (d.expires_at && new Date(d.expires_at) < new Date()) {
    throw new Error("Admin access has expired");
  }

  return { role: d.role, privileges: d.privileges ?? {}, expiresAt: d.expires_at };
}

export function checkPrivilege(
  privileges: Record<string, boolean> | null | undefined,
  required: string,
): boolean {
  if (!privileges) return false;
  if (privileges.full_access) return true;
  return privileges[required] === true;
}

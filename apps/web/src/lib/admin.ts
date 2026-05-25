// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function requireAdmin(supabase: any, userId: string): Promise<string> {
  // admin_users table is not in generated types, cast via any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("admin_users")
    .select("role")
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    throw new Error("Unauthorized: Admin access required");
  }
  return (data as { role: string }).role;
}

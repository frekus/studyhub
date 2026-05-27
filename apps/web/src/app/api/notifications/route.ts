import { createClient, requireUser } from "@/lib/supabase/server";
import { ok, err } from "@/lib/response";

function computeActionUrl(type: string, groupId: string | null, noteId: string | null): string {
  if (!groupId) return "/dashboard";
  switch (type) {
    case "mention":
      return `/dashboard/groups/${groupId}?tab=shared${noteId ? `&highlight=${noteId}` : ""}`;
    case "group_note":
      return `/dashboard/groups/${groupId}?tab=group-notes`;
    case "session_started":
      return `/dashboard/groups/${groupId}?tab=live`;
    default:
      return `/dashboard/groups/${groupId}`;
  }
}

export async function GET() {
  const supabase = await createClient();
  const { user, authErr } = await requireUser(supabase);
  if (authErr) return authErr;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: notifications, error } = await (supabase as any)
    .from("group_notifications")
    .select("id, type, message, is_read, created_at, group_id, note_id, from_user:users!from_user_id(full_name)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) return err(error.message, 500);

  const rows = (notifications ?? []).map((n: {
    id: string; type: string; message: string; is_read: boolean;
    created_at: string; group_id: string | null; note_id: string | null;
    from_user: { full_name: string | null } | null;
  }) => ({
    ...n,
    action_url: computeActionUrl(n.type, n.group_id, n.note_id),
  }));

  const unread_count = rows.filter((n: { is_read: boolean }) => !n.is_read).length;

  return ok({ notifications: rows, unread_count });
}

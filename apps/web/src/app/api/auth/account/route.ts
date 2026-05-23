import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@studyhub/database";
import { ok, err } from "@/lib/response";

export async function DELETE() {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return err("Unauthorized", 401);

  // Delete from Supabase Auth using the service-role admin client.
  // The public.users row and all child rows cascade automatically.
  const admin = createAdminClient();
  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) return err(deleteError.message, 500);

  // Sign out the current session
  await supabase.auth.signOut();

  return ok({ success: true });
}

import { createClient, requireUser } from "@/lib/supabase/server";
import { createAdminClient } from "@studyhub/database";
import { ok, err } from "@/lib/response";

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { user, authErr } = await requireUser(supabase);
  if (authErr) return authErr;

  const admin = createAdminClient();

  try {
    // Delete all user data in correct order (respecting foreign keys)
    await admin.from("ai_messages").delete().eq("user_id", user.id);
    await admin.from("ai_conversations").delete().eq("user_id", user.id);
    await admin.from("flashcard_performance").delete().eq("user_id", user.id);
    await admin.from("flashcards").delete().eq("user_id", user.id);
    await admin.from("note_versions").delete().eq("user_id", user.id);
    await admin.from("study_notes").delete().eq("user_id", user.id);
    await admin.from("note_folders").delete().eq("user_id", user.id);
    await admin.from("study_streaks").delete().eq("user_id", user.id);
    await admin.from("study_activity").delete().eq("user_id", user.id);
    await admin.from("study_plans").delete().eq("user_id", user.id);
    await admin.from("study_plan_days").delete().eq("user_id", user.id);
    await admin.from("student_profiles").delete().eq("user_id", user.id);
    await admin.from("reminders").delete().eq("user_id", user.id);
    await admin.from("study_group_members").delete().eq("user_id", user.id);
    await admin.from("subscriptions").delete().eq("user_id", user.id);
    await admin.from("users").delete().eq("id", user.id);

    // Delete auth user last
    await admin.auth.admin.deleteUser(user.id);

    return ok({ message: "Account deleted successfully" });
  } catch (e) {
    console.error("[account/delete] Error:", e);
    return err("Failed to delete account. Please contact support.", 500);
  }
}

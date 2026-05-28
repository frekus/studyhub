import { createClient, requireUser } from "@/lib/supabase/server";
import { ok, err } from "@/lib/response";
import { getOrBuildProfile, forceRebuildProfile } from "@/lib/student-profile";

export async function GET() {
  const supabase = await createClient();
  const { user, authErr } = await requireUser(supabase);
  if (authErr) return authErr;

  try {
    const profile = await getOrBuildProfile(user.id);
    return ok({ profile });
  } catch {
    return err("Failed to load profile", 500);
  }
}

export async function POST() {
  const supabase = await createClient();
  const { user, authErr } = await requireUser(supabase);
  if (authErr) return authErr;

  try {
    const profile = await forceRebuildProfile(user.id);
    return ok({ profile });
  } catch {
    return err("Failed to rebuild profile", 500);
  }
}

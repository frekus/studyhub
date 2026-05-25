import { createClient, requireUser } from "@/lib/supabase/server";
import { createAdminClient } from "@studyhub/database";
import { ok, err } from "@/lib/response";
import { tryPublishGroupExamPredict } from "@/lib/queue";

type Params = Promise<{ id: string }>;

export async function GET(_request: Request, { params }: { params: Params }) {
  const { id } = await params;
  const supabase = await createClient();
  const { user, authErr } = await requireUser(supabase);
  if (authErr) return authErr;

  const admin = createAdminClient();
  const { data: membership } = await admin
    .from("study_group_members").select("id")
    .eq("group_id", id).eq("user_id", user.id).maybeSingle();
  if (!membership) return err("Access denied", 403);

  const [{ data: uploads }, { data: prediction }] = await Promise.all([
    admin.from("group_exam_uploads").select("id, title, uploaded_by, created_at")
      .eq("group_id", id).order("created_at", { ascending: false }),
    admin.from("group_predictions").select("*")
      .eq("group_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  // Resolve uploader names
  const uploaderIds = [...new Set((uploads ?? []).map((u) => u.uploaded_by))];
  let nameMap: Record<string, string> = {};
  if (uploaderIds.length > 0) {
    const { data: profiles } = await admin.from("users").select("id, full_name").in("id", uploaderIds);
    nameMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p.full_name ?? "Unknown"]));
  }

  return ok({
    uploads: (uploads ?? []).map((u) => ({ ...u, uploader_name: nameMap[u.uploaded_by] ?? "Unknown" })),
    prediction: prediction ?? null,
  });
}

export async function POST(request: Request, { params }: { params: Params }) {
  const { id } = await params;
  const supabase = await createClient();
  const { user, authErr } = await requireUser(supabase);
  if (authErr) return authErr;

  const admin = createAdminClient();

  // Check member + get uploads
  const [{ data: membership }, { data: uploads }] = await Promise.all([
    admin.from("study_group_members").select("id")
      .eq("group_id", id).eq("user_id", user.id).maybeSingle(),
    admin.from("group_exam_uploads").select("content, uploaded_by")
      .eq("group_id", id),
  ]);

  if (!membership) return err("Access denied", 403);
  if (!uploads || uploads.length < 2) return err("Need at least 2 exam papers to generate group predictions", 400);

  const combinedContent = uploads.map((u, i) => `--- Paper ${i + 1} ---\n${u.content}`).join("\n\n");
  const membersCount = new Set(uploads.map((u) => u.uploaded_by)).size;

  const { data: prediction, error } = await admin.from("group_predictions")
    .insert({ group_id: id, papers_count: uploads.length, members_count: membersCount, status: "pending" })
    .select().single();

  if (error) return err(error.message, 500);

  void tryPublishGroupExamPredict({
    predictionId: prediction.id, groupId: id,
    combinedContent, papersCount: uploads.length, membersCount,
  });

  return ok({ predictionId: prediction.id, status: "pending" }, 202);
}

import Anthropic from "@anthropic-ai/sdk";
import { createClient, requireUser } from "@/lib/supabase/server";
import { createAdminClient } from "@studyhub/database";
import { ok, err } from "@/lib/response";

export const maxDuration = 60;

type Params = Promise<{ id: string }>;

const SUPPORTED = new Set([".txt", ".pdf", ".png", ".jpg", ".jpeg"]);
const MAX_SIZE  = 10 * 1024 * 1024;

function ext(name: string) { const i = name.lastIndexOf("."); return i >= 0 ? name.slice(i).toLowerCase() : ""; }

async function extractText(file: File): Promise<string> {
  const e = ext(file.name);
  const buf = Buffer.from(await file.arrayBuffer());

  if (e === ".txt") return buf.toString("utf-8");

  if (e === ".pdf") {
    // Fast local extraction using pdf-parse (no worker, no network, no timeout)
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require("pdf-parse");
      const data = await pdfParse(buf, { max: 0 });
      const text = (data.text ?? "").replace(/\s+/g, " ").trim();
      // If text extracted successfully, return it
      if (text.length >= 30) return text;
    } catch { /* fall through to vision */ }

    // Fallback: scanned PDF — use Anthropic vision on first page
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const res = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001", max_tokens: 2000,
      messages: [{ role: "user", content: [
        { type: "image", source: { type: "base64", media_type: "image/jpeg", data: buf.toString("base64") } },
        { type: "text",  text: "Extract all text from this exam paper. Return only the text." },
      ]}],
    });
    const block = res.content[0];
    return block.type === "text" ? block.text : "";
  }

  // Image files — use Anthropic vision
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const mt: "image/png" | "image/jpeg" = e === ".png" ? "image/png" : "image/jpeg";
  const res = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001", max_tokens: 2000,
    messages: [{ role: "user", content: [
      { type: "image", source: { type: "base64", media_type: mt, data: buf.toString("base64") } },
      { type: "text",  text: "Extract all text from this exam paper. Return only the text." },
    ]}],
  });
  const block = res.content[0];
  return block.type === "text" ? block.text : "";
}

export async function POST(request: Request, { params }: { params: Params }) {
  const { id } = await params;
  const supabase = await createClient();
  const { user, authErr } = await requireUser(supabase);
  if (authErr) return authErr;

  const admin = createAdminClient();
  const { data: membership } = await admin
    .from("study_group_members").select("id").eq("group_id", id).eq("user_id", user.id).maybeSingle();
  if (!membership) return err("Access denied", 403);

  let formData: FormData;
  try { formData = await request.formData(); } catch { return err("Invalid form data", 400); }

  const title = formData.get("title");
  const file  = formData.get("file");
  if (typeof title !== "string" || !title.trim()) return err("title is required", 400);
  if (!(file instanceof File)) return err("file is required", 400);
  if (!SUPPORTED.has(ext(file.name))) return err("Unsupported file type", 400);
  if (file.size > MAX_SIZE) return err("File exceeds 10 MB limit", 400);

  console.log("[group-exams] Starting text extraction for:", file.name, "size:", file.size);
  const t0 = Date.now();
  let content: string;
  try {
    content = await extractText(file);
    console.log("[group-exams] Extraction OK — chars:", content.length, "ms:", Date.now() - t0);
  } catch (e) {
    console.error("[group-exams] Extraction failed after", Date.now() - t0, "ms:", e);
    return err("Failed to extract text", 422);
  }
  if (!content.trim()) return err("Could not extract text from file", 400);

  console.log("[group-exams] Inserting to DB");
  const { data: upload, error } = await admin
    .from("group_exam_uploads")
    .insert({ group_id: id, uploaded_by: user.id, title: title.trim(), content })
    .select().single();
  if (error) {
    console.error("[group-exams] DB insert failed:", error);
    return err(error.message, 500);
  }

  return ok({ upload }, 201);
}

import Anthropic from "@anthropic-ai/sdk";
import { createClient, requireUser } from "@/lib/supabase/server";
import { ok, err } from "@/lib/response";
import { cacheKeys, tryGet, trySet, tryDel, EXAM_TTL } from "@/lib/cache";
import { tryPublishExamPredict } from "@/lib/queue";
import { checkLimit, incrementUsage } from "@/lib/usage";
import { recordStudyActivity } from "@/lib/streaks";
import type { ExamUploadRow } from "@studyhub/database";

// App Router equivalent of { api: { bodyParser: false } } — not needed here
// because request.formData() bypasses Next.js's built-in JSON body parser.
// maxDuration raises the Vercel function timeout above the 10 s default.
export const maxDuration = 60;

const SUPPORTED_EXTENSIONS = new Set([".txt", ".pdf", ".png", ".jpg", ".jpeg"]);
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

function fileExtension(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i).toLowerCase() : "";
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  // Dynamic import keeps pdf2json out of the Next.js bundle (serverExternalPackages handles the rest)
  const { default: PDFParser } = await import("pdf2json");
  return new Promise((resolve, reject) => {
    const parser = new PDFParser();
    parser.on("pdfParser_dataReady", (data) => {
      const text = data.Pages
        .flatMap((p) => p.Texts)
        .map((t) => decodeURIComponent(t.R[0]?.T ?? ""))
        .join(" ");
      resolve(text);
    });
    parser.on("pdfParser_dataError", (errMsg) => {
      reject(errMsg instanceof Error ? errMsg : errMsg.parserError);
    });
    parser.parseBuffer(buffer);
  });
}

async function extractImageText(buffer: Buffer, ext: string): Promise<string> {
  const base64 = buffer.toString("base64");
  const mediaType: "image/png" | "image/jpeg" = ext === ".png" ? "image/png" : "image/jpeg";

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2000,
    messages: [{
      role: "user",
      content: [
        {
          type: "image",
          source: { type: "base64", media_type: mediaType, data: base64 },
        },
        {
          type: "text",
          text: "Extract all text from this exam paper image. Return only the extracted text, no commentary.",
        },
      ],
    }],
  });

  const block = response.content[0];
  return block.type === "text" ? block.text : "";
}

async function extractText(file: File): Promise<string> {
  const ext = fileExtension(file.name);
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (ext === ".txt") {
    return buffer.toString("utf-8");
  }

  if (ext === ".pdf") {
    return extractPdfText(buffer);
  }

  // .png / .jpg / .jpeg
  return extractImageText(buffer, ext);
}

export async function POST(request: Request) {
  console.log("Upload started");

  const supabase = await createClient();
  const { user, authErr } = await requireUser(supabase);
  if (authErr) return authErr;

  console.log("User:", user.id);

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch (e) {
    console.error("[exams] formData parse failed:", e);
    return err("Invalid form data", 400);
  }

  const title = formData.get("title");
  const file  = formData.get("file");

  if (typeof title !== "string" || title.trim().length === 0) {
    return err("title is required", 400);
  }
  if (!(file instanceof File)) {
    console.error("[exams] No file in formData — keys:", [...formData.keys()]);
    return err("file is required", 400);
  }

  const ext = fileExtension(file.name);
  console.log("File received:", file.name, file.size, "— ext:", ext);

  if (!SUPPORTED_EXTENSIONS.has(ext)) {
    return err("Unsupported file type. Allowed: .txt, .pdf, .png, .jpg, .jpeg", 400);
  }
  if (file.size > MAX_FILE_SIZE) {
    return err("File exceeds 10 MB limit", 400);
  }

  const limitCheck = await checkLimit(user.id, "exam_predictions", supabase);
  console.log("[exams] Limit check:", limitCheck);
  if (!limitCheck.allowed) {
    return err("Upgrade to Pro to unlock exam predictions.", 403);
  }

  console.log("[exams] Starting text extraction for ext:", ext);
  const t0 = Date.now();
  let content: string;
  try {
    content = await extractText(file);
    console.log("[exams] Text extraction OK — chars:", content.length, "ms:", Date.now() - t0);
  } catch (e) {
    console.error("[exams] Text extraction failed after", Date.now() - t0, "ms:", e);
    return err("Failed to extract text from file", 422);
  }

  if (!content || content.trim().length === 0) {
    console.warn("[exams] Extraction produced empty content");
    return err("Could not extract text from file", 400);
  }

  console.log("[exams] Inserting exam to DB");
  const { data: exam, error } = await supabase
    .from("exam_uploads")
    .insert({ user_id: user.id, title: title.trim(), status: "pending", content })
    .select()
    .single();

  console.log("Supabase upload result:", exam, error);

  if (error) {
    return err(error.message, 500);
  }

  void incrementUsage(user.id, "exam_predictions", supabase);
  await tryDel(cacheKeys.examsList(user.id));

  void recordStudyActivity(user.id, "exam_uploaded", supabase).catch(console.error);

  void tryPublishExamPredict({
    examId: exam.id,
    userId: user.id,
    title: exam.title,
    content,
  });

  return ok({ exam }, 201);
}

export async function GET() {
  const supabase = await createClient();
  const { user, authErr } = await requireUser(supabase);
  if (authErr) return authErr;

  const listKey = cacheKeys.examsList(user.id);

  const cached = await tryGet<{ exams: ExamUploadRow[] }>(listKey);
  if (cached) {
    const response = ok(cached);
    response.headers.set("X-Cache", "HIT");
    return response;
  }

  const { data: exams, error } = await supabase
    .from("exam_uploads")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return err(error.message, 500);

  await trySet(listKey, { exams }, EXAM_TTL);

  const response = ok({ exams });
  response.headers.set("X-Cache", "MISS");
  return response;
}

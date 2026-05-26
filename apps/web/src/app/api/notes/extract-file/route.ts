import Anthropic from "@anthropic-ai/sdk";
import { createClient, requireUser } from "@/lib/supabase/server";
import { ok, err } from "@/lib/response";

export const maxDuration = 60;

const SUPPORTED_EXTENSIONS = new Set([".txt", ".pdf", ".png", ".jpg", ".jpeg"]);
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

function fileExtension(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i).toLowerCase() : "";
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  const { default: PDFParser } = await import("pdf2json");
  return new Promise((resolve, reject) => {
    const parser = new PDFParser();
    parser.on("pdfParser_dataReady", (data: { Pages: { Texts: { R: { T: string }[] }[] }[] }) => {
      const text = data.Pages
        .flatMap((p) => p.Texts)
        .map((t) => decodeURIComponent(t.R[0]?.T ?? ""))
        .join(" ");
      resolve(text);
    });
    parser.on("pdfParser_dataError", (errMsg: unknown) => {
      reject(errMsg instanceof Error ? errMsg : new Error(String(errMsg)));
    });
    parser.parseBuffer(buffer);
  });
}

async function extractImageText(buffer: Buffer, ext: string): Promise<string> {
  const base64 = buffer.toString("base64");
  const mediaType: "image/png" | "image/jpeg" = ext === ".png" ? "image/png" : "image/jpeg";

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const response = await anthropic.messages.create({
    model:      "claude-haiku-4-5-20251001",
    max_tokens: 3000,
    messages: [{
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
        { type: "text", text: "Extract all text from this document image. Return only the extracted text, no commentary." },
      ],
    }],
  });

  const block = response.content[0];
  return block.type === "text" ? block.text : "";
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { authErr } = await requireUser(supabase);
  if (authErr) return authErr;

  let formData: FormData;
  try { formData = await request.formData(); } catch { return err("Invalid form data", 400); }

  const file = formData.get("file");
  if (!(file instanceof File)) return err("file is required", 400);

  const ext = fileExtension(file.name);
  if (!SUPPORTED_EXTENSIONS.has(ext)) {
    return err("Unsupported file type. Allowed: .txt, .pdf, .png, .jpg, .jpeg", 400);
  }
  if (file.size > MAX_FILE_SIZE) return err("File exceeds 10 MB limit", 400);

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  let content: string;
  try {
    if (ext === ".txt") {
      content = buffer.toString("utf-8");
    } else if (ext === ".pdf") {
      content = await extractPdfText(buffer);
    } else {
      content = await extractImageText(buffer, ext);
    }
  } catch {
    return err("Failed to extract text from file", 422);
  }

  if (!content || content.trim().length === 0) return err("Could not extract text from file", 400);

  return ok({ content: content.trim() });
}

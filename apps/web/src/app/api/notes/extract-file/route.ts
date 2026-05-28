import Anthropic from "@anthropic-ai/sdk";
import { createClient, requireUser } from "@/lib/supabase/server";
import { ok, err } from "@/lib/response";

export const maxDuration = 60;

const SUPPORTED_EXTENSIONS = new Set([".txt", ".pdf", ".png", ".jpg", ".jpeg"]);
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_TEXT_CHARS = 50000;

// Magic byte signatures for allowed file types
const MAGIC_BYTES: Record<string, number[][]> = {
  ".pdf":  [[0x25, 0x50, 0x44, 0x46]],                          // %PDF
  ".png":  [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]], // PNG
  ".jpg":  [[0xFF, 0xD8, 0xFF]],                                 // JPEG
  ".jpeg": [[0xFF, 0xD8, 0xFF]],                                 // JPEG
  ".txt":  [],                                                    // No magic bytes for txt
};

function validateMagicBytes(buffer: Buffer, ext: string): string | null {
  const signatures = MAGIC_BYTES[ext];
  if (!signatures || signatures.length === 0) return null; // .txt — no check needed

  const matches = signatures.some((sig) =>
    sig.every((byte, i) => buffer[i] === byte)
  );

  if (!matches) {
    return `File content does not match the expected ${ext} format. Please upload a genuine ${ext} file.`;
  }
  return null;
}

function fileExtension(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i).toLowerCase() : "";
}

// Fast local PDF text extraction using pdf-parse (no worker, no network)
async function extractPdfText(buffer: Buffer): Promise<string> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require("pdf-parse");
    const data = await pdfParse(buffer, { max: 0 });
    return (data.text ?? "").replace(/\s+/g, " ").trim();
  } catch {
    return "";
  }
}

// Fallback: Anthropic vision for image files or scanned PDFs
async function extractImageText(buffer: Buffer, ext: string): Promise<string> {
  const base64 = buffer.toString("base64");
  const mediaType: "image/png" | "image/jpeg" =
    ext === ".png" ? "image/png" : "image/jpeg";
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2000,
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

function truncateText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const truncated = text.slice(0, maxChars);
  const lastPeriod = truncated.lastIndexOf(". ");
  return lastPeriod > maxChars * 0.8
    ? truncated.slice(0, lastPeriod + 1) + " [Content truncated to fit note limit]"
    : truncated + "... [Content truncated to fit note limit]";
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { authErr } = await requireUser(supabase);
  if (authErr) return authErr;

  let formData: FormData;
  try { formData = await request.formData(); }
  catch { return err("Invalid form data", 400); }

  const file = formData.get("file");
  if (!(file instanceof File)) return err("file is required", 400);

  const ext = fileExtension(file.name);
  if (!SUPPORTED_EXTENSIONS.has(ext)) {
    return err("Unsupported file type. Allowed: .txt, .pdf, .png, .jpg, .jpeg", 400);
  }
  if (file.size > MAX_FILE_SIZE) return err("File exceeds 10 MB limit", 400);

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Validate magic bytes (actual file content) not just extension
  // Prevents disguised malicious files e.g. webshell renamed as .pdf
  const mimeError = validateMagicBytes(buffer, ext);
  if (mimeError) return err(mimeError, 400);

  let content: string;
  try {
    if (ext === ".txt") {
      content = buffer.toString("utf-8");
    } else if (ext === ".pdf") {
      // Try fast local extraction first
      content = await extractPdfText(buffer);
      // If no text found (scanned PDF), fall back to vision
      if (!content || content.trim().length < 30) {
        content = await extractImageText(buffer, ".jpeg");
      }
    } else {
      content = await extractImageText(buffer, ext);
    }
  } catch {
    return err("Failed to extract text from file. Please try a different file.", 422);
  }

  if (!content || content.trim().length === 0) {
    return err(
      "Could not extract text from this file. If it is a scanned document, try uploading as an image (.jpg or .png) instead.",
      400
    );
  }

  return ok({ content: truncateText(content.trim(), MAX_TEXT_CHARS) });
}

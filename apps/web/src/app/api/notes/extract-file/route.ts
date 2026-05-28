import Anthropic from "@anthropic-ai/sdk";
import { createClient, requireUser } from "@/lib/supabase/server";
import { ok, err } from "@/lib/response";

export const maxDuration = 60;

const SUPPORTED_EXTENSIONS = new Set([".txt", ".pdf", ".png", ".jpg", ".jpeg"]);
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_TEXT_CHARS = 50000; // ~12,500 tokens — safe limit for note content

function fileExtension(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i).toLowerCase() : "";
}

// ── Fast local PDF-to-text extraction using pdf2json ──────────────────────
// Runs entirely on the server — no Anthropic call, no network, no timeout.
// Returns extracted text, or empty string if PDF has no text layer (scanned).
async function extractPdfText(buffer: Buffer): Promise<string> {
  const { default: PDFParser } = await import("pdf2json");
  return new Promise((resolve) => {
    const parser = new PDFParser();

    parser.on("pdfParser_dataReady", (data: { Pages: { Texts: { R: { T: string }[] }[] }[] }) => {
      try {
        const text = data.Pages
          .flatMap((p) => p.Texts)
          .map((t) => decodeURIComponent(t.R[0]?.T ?? ""))
          .filter(Boolean)
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();
        resolve(text);
      } catch {
        resolve("");
      }
    });

    // On error resolve empty — caller will fallback to image extraction
    parser.on("pdfParser_dataError", () => resolve(""));

    // Timeout safety: if pdf2json hangs, resolve after 20s
    setTimeout(() => resolve(""), 20000);

    parser.parseBuffer(buffer);
  });
}

// ── Image/scanned PDF text extraction via Anthropic vision ────────────────
// Only used when pdf2json returns empty (scanned PDF) or for image files.
async function extractImageText(buffer: Buffer, ext: string): Promise<string> {
  const base64 = buffer.toString("base64");
  const mediaType: "image/png" | "image/jpeg" = ext === ".png" ? "image/png" : "image/jpeg";
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const response = await anthropic.messages.create({
    model:      "claude-haiku-4-5-20251001",
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

// ── Truncate oversized text cleanly at a sentence boundary ───────────────
function truncateText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const truncated = text.slice(0, maxChars);
  // Try to end at last full sentence
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
      // Plain text — instant, no processing needed
      content = buffer.toString("utf-8");

    } else if (ext === ".pdf") {
      // Step 1: Try fast local extraction (no network, no timeout risk)
      content = await extractPdfText(buffer);

      // Step 2: If PDF has no text layer (scanned doc), fall back to vision
      if (!content || content.trim().length < 50) {
        content = await extractImageText(buffer, ".jpeg");
      }

    } else {
      // Image files — use Anthropic vision
      content = await extractImageText(buffer, ext);
    }
  } catch {
    return err("Failed to extract text from file. Please try a different file.", 422);
  }

  if (!content || content.trim().length === 0) {
    return err("Could not extract text from this file. If it is a scanned document, try a clearer scan.", 400);
  }

  // Truncate to safe limit before returning
  const finalContent = truncateText(content.trim(), MAX_TEXT_CHARS);

  return ok({ content: finalContent });
}

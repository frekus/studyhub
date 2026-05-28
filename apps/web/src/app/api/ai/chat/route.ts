import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { createClient, requireUser } from "@/lib/supabase/server";
import { ok, err, validationErr } from "@/lib/response";
import { getOrBuildProfile, buildPersonalisedSystemPrompt } from "@/lib/student-profile";

export const maxDuration = 60;

const ChatSchema = z.object({
  conversationId:      z.string().uuid().nullable().optional(),
  message:             z.string().min(1).max(10000),
  attachedNoteIds:     z.array(z.string().uuid()).default([]),
  attachedFileContent: z.string().nullable().optional(),
  examQuestion:        z.string().nullable().optional(),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const { user, authErr } = await requireUser(supabase);
  if (authErr) return authErr;

  let body: unknown;
  try { body = await request.json(); } catch { return err("Invalid JSON body", 400); }

  const parsed = ChatSchema.safeParse(body);
  if (!parsed.success) return validationErr(parsed.error);

  const { message, attachedNoteIds, attachedFileContent, examQuestion } = parsed.data;
  let { conversationId } = parsed.data;

  const conversationTitle = message.slice(0, 60);

  if (!conversationId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: conv, error: convErr } = await (supabase as any)
      .from("ai_conversations")
      .insert({ user_id: user.id, title: conversationTitle })
      .select()
      .single();
    if (convErr) return err((convErr as { message: string }).message, 500);
    conversationId = (conv as { id: string }).id;
  }

  // Load prior messages for context (last 20)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: history } = await (supabase as any)
    .from("ai_messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(20);

  // Build context from attached notes
  let noteContext = "";
  if (attachedNoteIds.length > 0) {
    const { data: notes } = await supabase
      .from("study_notes")
      .select("title, content, ai_summary")
      .in("id", attachedNoteIds)
      .eq("user_id", user.id);

    if (notes && notes.length > 0) {
      noteContext = notes.map((n) =>
        `## ${n.title}\n${n.ai_summary ? `Summary: ${n.ai_summary}\n\n` : ""}${n.content ?? ""}`
      ).join("\n\n---\n\n");
    }
  }

  if (attachedFileContent) {
    noteContext += (noteContext ? "\n\n---\n\n" : "") + attachedFileContent;
  }

  const profile = await getOrBuildProfile(user.id).catch(() => null);
  let systemPrompt = profile
    ? buildPersonalisedSystemPrompt(profile)
    : `You are StudyHub AI, an expert study assistant helping students understand their study material and prepare for exams.

Be concise, clear, and educational. Use examples where helpful.
Format responses with clear structure using markdown.

When answering exam questions:
- Give a comprehensive answer
- Explain the key concepts
- Mention what examiners typically look for
- Keep answers exam-appropriate`;

  if (noteContext) {
    systemPrompt = `Use the following student notes as reference:\n---\n${noteContext.slice(0, 8000)}\n---\n\n${systemPrompt}`;
  }

  const userMessage = examQuestion
    ? `Please give me a detailed answer to this exam question: ${message}`
    : message;

  // Save user message
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from("ai_messages")
    .insert({
      conversation_id: conversationId,
      user_id:         user.id,
      role:            "user",
      content:         message,
      attachments:     attachedNoteIds.length > 0 ? attachedNoteIds : [],
    });

  // Build messages for Anthropic (prior history + current)
  const messages: { role: "user" | "assistant"; content: string }[] = [
    ...((history ?? []) as { role: string; content: string }[]).map((m) => ({
      role:    m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user", content: userMessage },
  ];

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  let aiResponse: string;
  let usage: { input_tokens: number; output_tokens: number };

  try {
    const response = await anthropic.messages.create({
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 2000,
      system:     systemPrompt,
      messages,
    });
    const block = response.content[0];
    aiResponse = block.type === "text" ? block.text : "";
    usage = { input_tokens: response.usage.input_tokens, output_tokens: response.usage.output_tokens };
  } catch {
    return err("AI service temporarily unavailable", 503);
  }

  // Save AI response
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from("ai_messages")
    .insert({
      conversation_id: conversationId,
      user_id:         user.id,
      role:            "assistant",
      content:         aiResponse,
    });

  // Update conversation updated_at
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from("ai_conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId)
    .eq("user_id", user.id);

  return ok({ conversationId, message: aiResponse, usage });
}

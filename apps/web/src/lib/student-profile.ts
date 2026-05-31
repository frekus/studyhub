import { createAdminClient } from "@studyhub/database";
import { NIGERIAN_CURRICULUM_CONTEXT, NIGERIAN_CURRICULUM_CONTEXT_SLIM, detectNigerianContext } from "@/lib/nigerian-curriculum";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

export interface StudentProfile {
  userId: string;
  fullName: string | null;
  totalNotes: number;
  recentTopics: string[];          // last 10 note titles
  upcomingExams: { subject: string; examDate: string }[];
  weakAreas: { topic: string; accuracy: number }[];
  currentStreak: number;
  totalStudyDays: number;
  flashcardsReviewed: number;
  avgAccuracy: number | null;      // 0–100
  preferredSubjects: string[];     // subjects from study plans
  profileCompleteness: number;     // 0–100
  builtAt: string;
}

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

export async function buildStudentProfile(userId: string): Promise<StudentProfile> {
  const admin = createAdminClient() as AnyClient;

  const [
    { data: userRow },
    { data: notes },
    { data: streak },
    { data: plans },
    { data: performance },
  ] = await Promise.all([
    admin.from("users").select("full_name").eq("id", userId).maybeSingle(),
    admin.from("study_notes").select("title, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(20),
    admin.from("study_streaks").select("current_streak, total_study_days").eq("user_id", userId).maybeSingle(),
    admin.from("study_plans").select("subject, exam_date, status").eq("user_id", userId).order("exam_date", { ascending: true }),
    admin.from("flashcard_performance").select("correct_count, incorrect_count").eq("user_id", userId),
  ]);

  const recentTopics = (notes ?? []).slice(0, 10).map((n: { title: string }) => n.title);

  const upcomingExams = (plans ?? [])
    .filter((p: { exam_date: string }) => new Date(p.exam_date) > new Date())
    .slice(0, 5)
    .map((p: { subject: string; exam_date: string }) => ({ subject: p.subject, examDate: p.exam_date }));

  const preferredSubjects = [...new Set(
    (plans ?? []).map((p: { subject: string }) => p.subject).filter(Boolean) as string[]
  )].slice(0, 5);

  // Compute flashcard stats
  let totalCorrect = 0;
  let totalReviewed = 0;
  for (const p of (performance ?? []) as { correct_count: number; incorrect_count: number }[]) {
    totalCorrect   += p.correct_count;
    totalReviewed  += p.correct_count + p.incorrect_count;
  }
  const avgAccuracy = totalReviewed > 0 ? Math.round((totalCorrect / totalReviewed) * 100) : null;

  // Weak areas: performance records with accuracy < 60%
  const weakAreas: { topic: string; accuracy: number }[] = [];
  if (performance && recentTopics.length > 0) {
    const lowPerf = (performance as { correct_count: number; incorrect_count: number }[])
      .filter((p) => {
        const total = p.correct_count + p.incorrect_count;
        return total >= 3 && p.correct_count / total < 0.6;
      });
    if (lowPerf.length > 0 && recentTopics.length > 0) {
      // Map weak performance to recent topics as approximate proxy
      weakAreas.push(...recentTopics.slice(0, Math.min(3, lowPerf.length)).map((topic: string, i: number) => ({
        topic,
        accuracy: Math.round(
          (lowPerf[i].correct_count / (lowPerf[i].correct_count + lowPerf[i].incorrect_count)) * 100
        ),
      })));
    }
  }

  // Profile completeness: each data point adds to the score
  let completeness = 0;
  if (userRow?.full_name)        completeness += 20;
  if ((notes ?? []).length > 0)  completeness += 20;
  if (upcomingExams.length > 0)  completeness += 20;
  if (totalReviewed > 0)         completeness += 20;
  if ((streak?.current_streak ?? 0) > 0) completeness += 20;

  return {
    userId,
    fullName: userRow?.full_name ?? null,
    totalNotes: (notes ?? []).length,
    recentTopics,
    upcomingExams,
    weakAreas,
    currentStreak: streak?.current_streak ?? 0,
    totalStudyDays: streak?.total_study_days ?? 0,
    flashcardsReviewed: totalReviewed,
    avgAccuracy,
    preferredSubjects,
    profileCompleteness: completeness,
    builtAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Persist / retrieve (student_profiles table)
// ---------------------------------------------------------------------------

export async function getOrBuildProfile(userId: string): Promise<StudentProfile> {
  const admin = createAdminClient() as AnyClient;

  const { data: cached } = await admin
    .from("student_profiles")
    .select("profile_data, updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (cached) {
    const age = Date.now() - new Date(cached.updated_at).getTime();
    if (age < CACHE_TTL_MS) {
      return cached.profile_data as StudentProfile;
    }
  }

  const profile = await buildStudentProfile(userId);
  await admin.from("student_profiles").upsert(
    { user_id: userId, profile_data: profile, updated_at: new Date().toISOString() },
    { onConflict: "user_id" },
  );
  return profile;
}

export async function forceRebuildProfile(userId: string): Promise<StudentProfile> {
  const profile = await buildStudentProfile(userId);
  const admin = createAdminClient() as AnyClient;
  await admin.from("student_profiles").upsert(
    { user_id: userId, profile_data: profile, updated_at: new Date().toISOString() },
    { onConflict: "user_id" },
  );
  return profile;
}

// Invalidate the cached profile so the next request triggers a rebuild.
export async function invalidateProfile(userId: string): Promise<void> {
  const admin = createAdminClient() as AnyClient;
  // Set updated_at far in the past so the next getOrBuildProfile rebuilds
  await admin
    .from("student_profiles")
    .update({ updated_at: new Date(0).toISOString() })
    .eq("user_id", userId);
}

// ---------------------------------------------------------------------------
// System prompt builder
// ---------------------------------------------------------------------------

export function buildPersonalisedSystemPrompt(profile: StudentProfile, message?: string): string {
  const parts: string[] = [];

  if (profile.fullName) {
    parts.push(`The student's name is ${profile.fullName}.`);
  }

  if (profile.recentTopics.length > 0) {
    parts.push(`They have been studying: ${profile.recentTopics.slice(0, 6).join(", ")}.`);
  }

  if (profile.upcomingExams.length > 0) {
    const exams = profile.upcomingExams
      .map((e) => `${e.subject} on ${new Date(e.examDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`)
      .join(", ");
    parts.push(`Upcoming exams: ${exams}.`);
  }

  if (profile.weakAreas.length > 0) {
    const weak = profile.weakAreas.map((w) => `${w.topic} (${w.accuracy}% accuracy)`).join(", ");
    parts.push(`Areas needing extra attention: ${weak}.`);
  }

  if (profile.avgAccuracy !== null) {
    parts.push(`Overall flashcard accuracy: ${profile.avgAccuracy}%.`);
  }

  if (profile.currentStreak > 1) {
    parts.push(`They are on a ${profile.currentStreak}-day study streak.`);
  }

  const studentContext = parts.length > 0
    ? `\n\n## Student Profile\n${parts.join(" ")}\n\nUse this context to personalise your responses — reference their subjects, upcoming exams, and weak areas where relevant. Address the student by name when appropriate.`
    : "";

  return `You are StudyHub AI, an expert study assistant for Nigerian university and secondary school students. You have deep knowledge of WAEC, JAMB (UTME), NECO, and Nigerian university courses.

Be concise, clear, and educational. Use examples where helpful.
Format responses with clear structure using markdown.

When answering exam questions:
- Give a comprehensive answer aligned with Nigerian exam marking schemes
- Explain the key concepts
- Mention what WAEC/JAMB/NECO examiners typically look for
- Reference the relevant exam board where applicable
- Keep answers exam-appropriate${studentContext}
${detectNigerianContext(message ?? "", profile) ? NIGERIAN_CURRICULUM_CONTEXT : NIGERIAN_CURRICULUM_CONTEXT_SLIM}`;
}

// ---------------------------------------------------------------------------
// Greeting
// ---------------------------------------------------------------------------

export function buildPersonalisedGreeting(profile: StudentProfile): string {
  const name = profile.fullName ? `, ${profile.fullName.split(" ")[0]}` : "";

  if (profile.upcomingExams.length > 0) {
    const next = profile.upcomingExams[0];
    const daysUntil = Math.ceil(
      (new Date(next.examDate).getTime() - Date.now()) / 86_400_000
    );
    const timeStr = daysUntil <= 1 ? "tomorrow" : daysUntil <= 7 ? `in ${daysUntil} days` : `on ${new Date(next.examDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;
    return `Hi${name}! Your ${next.subject} exam is ${timeStr}. Ask me anything about it, or I can quiz you on your notes.`;
  }

  if (profile.weakAreas.length > 0) {
    return `Hi${name}! I noticed you're finding **${profile.weakAreas[0].topic}** tricky. Want to work through it together?`;
  }

  if (profile.currentStreak > 2) {
    return `Hi${name}! You're on a ${profile.currentStreak}-day streak — great work! What are we studying today?`;
  }

  if (profile.recentTopics.length > 0) {
    return `Hi${name}! Last time you were studying **${profile.recentTopics[0]}**. Want to continue or start something new?`;
  }

  return `Hi${name}! I'm your StudyHub AI assistant. Ask me anything about your notes, or I can help you prepare for your exams.`;
}

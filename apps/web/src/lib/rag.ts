import { createAdminClient } from "@studyhub/database";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

interface PastQuestion {
  exam_board: string;
  subject: string;
  year: number;
  topic: string;
  question_text: string;
  answer_text: string;
  difficulty: string;
}

interface UniversityProfile {
  university: string;
  department: string;
  course_combinations: string[];
  cut_off_mark: number;
  post_utme_format: string;
  admission_tips: string;
  department_context: string;
}

function pseudoEmbedding(text: string): number[] {
  const vec = new Array(1536).fill(0);
  for (let i = 0; i < text.length; i++) {
    const idx = (text.charCodeAt(i) * (i + 1)) % 1536;
    vec[idx] = (vec[idx] + text.charCodeAt(i) / 127) % 1;
  }
  const mag = Math.sqrt(vec.reduce((s: number, v: number) => s + v * v, 0)) || 1;
  return vec.map((v: number) => v / mag);
}

const SUBJECT_KEYWORDS: Record<string, string[]> = {
  "English Language": ["english", "grammar", "essay", "comprehension", "vocabulary", "oral english", "summary", "letter writing"],
  "Mathematics":      ["maths", "mathematics", "algebra", "geometry", "calculus", "statistics", "trigonometry", "quadratic", "matrix", "indices"],
  "Biology":          ["biology", "cell", "photosynthesis", "genetics", "ecology", "osmosis", "evolution", "respiration", "nutrition", "reproduction"],
  "Chemistry":        ["chemistry", "atom", "molecule", "bond", "reaction", "organic", "acid", "base", "salt", "periodic table", "mole", "titration"],
  "Physics":          ["physics", "force", "motion", "wave", "electricity", "optics", "energy", "power", "magnetism", "nuclear", "thermodynamics"],
  "Economics":        ["economics", "demand", "supply", "gdp", "gnp", "market", "inflation", "money", "trade", "fiscal", "monetary", "cbn"],
};

export function detectSubject(message: string): string | null {
  const lower = message.toLowerCase();
  for (const [subject, keywords] of Object.entries(SUBJECT_KEYWORDS)) {
    if (keywords.some(k => lower.includes(k))) return subject;
  }
  return null;
}

const UNIVERSITY_KEYWORDS: Record<string, string> = {
  "unilag": "UNILAG", "university of lagos": "UNILAG",
  "ui ": "UI", "university of ibadan": "UI",
  "abu ": "ABU", "ahmadu bello": "ABU",
  "oau": "OAU", "obafemi awolowo": "OAU", "ife": "OAU",
  "uniben": "UNIBEN", "university of benin": "UNIBEN",
  "uniport": "UNIPORT", "university of port harcourt": "UNIPORT",
  "futa": "FUTA", "akure": "FUTA",
  "noun": "NOUN", "national open university": "NOUN",
};

export function detectUniversity(message: string): string | null {
  const lower = message.toLowerCase();
  for (const [keyword, uni] of Object.entries(UNIVERSITY_KEYWORDS)) {
    if (lower.includes(keyword)) return uni;
  }
  return null;
}

export async function fetchSimilarQuestions(
  message: string,
  subject: string | null,
  limit = 3
): Promise<PastQuestion[]> {
  const admin = createAdminClient() as AnyClient;
  const embedding = pseudoEmbedding(`${subject ?? ""} ${message}`);

  try {
    const { data, error } = await admin.rpc("match_past_questions", {
      query_embedding: JSON.stringify(embedding),
      match_subject:   subject,
      match_count:     limit,
    });

    if (error || !data) {
      const query = admin
        .from("past_questions")
        .select("exam_board, subject, year, topic, question_text, answer_text, difficulty")
        .limit(limit);
      if (subject) query.eq("subject", subject);
      const { data: fallback } = await query;
      return (fallback ?? []) as PastQuestion[];
    }

    return (data ?? []) as PastQuestion[];
  } catch {
    return [];
  }
}

export async function fetchUniversityProfile(
  university: string,
  department?: string | null
): Promise<UniversityProfile | null> {
  const admin = createAdminClient() as AnyClient;

  if (department) {
    const { data: exact } = await admin
      .from("university_profiles")
      .select("university, department, course_combinations, cut_off_mark, post_utme_format, admission_tips, department_context")
      .eq("university", university)
      .ilike("department", `%${department}%`)
      .limit(1);
    if (exact && exact.length > 0) return exact[0] as UniversityProfile;
  }

  const { data } = await admin
    .from("university_profiles")
    .select("university, department, course_combinations, cut_off_mark, post_utme_format, admission_tips, department_context")
    .eq("university", university)
    .limit(1);

  return data?.[0] as UniversityProfile ?? null;
}

export async function buildRAGContext(
  message: string,
  profile?: { preferredSubjects?: string[] }
): Promise<string> {
  const contextParts: string[] = [];

  let subject = detectSubject(message);
  if (!subject && profile?.preferredSubjects?.length) {
    subject = detectSubject(profile.preferredSubjects[0]) ?? profile.preferredSubjects[0];
  }

  const questions = await fetchSimilarQuestions(message, subject, 3);
  if (questions.length > 0) {
    const qLines = questions.map(q =>
      `**${q.exam_board} ${q.subject} ${q.year} — ${q.topic}** (${q.difficulty})\nQ: ${q.question_text}\nA: ${q.answer_text}`
    ).join("\n\n---\n\n");
    contextParts.push(`## Relevant Past Questions\n${qLines}`);
  }

  const university = detectUniversity(message);
  if (university) {
    const uniProfile = await fetchUniversityProfile(university);
    if (uniProfile) {
      contextParts.push(`## University Context — ${uniProfile.university} ${uniProfile.department}\n${uniProfile.department_context}\n\n**JAMB Cut-off:** ${uniProfile.cut_off_mark}\n**Post-UTME:** ${uniProfile.post_utme_format}\n**Admission tips:** ${uniProfile.admission_tips}`);
    }
  }

  if (contextParts.length === 0) return "";
  return `\n\n## Retrieved Context\n${contextParts.join("\n\n")}`;
}

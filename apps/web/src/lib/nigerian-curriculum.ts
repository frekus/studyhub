// ---------------------------------------------------------------------------
// Nigerian Curriculum Context
// Injected into the AI system prompt to give StudyHub AI knowledge of
// WAEC, JAMB (UTME), NECO exam structures, syllabi, and marking patterns.
// ---------------------------------------------------------------------------

export const NIGERIAN_CURRICULUM_CONTEXT = `
## Nigerian Examination Context

You have deep knowledge of Nigerian secondary and tertiary education exams. Apply this knowledge whenever relevant.

### WAEC (West African Examinations Council) — WASSCE
- Subjects: English Language, Mathematics, Biology, Chemistry, Physics, Economics, Government, Literature-in-English, Geography, Agricultural Science, Further Mathematics, Commerce, Accounting, Civic Education, History, French, Yoruba, Igbo, Hausa, Fine Art, Food & Nutrition, Health Science, Technical Drawing, Computer Studies, and others.
- Exam format: Theory (essay/structured) + Objectives (multiple choice). Most subjects have Paper 1 (OBJ) and Paper 2 (Theory/Practical).
- Grading: A1 (75–100), B2 (70–74), B3 (65–69), C4 (60–64), C5 (55–59), C6 (50–54), D7 (45–49), E8 (40–44), F9 (0–39). Credit = A1–C6.
- 5 credits including English and Maths required for most university admissions.
- Common question patterns: "State and explain", "Differentiate between", "With the aid of a diagram", "Outline", "Discuss", "Give reasons".
- Marking scheme rewards: correct points per mark, diagrams labelled correctly, use of subject-specific terminology.

### JAMB UTME (Joint Admissions and Matriculation Board)
- 4 subjects: Use of English (compulsory) + 3 subject combinations based on course of study.
- Common combinations: Sciences (Physics, Chemistry, Biology/Maths), Social Sciences (Economics, Government/CRK, Literature/Geography), Arts (Literature, Government, CRK/History).
- Format: 60 questions per subject, 40 minutes per subject, computer-based test (CBT).
- Scoring: +1 per correct answer, 0 for wrong (no negative marking since 2021).
- Cut-off marks: typically 180–200+ for competitive federal universities, 140–160 for state universities.
- JAMB syllabus is fixed — questions stay within syllabus boundaries. Always reference JAMB syllabus topics.
- Key JAMB tip: questions test understanding and application, not memorisation alone.

### NECO (National Examinations Council) — SSCE
- Similar structure to WAEC but set by a Nigerian body.
- Covers same core subjects, slightly different question style — more direct, less interpretive than WAEC.
- Also offers BECE (Basic Education Certificate Examination) for JSS3.
- Grading same as WAEC: A1–F9.

### Post-UTME / Departmental Exams
- Most federal universities (UNILAG, UI, ABU, UNIPORT, OAU, FUTA, UNIBEN etc.) conduct Post-UTME screening.
- Tests same UTME subjects, university-specific past questions are very useful.
- Cut-off varies by department — Medicine/Law most competitive.

### Nigerian University System
- Universities: Federal (e.g. UNILAG, UI, ABU Zaria, OAU, UNIBEN, UNIPORT, FUTA), State, Private.
- 100-level to 400/500-level (medicine is 600-level).
- GPA system: 5.0 scale. First Class = 4.5–5.0, Second Class Upper = 3.5–4.49, Second Class Lower = 2.5–3.49, Third Class = 1.5–2.49, Pass = 1.0–1.49.
- Carry-over (C/O): failing a course requires retaking it.
- Common Nigerian university courses: Medicine & Surgery (MBBS), Law (LLB), Engineering (B.Eng), Computer Science, Accounting, Economics, Mass Communication, Pharmacy, Nursing, Architecture, Estate Management.

### Subject-Specific Exam Tips

**WAEC/NECO English Language**
- Paper 1: Lexis & Structure (OBJ) — idioms, phrasal verbs, antonyms, synonyms, fill-in-the-blank.
- Paper 2: Essay writing (Formal/informal letter, argumentative, descriptive, narrative, expository), Summary, Comprehension.
- Essay marking: Content (10), Organisation (5), Expression (5) = 20 marks. Errors deducted.
- Summary: Must be in continuous prose, own words, specific number of points, word limit matters.

**WAEC/JAMB Mathematics**
- Topics: Number & Numeration, Algebraic Processes, Geometry, Mensuration, Trigonometry, Statistics & Probability, Vectors, Matrices.
- Show all workings — method marks awarded even if final answer is wrong.
- Common errors: sign errors, not converting units, leaving answers in surd form when decimal needed.

**WAEC/JAMB Biology**
- Topics: Cell biology, Genetics & Evolution, Ecology, Nutrition, Reproduction, Excretion, Transport, Coordination.
- Diagrams are compulsory in many questions — label fully, use pencil and ruler.
- Distinguish between "State" (list only), "Explain" (state + reason), "Describe" (detailed account).

**WAEC/JAMB Chemistry**
- Topics: Atomic structure, Bonding, Stoichiometry, Kinetics, Equilibrium, Electrochemistry, Organic Chemistry, Qualitative Analysis.
- Equations must be balanced. State symbols (s, l, g, aq) required in WAEC theory.
- Qualitative analysis questions: Know colour changes, precipitate colours, gas tests.

**WAEC/JAMB Physics**
- Topics: Mechanics, Thermal Physics, Waves, Optics, Electricity & Magnetism, Modern Physics.
- Formula derivation often required — not just substitution.
- Practical questions test reading of instruments (ammeter, voltmeter, micrometer).

**WAEC Economics**
- Topics: Demand & Supply, Market Structures, National Income, Money & Banking, International Trade, Economic Development, Public Finance.
- Theory questions: Always define terms first, use diagrams (demand/supply curves) where applicable.
- Data Response questions: Read tables/graphs carefully, use data to support answers.

**WAEC Government**
- Topics: Federalism, Legislature/Executive/Judiciary, Electoral systems, Political parties, Nigerian constitutional history, International organisations (AU, ECOWAS, UN).
- Dates and facts matter — Nigerian constitutional milestones (1914 amalgamation, 1960 independence, 1963 republic, 1979 constitution, 1999 constitution).

### Exam Strategy Tips (Nigerian Context)
- WAEC theory: Attempt all required questions, not more. Crossing out wastes time.
- JAMB CBT: No going back to flag questions — answer as you go, manage 40 min/subject.
- Start with questions you know — confidence builds speed.
- In theory papers: Write the question number clearly, underline key terms in your answer.
- For 5-mark questions: Typically 5 distinct points or 1 well-explained point with sub-parts.
- Past questions (past-Q) from 2015–2024 are the most reliable predictor of question patterns.
`;

// Subject combinations for common Nigerian university courses
export const COURSE_SUBJECT_COMBINATIONS: Record<string, string[]> = {
  "medicine":          ["Biology", "Chemistry", "Physics", "Use of English"],
  "pharmacy":          ["Biology", "Chemistry", "Physics", "Use of English"],
  "nursing":           ["Biology", "Chemistry", "Physics", "Use of English"],
  "engineering":       ["Mathematics", "Physics", "Chemistry", "Use of English"],
  "computer science":  ["Mathematics", "Physics", "Chemistry", "Use of English"],
  "law":               ["Literature-in-English", "Government", "CRK/IRK", "Use of English"],
  "economics":         ["Mathematics", "Economics", "Government", "Use of English"],
  "accounting":        ["Mathematics", "Economics", "Commerce", "Use of English"],
  "mass communication":["Literature-in-English", "Government", "Economics", "Use of English"],
  "architecture":      ["Mathematics", "Physics", "Fine Art", "Use of English"],
  "agriculture":       ["Biology", "Chemistry", "Agricultural Science", "Use of English"],
};

// Detect if a message is likely about a Nigerian exam or subject
export function detectNigerianContext(message: string, profile?: { preferredSubjects?: string[]; upcomingExams?: { subject: string }[] }): boolean {
  const nigerianKeywords = [
    "waec", "jamb", "utme", "neco", "post-utme", "ssce", "wassce",
    "a1", "b2", "b3", "c4", "c5", "c6", "credit pass",
    "federal university", "state university", "polytechnic",
    "unilag", "ui ibadan", "abu zaria", "oau", "uniben", "uniport", "futa",
    "100 level", "200 level", "gpa", "carry over", "carryover",
    "nigerian", "nigeria",
  ];
  const lower = message.toLowerCase();
  if (nigerianKeywords.some(k => lower.includes(k))) return true;
  // If student has Nigerian-context subjects, always inject
  const nigerianSubjects = ["government", "civic education", "commerce", "agricultural science", "yoruba", "igbo", "hausa"];
  const subjects = [
    ...(profile?.preferredSubjects ?? []),
    ...(profile?.upcomingExams?.map(e => e.subject) ?? []),
  ].map(s => s.toLowerCase());
  if (subjects.some(s => nigerianSubjects.some(ns => s.includes(ns)))) return true;
  return false;
}

// Slim version injected when no Nigerian exam context is detected
// Keeps the AI aware it serves Nigerian students without bloating every prompt
export const NIGERIAN_CURRICULUM_CONTEXT_SLIM = `
## Nigerian Student Context
You are serving Nigerian university and secondary school students. When relevant, reference WAEC, JAMB (UTME), NECO, or Nigerian university grading (5.0 GPA scale). Otherwise respond naturally without forcing exam references.
`;

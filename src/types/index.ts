/**
 * ACCA FA QuizApp v2 - Type Definitions
 * Comprehensive types for the intelligent exam preparation platform
 */

// ============================= Core Domain Types =============================

export type SectionCode = 'DE' | 'INV' | 'NCA' | 'INT' | 'TAX' | 'ACC' | 'RPP' | 'CAP';
export type QuestionType = 'mcq' | 'multi' | 'tf' | 'numeric' | 'manual' | 'fs';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type ConfidenceLevel = 'low' | 'medium' | 'high';
export type QuizMode = 'tutor' | 'exam' | 'mixed' | 'section' | 'mistakes' | 'srs' | 'flashcard';
export type AttemptMode = 'quiz' | 'import' | 'srs' | 'flashcard' | 'manual';

export interface SectionMeta {
  code: SectionCode;
  name: string;
  uz: string;
  weight: number; // ACCA syllabus weight percentage
}

export const SECTIONS: Record<SectionCode, SectionMeta> = {
  DE: { code: 'DE', name: 'Double Entry & Accounting Systems', uz: 'Ikki tomonlama yozuv va hisob tizimlari', weight: 20 },
  INV: { code: 'INV', name: 'Inventory', uz: 'Tovar-moddiy zaxiralar', weight: 15 },
  NCA: { code: 'NCA', name: 'Non-Current Assets', uz: 'Uzoq muddatli aktivlar', weight: 15 },
  INT: { code: 'INT', name: 'Intangibles & R&D', uz: 'Nomoddiy aktivlar va tadqiqot-ishlanmalar', weight: 10 },
  TAX: { code: 'TAX', name: 'Taxation', uz: 'Soliqlar', weight: 10 },
  ACC: { code: 'ACC', name: 'Accruals & Prepayments', uz: 'Hisoblangan xarajatlar va oldindan to\'lovlar', weight: 10 },
  RPP: { code: 'RPP', name: 'Receivables, Payables & Provisions', uz: 'Debitorlik, kreditorlik va zaxiralar', weight: 10 },
  CAP: { code: 'CAP', name: 'Capital Structure & Finance Costs', uz: 'Kapital tuzilmasi va moliyaviy xarajatlar', weight: 10 },
};

export const SECTION_ORDER: SectionCode[] = ['DE', 'INV', 'NCA', 'INT', 'TAX', 'ACC', 'RPP', 'CAP'];

// ============================= Question Types =============================

export interface BaseQuestion {
  id: string;
  t: QuestionType;
  q: string; // question text (HTML allowed)
  section: SectionCode;
  topic?: string; // subtopic tag e.g. "DEAD CLIC", "Pro-rata depreciation"
  subtopic?: string; // granular subtopic for heatmap
  difficulty: Difficulty;
  source: 'original' | 'mid1' | 'mid2' | 'mid3' | 'hard100' | 'custom' | 'ai-generated';
  ex: string; // explanation (HTML allowed)
  a: unknown; // answer - varies by type
  opt?: string[]; // options for mcq/multi
  multi_correct?: number[]; // for multi-select
}

export type MCQQuestion = BaseQuestion & { t: 'mcq'; a: number; opt: string[] };
export type MultiQuestion = BaseQuestion & { t: 'multi'; a: number[]; multi_correct: number[]; opt: string[] };
export type TFQuestion = BaseQuestion & { t: 'tf'; a: boolean };
export type NumericQuestion = BaseQuestion & { t: 'numeric'; a: number };
export type ManualQuestion = BaseQuestion & { t: 'manual'; a: null; opt?: never };

// ---- Financial-statements construction (SPL + SOFP from a trial balance) ----

export interface FSTrialBalanceRow {
  account: string;
  debit: number | null;
  credit: number | null;
}

export interface FSNote {
  ref: number;
  text: string; // HTML allowed
}

export interface FSFormulaTerm {
  lineId: string;
  op: '+' | '-';
}

export interface FSLine {
  id: string; // stable — grading + analytics key off this
  statement: 'SPL' | 'SOFP';
  group: string; // on-screen grouping, e.g. "Operating", "Current assets", "Equity", "Totals"
  label: string; // fixed pre-printed proforma label
  kind: 'input' | 'subtotal';
  correctValue: number;
  marks?: number; // default 1
  deduction?: boolean; // proforma shows (X); learner types the positive magnitude
  workingHint?: string; // shown in the worked solution
  formula?: FSFormulaTerm[]; // for kind: "subtotal" — powers own-figure grading
}

export type FSQuestion = BaseQuestion & {
  t: 'fs';
  a: null;
  entityType?: 'company' | 'soleTrader';
  yearEndDate?: string;
  scenario?: string; // HTML allowed
  trialBalance: FSTrialBalanceRow[];
  adjustmentNotes: FSNote[];
  lines: FSLine[]; // ordered: every line a subtotal depends on comes before it
  tolerance?: number; // per-line rounding tolerance, default 0
};

/** Learner's entry for an FS question: value per line id (null = left blank). */
export type FSAnswers = Record<string, number | null>;

export type Question =
  | MCQQuestion
  | MultiQuestion
  | TFQuestion
  | NumericQuestion
  | ManualQuestion
  | FSQuestion;

export interface QuestionBank {
  meta: { version: string; updated: string; totalQuestions: number };
  sections: Record<SectionCode, { code: SectionCode; name: string; uz: string; questions: Question[] }>;
}

// ============================= Attempt & Analytics Types =============================

export interface QuestionAttempt {
  qId: string;
  section: SectionCode;
  correct: boolean;
  timeSpent: number; // seconds
  confidence: ConfidenceLevel | null;
  subtopic: string;
  difficulty: Difficulty;
  userAnswer?: unknown;
  timestamp: string; // ISO date
}

export interface Attempt {
  id: string;
  mode: AttemptMode;
  sectionLabel: string;
  ts: string; // ISO date
  total: number;
  score: number;
  results: QuestionAttempt[];
}

export interface MistakeRecord {
  qId: string;
  section: SectionCode;
  wrongCount: number;
  correctCount: number;
  lastResult: 'correct' | 'wrong';
  lastTs: string;
  firstSeen: string;
  avgTimeSpent: number;
  highConfidenceErrors: number; // count of high-confidence wrong answers
  subtopics: Record<string, { wrong: number; correct: number }>;
}

// ============================= SRS Types (SM-2) =============================

export interface SRSCard {
  qId: string;
  ease: number; // default 2.5
  interval: number; // days
  reps: number; // successful repetitions
  dueDate: string | null; // ISO date
  lastQuality: number | null; // 0-5
  lastReviewed: string | null; // ISO date
}

export type SRSQuality = 0 | 1 | 2 | 3 | 4 | 5;

// ============================= Streak & Gamification =============================

export interface StreakState {
  current: number;
  longest: number;
  lastDate: string | null; // YYYY-MM-DD
  target: number; // daily question target
  todayCount: number;
  updatedAt: string;
}

export interface StreakStats {
  current: number;
  longest: number;
  target: number;
  todayCount: number;
  progress: number; // 0-100
  isActiveToday: boolean;
}

// ============================= Cloud Sync Types =============================

/** One stored study insight (also the row shape used in exports). */
export interface InsightRow {
  id: string;
  device_id: string;
  ts: string;
  source_label: string;
  summary: string;
  weak_sections: Record<string, number>;
  recommendations: string[];
}

// ============================= UI State Types =============================

export type ViewName = 'dashboard' | 'quiz' | 'mistakes' | 'import' | 'settings' | 'flashcards' | 'srs';

export interface QuizState {
  currentView: ViewName;
  isLoading: boolean;
  error: string | null;
}

/** How the quiz behaves, independent of what content it contains. */
export type QuizInteraction = 'tutor' | 'exam';

export interface QuizSession {
  questions: Question[];
  title: string;
  mode: QuizMode; // content/label: mixed | mistakes | srs | ...
  interaction: QuizInteraction; // behaviour: tutor (explain as you go) | exam (grade at end)
  startTimes: Record<string, number>; // epoch ms when each question was first seen
  answeredAt: Record<string, number>; // epoch ms when each question was last answered
  startedAt: number; // epoch ms, for reliable elapsed time across reloads
  confidenceAnswers: Record<string, ConfidenceLevel>;
  currentIndex: number;
  answers: Record<string, unknown>;
  revealed: Record<string, boolean>; // tutor mode: feedback shown + answer locked for this question
}

export interface SavedQuiz {
  id: string;
  title: string;
  savedAt: string; // ISO
  session: QuizSession;
  answeredCount: number;
  total: number;
}

// ============================= Analytics Computed Types =============================

export interface SectionMastery {
  section: SectionCode;
  total: number;
  correct: number;
  percentage: number | null;
  avgTime: number;
  avgConfidence: number;
  byDifficulty: Record<Difficulty, { total: number; correct: number }>;
  bySubtopic: Record<string, { total: number; correct: number; avgTime: number }>;
}

export interface DayStats {
  date: string; // YYYY-MM-DD
  total: number;
  correct: number;
  timeSpent: number;
  questionsAnswered: number;
}

export interface SubtopicMastery {
  section: SectionCode;
  subtopic: string;
  total: number;
  correct: number;
  percentage: number;
  avgTime: number;
  errorRate: number;
  volume: number; // question count for heatmap cell size
}

export interface HeatmapData {
  sections: SectionCode[];
  subtopics: string[];
  cells: HeatmapCell[];
}

export interface HeatmapCell {
  section: SectionCode;
  subtopic: string;
  errorRate: number; // 0-1
  volume: number;
  totalAttempts: number;
  wrongAttempts: number;
  avgTime: number;
}

// ============================= AI / OmniRoute Types =============================

export interface AIExplanationRequest {
  question: Question;
  userAnswer: unknown;
  correctAnswer: unknown;
  style: 'conceptual' | 'numeric' | 'journal-entry' | 'simple';
}

export interface AIExplanationResponse {
  explanation: string;
  keyPoints: string[];
  commonMistakes: string[];
  relatedConcepts: string[];
}

export interface AIHintRequest {
  question: Question;
  step: number; // 1 or 2
}

export interface AIHintResponse {
  hint: string;
  revealsAnswer: boolean;
}

export interface AIWhyWrongRequest {
  question: Question;
  userAnswer: unknown;
  correctAnswer: unknown;
}

export interface AIWhyWrongResponse {
  analysis: string;
  misconception: string;
  correctReasoning: string;
}

export interface AIVariantRequest {
  question: Question;
  subtopic: string;
  difficulty: Difficulty;
}

export interface AIVariantResponse {
  question: Question;
  changedElements: string[];
}

// ============================= Flashcard Types =============================

export interface Flashcard {
  id: string;
  front: string; // HTML
  back: string; // HTML
  section: SectionCode;
  subtopic: string;
  type: 'question' | 'formula' | 'journal-entry' | 'definition' | 'custom';
  sourceQuestionId?: string;
  srsCard?: SRSCard;
}

export interface FlashcardSession {
  cards: Flashcard[];
  currentIndex: number;
  ratings: Record<string, SRSQuality>;
}

// ============================= Export/Import Types =============================

export interface ExportData {
  version: string;
  exportedAt: string;
  attempts: Attempt[];
  mistakes: Record<string, MistakeRecord>;
  srs: Record<string, SRSCard>;
  streak: StreakState;
  customQuestions: Question[];
  insights: InsightRow[];
  settings: UserSettings;
}

export interface UserSettings {
  theme: 'light' | 'dark' | 'system';
  quizMode: QuizMode;
  showTimer: boolean;
  requireConfidence: boolean;
  dailyTarget: number;
  soundEnabled: boolean;
  animationsEnabled: boolean;
}

// ============================= Utility Types =============================

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;
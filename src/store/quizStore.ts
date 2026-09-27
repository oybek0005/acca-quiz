/**
 * Quiz Store - Central state management for quiz sessions
 * Uses Zustand for lightweight, reactive state
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { checkAnswer, normalizeQuestions } from '@/lib/questions';
import type {
  Question,
  QuestionAttempt,
  QuizMode,
  SectionCode,
  QuizSession,
  QuizInteraction,
  ViewName,
  Difficulty,
  ConfidenceLevel,
} from '@/types';

// ============================= Settings Store =============================

export interface SettingsState {
  theme: 'light' | 'dark' | 'system';
  quizMode: QuizMode;
  showTimer: boolean;
  requireConfidence: boolean;
  dailyTarget: number;
  soundEnabled: boolean;
  animationsEnabled: boolean;
  sectionWeights: Record<SectionCode, number>;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  setQuizMode: (mode: QuizMode) => void;
  setShowTimer: (show: boolean) => void;
  setRequireConfidence: (require: boolean) => void;
  setDailyTarget: (target: number) => void;
  setSoundEnabled: (enabled: boolean) => void;
  setAnimationsEnabled: (enabled: boolean) => void;
  setSectionWeights: (weights: Record<SectionCode, number>) => void;
  reset: () => void;
}

const DEFAULT_WEIGHTS: Record<SectionCode, number> = {
  DE: 16,
  INV: 14,
  NCA: 14,
  INT: 8,
  TAX: 8,
  ACC: 10,
  RPP: 10,
  CAP: 10,
  REC: 10,
  CFS: 0,
};

const DEFAULT_SETTINGS: Omit<SettingsState, keyof Pick<SettingsState, 'setTheme' | 'setQuizMode' | 'setShowTimer' | 'setRequireConfidence' | 'setDailyTarget' | 'setSoundEnabled' | 'setAnimationsEnabled' | 'setSectionWeights' | 'reset'>> = {
  theme: 'system',
  quizMode: 'tutor',
  showTimer: true,
  requireConfidence: false,
  dailyTarget: 20,
  soundEnabled: true,
  animationsEnabled: true,
  sectionWeights: DEFAULT_WEIGHTS,
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      setTheme: (theme) => set({ theme }),
      setQuizMode: (quizMode) => set({ quizMode }),
      setShowTimer: (showTimer) => set({ showTimer }),
      setRequireConfidence: (requireConfidence) => set({ requireConfidence }),
      setDailyTarget: (dailyTarget) => set({ dailyTarget: Math.max(1, Math.min(200, dailyTarget)) }),
      setSoundEnabled: (soundEnabled) => set({ soundEnabled }),
      setAnimationsEnabled: (animationsEnabled) => set({ animationsEnabled }),
      setSectionWeights: (sectionWeights) => set({ sectionWeights }),
      reset: () => set(DEFAULT_SETTINGS),
    }),
    {
      name: 'faq-settings',
      storage: createJSONStorage(() => localStorage),
      version: 1,
    }
  )
);

// ============================= Quiz Session Store =============================

export interface QuizSessionState {
  session: QuizSession | null;
  currentView: ViewName;
  isLoading: boolean;
  error: string | null;
  // Actions
  startQuiz: (questions: Question[], title: string, mode: QuizMode, interaction?: QuizInteraction) => void;
  startWeightedQuiz: (allQuestions: Question[], title: string, mode: QuizMode, count?: number, interaction?: QuizInteraction) => void;
  answerQuestion: (qId: string, answer: unknown) => void;
  revealQuestion: (qId: string) => void;
  markQuestionSeen: (qId: string) => void;
  setConfidence: (qId: string, confidence: ConfidenceLevel) => void;
  nextQuestion: () => void;
  prevQuestion: () => void;
  goToQuestion: (index: number) => void;
  submitQuiz: () => QuestionAttempt[];
  endQuiz: () => void;
  resumeSession: (session: QuizSession) => void;
  setView: (view: ViewName) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

// ---------------------------------------------------------------------------

/** Resolve the interaction (tutor/exam) — explicit wins, else the user's setting. */
function resolveInteraction(explicit?: QuizInteraction): QuizInteraction {
  if (explicit) return explicit;
  const m = useSettingsStore.getState().quizMode;
  return m === 'exam' ? 'exam' : 'tutor';
}

function buildSession(
  questions: Question[],
  title: string,
  mode: QuizMode,
  interaction: QuizInteraction
): QuizSession {
  const now = Date.now();
  return {
    questions,
    title,
    mode,
    interaction,
    startTimes: { [questions[0].id]: now }, // first question is seen immediately
    answeredAt: {},
    startedAt: now,
    confidenceAnswers: {},
    currentIndex: 0,
    answers: {},
    revealed: {},
  };
}

export const useQuizStore = create<QuizSessionState>()(
  persist(
    (set, get) => ({
      session: null,
      currentView: 'dashboard',
      isLoading: false,
      error: null,

      startQuiz: (questions, title, mode, interaction) => {
        if (!questions || questions.length === 0) {
          set({ error: 'No questions available for this quiz.' });
          return;
        }
        set({
          session: buildSession(questions, title, mode, resolveInteraction(interaction)),
          currentView: 'quiz',
          error: null,
        });
      },

      startWeightedQuiz: (allQuestions, title, mode, count = 20, interaction) => {
        const { sectionWeights } = useSettingsStore.getState();
        const questions = getWeightedRandomQuestions(allQuestions, sectionWeights, count);

        if (questions.length === 0) {
          set({ error: 'No questions available for this quiz.' });
          return;
        }
        set({
          session: buildSession(questions, title, mode, resolveInteraction(interaction)),
          currentView: 'quiz',
          error: null,
        });
      },

      answerQuestion: (qId, answer) =>
        set((state) => {
          if (!state.session) return state;
          return {
            session: {
              ...state.session,
              answers: { ...state.session.answers, [qId]: answer },
              answeredAt: { ...state.session.answeredAt, [qId]: Date.now() },
            },
          };
        }),

      revealQuestion: (qId) =>
        set((state) => {
          if (!state.session || state.session.revealed[qId]) return state;
          return {
            session: {
              ...state.session,
              revealed: { ...state.session.revealed, [qId]: true },
              answeredAt: { ...state.session.answeredAt, [qId]: state.session.answeredAt[qId] ?? Date.now() },
            },
          };
        }),

      markQuestionSeen: (qId) =>
        set((state) => {
          if (!state.session || state.session.startTimes[qId]) return state;
          return {
            session: {
              ...state.session,
              startTimes: { ...state.session.startTimes, [qId]: Date.now() },
            },
          };
        }),

      setConfidence: (qId, confidence) =>
        set((state) => {
          if (!state.session) return state;
          return {
            session: {
              ...state.session,
              confidenceAnswers: { ...state.session.confidenceAnswers, [qId]: confidence },
            },
          };
        }),

      nextQuestion: () =>
        set((state) => {
          if (!state.session) return state;
          const nextIndex = Math.min(state.session.currentIndex + 1, state.session.questions.length - 1);
          return { session: { ...state.session, currentIndex: nextIndex } };
        }),

      prevQuestion: () =>
        set((state) => {
          if (!state.session) return state;
          const prevIndex = Math.max(state.session.currentIndex - 1, 0);
          return { session: { ...state.session, currentIndex: prevIndex } };
        }),

      goToQuestion: (index) =>
        set((state) => {
          if (!state.session) return state;
          const clampedIndex = Math.max(0, Math.min(index, state.session.questions.length - 1));
          return { session: { ...state.session, currentIndex: clampedIndex } };
        }),

      submitQuiz: () => {
        const state = get();
        if (!state.session) return [];

        const session = state.session;
        const totalElapsed = Math.max(0, Math.round((Date.now() - session.startedAt) / 1000));
        const answeredCount = Object.keys(session.answers).length || session.questions.length;

        const attempts: QuestionAttempt[] = session.questions.map((q) => {
          const userAnswer = session.answers[q.id];
          const seen = session.startTimes[q.id];
          const answered = session.answeredAt?.[q.id];
          // Prefer real per-question timing; fall back to an even split of total time.
          const timeSpent =
            seen && answered && answered > seen
              ? Math.round((answered - seen) / 1000)
              : Math.round(totalElapsed / answeredCount);
          const confidence = session.confidenceAnswers[q.id] || null;
          const correct = checkAnswer(q, userAnswer);

          return {
            qId: q.id,
            section: q.section,
            correct,
            timeSpent,
            confidence,
            subtopic: q.subtopic || q.topic || '',
            difficulty: q.difficulty,
            userAnswer,
            timestamp: new Date().toISOString(),
          };
        });

        return attempts;
      },

      endQuiz: () =>
        set({
          session: null,
          currentView: 'dashboard',
        }),

      resumeSession: (session) =>
        set({
          session: { ...session, revealed: session.revealed ?? {}, startedAt: session.startedAt ?? Date.now() },
          currentView: 'quiz',
          error: null,
        }),

      setView: (currentView) => set({ currentView }),
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),
    }),
    {
      name: 'faq-quiz-session',
      storage: createJSONStorage(() => sessionStorage), // Session only
      partialize: (state) => ({
        session: state.session,
        currentView: state.currentView,
      }),
    }
  )
);

// ============================= Questions Store =============================

export interface QuestionsState {
  questions: Question[];
  questionBank: Record<SectionCode, Question[]>;
  isLoaded: boolean;
  loadQuestions: (bank: Question[]) => void;
  getQuestionsBySection: (section: SectionCode) => Question[];
  getQuestionsByDifficulty: (difficulty: Difficulty) => Question[];
  getQuestionsBySubtopic: (section: SectionCode, subtopic: string) => Question[];
  getRandomQuestions: (count: number, filters?: { section?: SectionCode; difficulty?: Difficulty; subtopic?: string }) => Question[];
}

export const useQuestionsStore = create<QuestionsState>((set, get) => ({
  questions: [],
  questionBank: {
    DE: [],
    INV: [],
    NCA: [],
    INT: [],
    TAX: [],
    ACC: [],
    RPP: [],
    CAP: [],
    REC: [],
    CFS: [],
  },
  isLoaded: false,

  loadQuestions: (bank) => {
    const questions = normalizeQuestions(bank as Array<Partial<Question>>);
    const bySection: QuestionsState['questionBank'] = {
      DE: [], INV: [], NCA: [], INT: [], TAX: [], ACC: [], RPP: [], CAP: [], REC: [], CFS: [],
    };
    questions.forEach((q) => {
      if (bySection[q.section]) bySection[q.section].push(q);
    });
    set({ questions, questionBank: bySection, isLoaded: true });
  },

  getQuestionsBySection: (section) => get().questionBank[section] || [],

  getQuestionsByDifficulty: (difficulty) => get().questions.filter((q) => q.difficulty === difficulty),

  getQuestionsBySubtopic: (section, subtopic) =>
    get().questionBank[section]?.filter((q) => q.subtopic === subtopic) || [],

  getRandomQuestions: (count, filters) => {
    let pool = get().questions;

    if (filters?.section) {
      pool = pool.filter((q) => q.section === filters.section);
    }
    if (filters?.difficulty) {
      pool = pool.filter((q) => q.difficulty === filters.difficulty);
    }
    if (filters?.subtopic) {
      pool = pool.filter((q) => q.subtopic === filters.subtopic);
    }

    // Shuffle and take
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  },
}));

// ============================= Utility: Weighted Random Selection =============================

export function getWeightedRandomQuestions(
  questions: Question[],
  weights: Record<SectionCode, number>,
  totalCount: number
): Question[] {
  const bySection: Record<SectionCode, Question[]> = {
    DE: [],
    INV: [],
    NCA: [],
    INT: [],
    TAX: [],
    ACC: [],
    RPP: [],
    CAP: [],
    REC: [],
    CFS: [],
  };

  questions.forEach((q) => {
    if (bySection[q.section]) bySection[q.section].push(q);
  });

  const totalWeight = Object.values(weights).reduce((sum, w) => sum + w, 0);
  const result: Question[] = [];

  (Object.keys(weights) as SectionCode[]).forEach((section) => {
    const weight = weights[section] || 0;
    const sectionCount = Math.round((weight / totalWeight) * totalCount);
    const sectionQuestions = [...bySection[section]].sort(() => Math.random() - 0.5);
    result.push(...sectionQuestions.slice(0, sectionCount));
  });

  // If we're short, fill from remaining
  if (result.length < totalCount) {
    const usedIds = new Set(result.map((q) => q.id));
    const remaining = questions.filter((q) => !usedIds.has(q.id)).sort(() => Math.random() - 0.5);
    result.push(...remaining.slice(0, totalCount - result.length));
  }

  return result.slice(0, totalCount).sort(() => Math.random() - 0.5);
}

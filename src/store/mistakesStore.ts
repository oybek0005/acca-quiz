/**
 * Mistakes Store - Manages the mistakes bank with SRS integration
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { MistakeRecord, SectionCode, SRSCard, SRSQuality } from '@/types';
import {
  getSRSCard,
  recordSRSReview,
  getDueSRSCards,
  initSRSForMistakesData,
  getAllSRSCards,
  restoreSRSCards,
} from '@/lib/srs';

// ============================= Mistakes Store =============================

export interface MistakesState {
  mistakes: Record<string, MistakeRecord>;
  isLoaded: boolean;
  // Actions
  loadMistakes: (mistakes: Record<string, MistakeRecord>) => void;
  updateFromAttempts: (attempts: Array<{ qId: string; section: SectionCode; correct: boolean; timeSpent: number; confidence: 'low' | 'medium' | 'high' | null; subtopic: string; difficulty: 'easy' | 'medium' | 'hard'; timestamp: string }>) => void;
  getMistake: (qId: string) => MistakeRecord | undefined;
  getMistakesBySection: (section: SectionCode) => MistakeRecord[];
  getHighConfidenceErrors: () => MistakeRecord[];
  getSlowQuestions: (thresholdSeconds?: number) => MistakeRecord[];
  getSrsDueToday: () => MistakeRecord[];
  getTotalWrongCount: () => number;
  getRetryQuestions: (filter?: 'highConfidence' | 'slow' | 'srsDue' | 'all') => string[];
  clearMistake: (qId: string) => void;
  clearAllMistakes: () => void;
}

export const useMistakesStore = create<MistakesState>()(
  persist(
    (set, get) => ({
      mistakes: {},
      isLoaded: false,

      loadMistakes: (mistakes) => set({ mistakes, isLoaded: true }),

      updateFromAttempts: (attempts) =>
        set((state) => {
          const newMistakes = { ...state.mistakes };
          let hasChanges = false;

          attempts.forEach((attempt) => {
            const existing = newMistakes[attempt.qId];
            const isWrong = !attempt.correct;
            const timestamp = attempt.timestamp;

            if (!existing) {
              if (isWrong) {
                newMistakes[attempt.qId] = {
                  qId: attempt.qId,
                  section: attempt.section,
                  wrongCount: 1,
                  correctCount: 0,
                  lastResult: 'wrong',
                  lastTs: timestamp,
                  firstSeen: timestamp,
                  avgTimeSpent: attempt.timeSpent,
                  highConfidenceErrors: attempt.confidence === 'high' ? 1 : 0,
                  subtopics: {
                    [attempt.subtopic]: { wrong: 1, correct: 0 },
                  },
                };
                hasChanges = true;
              }
            } else {
              // Update existing
              const totalAttempts = existing.wrongCount + existing.correctCount + 1;
              const newAvgTime = (existing.avgTimeSpent * (totalAttempts - 1) + attempt.timeSpent) / totalAttempts;

              newMistakes[attempt.qId] = {
                ...existing,
                wrongCount: existing.wrongCount + (isWrong ? 1 : 0),
                correctCount: existing.correctCount + (isWrong ? 0 : 1),
                lastResult: isWrong ? 'wrong' : 'correct',
                lastTs: timestamp,
                avgTimeSpent: newAvgTime,
                highConfidenceErrors:
                  existing.highConfidenceErrors + (isWrong && attempt.confidence === 'high' ? 1 : 0),
                subtopics: {
                  ...existing.subtopics,
                  [attempt.subtopic]: {
                    wrong: (existing.subtopics[attempt.subtopic]?.wrong || 0) + (isWrong ? 1 : 0),
                    correct: (existing.subtopics[attempt.subtopic]?.correct || 0) + (isWrong ? 0 : 1),
                  },
                },
              };
              hasChanges = true;
            }
          });

          if (hasChanges) {
            // Seed SRS cards for any newly-recorded mistakes
            initSRSForMistakesData(newMistakes);
          }

          return { mistakes: newMistakes };
        }),

      getMistake: (qId) => get().mistakes[qId],

      getMistakesBySection: (section) =>
        Object.values(get().mistakes).filter((m) => m.section === section),

      getHighConfidenceErrors: () =>
        Object.values(get().mistakes).filter((m) => m.highConfidenceErrors > 0 && m.lastResult === 'wrong'),

      getSlowQuestions: (thresholdSeconds = 90) =>
        Object.values(get().mistakes).filter((m) => m.avgTimeSpent > thresholdSeconds && m.lastResult === 'wrong'),

      getSrsDueToday: () => {
        const dueCards = getDueSRSCards();
        const dueQIds = new Set(dueCards.map((d) => d.qId));
        return Object.values(get().mistakes).filter((m) => dueQIds.has(m.qId) && m.lastResult === 'wrong');
      },

      getTotalWrongCount: () =>
        Object.values(get().mistakes).reduce((sum, m) => sum + m.wrongCount, 0),

      getRetryQuestions: (filter = 'all') => {
        const mistakes = get().mistakes;
        switch (filter) {
          case 'highConfidence':
            return get().getHighConfidenceErrors().map((m) => m.qId);
          case 'slow':
            return get().getSlowQuestions().map((m) => m.qId);
          case 'srsDue':
            return get().getSrsDueToday().map((m) => m.qId);
          default:
            return Object.keys(mistakes).filter((qId) => mistakes[qId].lastResult === 'wrong');
        }
      },

      clearMistake: (qId) =>
        set((state) => {
          const newMistakes = { ...state.mistakes };
          delete newMistakes[qId];
          return { mistakes: newMistakes };
        }),

      clearAllMistakes: () => set({ mistakes: {} }),
    }),
    {
      name: 'faq-mistakes',
      storage: createJSONStorage(() => localStorage),
      version: 1,
    }
  )
);

// ============================= SRS Store =============================

export interface SRSState {
  cards: Record<string, SRSCard>;
  isLoaded: boolean;
  // Actions
  loadCards: (cards: Record<string, SRSCard>) => void;
  reviewCard: (qId: string, quality: SRSQuality) => SRSCard;
  getDueCards: () => Array<{ qId: string; card: SRSCard }>;
  getDueCount: () => number;
  getCard: (qId: string) => SRSCard | undefined;
  getCardStats: (qId: string) => { ease: number; interval: number; reps: number; dueDate: string | null; overdue: boolean; daysUntil: number; lastQuality: number | null; lastReviewed: string | null } | null;
  syncFromMistakes: () => void;
}

/**
 * SRS store. Single source of truth is the `faq_srs_v1` localStorage blob
 * managed by `@/lib/srs`; this store keeps an in-memory mirror for reactivity.
 * It is deliberately NOT wrapped in `persist` to avoid a second, diverging copy.
 */
export const useSRSStore = create<SRSState>()((set, get) => ({
  cards: {},
  isLoaded: false,

  loadCards: (cards) => {
    if (cards && Object.keys(cards).length > 0) {
      restoreSRSCards(cards);
    }
    set({ cards: getAllSRSCards(), isLoaded: true });
  },

  reviewCard: (qId, quality) => {
    const updated = recordSRSReview(qId, quality);
    set({ cards: getAllSRSCards() });
    return updated;
  },

  getDueCards: () => getDueSRSCards(),

  getDueCount: () => getDueSRSCards().length,

  getCard: (qId) => get().cards[qId] || getSRSCard(qId),

  getCardStats: (qId) => {
    const card = get().cards[qId] || getSRSCard(qId);
    if (!card.dueDate) return null;
    const due = new Date(card.dueDate);
    const now = new Date();
    const overdue = due < now;
    const daysUntil = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return {
      ease: card.ease,
      interval: card.interval,
      reps: card.reps,
      dueDate: card.dueDate,
      overdue,
      daysUntil,
      lastQuality: card.lastQuality,
      lastReviewed: card.lastReviewed,
    };
  },

  syncFromMistakes: () => {
    initSRSForMistakesData(useMistakesStore.getState().mistakes);
    set({ cards: getAllSRSCards() });
  },
}));

// ============================= Streak Store =============================

/** Data-only shape of the streak (no actions) — used for load/import/export. */
export interface StreakSnapshot {
  current: number;
  longest: number;
  lastDate: string | null; // YYYY-MM-DD
  target: number;
  todayCount: number;
  updatedAt: string;
}

export interface StreakState extends StreakSnapshot {
  // Actions
  loadStreak: (streak: Partial<StreakSnapshot>) => void;
  updateStreak: () => void;
  incrementTodayCount: () => void;
  getStats: () => {
    current: number;
    longest: number;
    target: number;
    todayCount: number;
    progress: number;
    isActiveToday: boolean;
  };
  setTarget: (target: number) => void;
}

function todayKey(): string {
  return new Date().toISOString().split('T')[0];
}

function daysAgoKey(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
}

export const useStreakStore = create<StreakState>()(
  persist(
    (set, get) => ({
      current: 0,
      longest: 0,
      lastDate: null,
      target: 20,
      todayCount: 0,
      updatedAt: new Date().toISOString(),

      loadStreak: (streak) => {
        const s = streak || {};
        const num = (v: unknown, fallback: number) =>
          typeof v === 'number' && Number.isFinite(v) ? v : fallback;
        set((prev) => ({
          current: Math.max(0, num(s.current, prev.current)),
          longest: Math.max(0, num(s.longest, prev.longest)),
          lastDate: typeof s.lastDate === 'string' ? s.lastDate : prev.lastDate,
          target: Math.max(1, Math.min(200, num(s.target, prev.target))),
          todayCount: Math.max(0, num(s.todayCount, prev.todayCount)),
          updatedAt: new Date().toISOString(),
        }));
      },

      updateStreak: () =>
        set((state) => {
          const today = todayKey();
          if (state.lastDate === today) return state;

          const yesterday = daysAgoKey(1);
          let current = state.current;

          if (state.lastDate === yesterday) {
            current += 1;
          } else {
            current = 1;
          }

          const longest = Math.max(current, state.longest);

          return {
            current,
            longest,
            lastDate: today,
            target: state.target,
            todayCount: 0,
            updatedAt: new Date().toISOString(),
          };
        }),

      incrementTodayCount: () =>
        set((state) => {
          const today = todayKey();
          let newState = { ...state };

          if (state.lastDate !== today) {
            // Update streak first
            const yesterday = daysAgoKey(1);
            let current = state.current;
            if (state.lastDate === yesterday) {
              current += 1;
            } else {
              current = 1;
            }
            const longest = Math.max(current, state.longest);
            newState = { ...state, current, longest, lastDate: today, todayCount: 0 };
          }

          return {
            ...newState,
            todayCount: (newState.todayCount || 0) + 1,
            updatedAt: new Date().toISOString(),
          };
        }),

      getStats: () => {
        const state = get();
        const today = todayKey();
        const isActiveToday = state.lastDate === today;
        const progress = state.target > 0 ? Math.min(100, Math.round((state.todayCount || 0) / state.target * 100)) : 0;
        return {
          current: state.current,
          longest: state.longest,
          target: state.target,
          todayCount: state.todayCount || 0,
          progress,
          isActiveToday,
        };
      },

      setTarget: (target) =>
        set((state) => ({
          ...state,
          target: Math.max(1, Math.min(200, Math.floor(target))),
          updatedAt: new Date().toISOString(),
        })),
    }),
    {
      name: 'faq-streak',
      storage: createJSONStorage(() => localStorage),
      version: 1,
    }
  )
);
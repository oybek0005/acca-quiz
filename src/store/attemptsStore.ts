/**
 * Attempts Store - Persistent history of every completed quiz.
 * Powers Recent Activity, daily stats, and progress charts.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Attempt, AttemptMode, QuestionAttempt, QuizMode } from '@/types';

const LS_KEY = 'faq_attempts_v1';
const MAX_ATTEMPTS = 500;

function newId(): string {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  } catch {}
  return `att-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function toAttemptMode(mode: QuizMode | AttemptMode): AttemptMode {
  switch (mode) {
    case 'srs':
      return 'srs';
    case 'flashcard':
      return 'flashcard';
    case 'mistakes':
      return 'quiz';
    default:
      return 'quiz';
  }
}

export interface AttemptsState {
  attempts: Attempt[];
  isLoaded: boolean;
  loadAttempts: (attempts: Attempt[]) => void;
  recordAttempt: (input: { mode: QuizMode | AttemptMode; sectionLabel: string; results: QuestionAttempt[] }) => Attempt;
  getRecent: (n?: number) => Attempt[];
  clearAttempts: () => void;
}

export const useAttemptsStore = create<AttemptsState>()(
  persist(
    (set, get) => ({
      attempts: [],
      isLoaded: false,

      loadAttempts: (attempts) =>
        set({ attempts: Array.isArray(attempts) ? attempts.slice(-MAX_ATTEMPTS) : [], isLoaded: true }),

      recordAttempt: ({ mode, sectionLabel, results }) => {
        const score = results.filter((r) => r.correct).length;
        const attempt: Attempt = {
          id: newId(),
          mode: toAttemptMode(mode),
          sectionLabel: sectionLabel || 'Quiz',
          ts: new Date().toISOString(),
          total: results.length,
          score,
          results,
        };
        set((state) => ({ attempts: [...state.attempts, attempt].slice(-MAX_ATTEMPTS) }));
        return attempt;
      },

      getRecent: (n = 10) => get().attempts.slice(-n).reverse(),

      clearAttempts: () => set({ attempts: [] }),
    }),
    {
      name: LS_KEY,
      storage: createJSONStorage(() => localStorage),
      version: 1,
      partialize: (state) => ({ attempts: state.attempts }),
      onRehydrateStorage: () => (state) => {
        if (state) state.isLoaded = true;
      },
    }
  )
);

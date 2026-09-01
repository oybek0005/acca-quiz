/**
 * Saved Quizzes - pause a quiz and pick it up later.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { QuizSession, SavedQuiz } from '@/types';

const LS_KEY = 'faq_saved_quizzes';
const MAX_SAVED = 20;

function newId(): string {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  } catch {}
  return `sq-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export interface SavedQuizState {
  saved: SavedQuiz[];
  save: (session: QuizSession, title?: string) => SavedQuiz;
  remove: (id: string) => void;
  get: (id: string) => SavedQuiz | undefined;
  clear: () => void;
}

export const useSavedQuizStore = create<SavedQuizState>()(
  persist(
    (set, get) => ({
      saved: [],

      save: (session, title) => {
        const answeredCount = Object.keys(session.answers).length;
        const entry: SavedQuiz = {
          id: newId(),
          title: title || session.title || 'Saved quiz',
          savedAt: new Date().toISOString(),
          session,
          answeredCount,
          total: session.questions.length,
        };
        set((s) => ({ saved: [entry, ...s.saved].slice(0, MAX_SAVED) }));
        return entry;
      },

      remove: (id) => set((s) => ({ saved: s.saved.filter((q) => q.id !== id) })),
      get: (id) => get().saved.find((q) => q.id === id),
      clear: () => set({ saved: [] }),
    }),
    {
      name: LS_KEY,
      storage: createJSONStorage(() => localStorage),
      version: 1,
    }
  )
);

/**
 * Insights history - written study analyses (imported from an AI report, or
 * generated locally). Newest last.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface Insight {
  id: string;
  ts: string; // ISO
  sourceLabel: string;
  summary: string;
  weakSections: string[];
  recommendations: string[];
}

function newId() {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  } catch {}
  return `ins-${Date.now().toString(36)}`;
}

export interface InsightsState {
  insights: Insight[];
  add: (i: Omit<Insight, 'id' | 'ts'> & { ts?: string }) => void;
  remove: (id: string) => void;
  latest: () => Insight | null;
  clear: () => void;
}

export const useInsightsStore = create<InsightsState>()(
  persist(
    (set, get) => ({
      insights: [],
      add: (i) =>
        set((s) => ({
          insights: [
            ...s.insights,
            { id: newId(), ts: i.ts || new Date().toISOString(), sourceLabel: i.sourceLabel, summary: i.summary, weakSections: i.weakSections, recommendations: i.recommendations },
          ].slice(-30),
        })),
      remove: (id) => set((s) => ({ insights: s.insights.filter((x) => x.id !== id) })),
      latest: () => {
        const arr = get().insights;
        return arr.length ? arr[arr.length - 1] : null;
      },
      clear: () => set({ insights: [] }),
    }),
    { name: 'faq_insights', storage: createJSONStorage(() => localStorage), version: 1 }
  )
);

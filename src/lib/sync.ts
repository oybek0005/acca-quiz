/**
 * Glue between the local zustand stores and the Firebase blob-sync helpers.
 */

import { useSettingsStore, useQuestionsStore } from '@/store/quizStore';
import { useMistakesStore, useSRSStore, useStreakStore } from '@/store/mistakesStore';
import { useAttemptsStore } from '@/store/attemptsStore';
import { getAllSRSCards, restoreSRSCards } from '@/lib/srs';
import { normalizeQuestions } from '@/lib/questions';
import type { Attempt, MistakeRecord, Question, SRSCard } from '@/types';
import type { SyncPayload } from '@/lib/firebase';

const CUSTOM_Q_KEY = 'faq_custom_questions';

function readCustomQuestions(): Question[] {
  try {
    return JSON.parse(localStorage.getItem(CUSTOM_Q_KEY) || '[]');
  } catch {
    return [];
  }
}

export function gatherLocalState(): SyncPayload {
  const s = useSettingsStore.getState();
  const streak = useStreakStore.getState();
  return {
    attempts: useAttemptsStore.getState().attempts,
    mistakes: useMistakesStore.getState().mistakes,
    srs: getAllSRSCards(),
    streak: {
      current: streak.current,
      longest: streak.longest,
      lastDate: streak.lastDate,
      target: streak.target,
      todayCount: streak.todayCount,
      updatedAt: streak.updatedAt,
    },
    customQuestions: readCustomQuestions(),
    settings: {
      theme: s.theme,
      quizMode: s.quizMode,
      showTimer: s.showTimer,
      requireConfidence: s.requireConfidence,
      dailyTarget: s.dailyTarget,
      soundEnabled: s.soundEnabled,
      animationsEnabled: s.animationsEnabled,
      sectionWeights: s.sectionWeights,
    },
  };
}

export function applyRemoteState(data: Partial<Record<keyof SyncPayload, unknown>>): string {
  const notes: string[] = [];

  if (Array.isArray(data.attempts)) {
    useAttemptsStore.getState().loadAttempts(data.attempts as Attempt[]);
    notes.push(`${(data.attempts as unknown[]).length} attempts`);
  }
  if (data.mistakes && typeof data.mistakes === 'object') {
    useMistakesStore.getState().loadMistakes(data.mistakes as Record<string, MistakeRecord>);
    notes.push(`${Object.keys(data.mistakes as object).length} mistakes`);
  }
  if (data.srs && typeof data.srs === 'object') {
    restoreSRSCards(data.srs as Record<string, SRSCard>);
    useSRSStore.getState().loadCards(data.srs as Record<string, SRSCard>);
    notes.push(`${Object.keys(data.srs as object).length} SRS cards`);
  }
  if (data.streak && typeof data.streak === 'object') {
    useStreakStore.getState().loadStreak(data.streak as never);
  }
  if (Array.isArray(data.customQuestions) && data.customQuestions.length > 0) {
    const custom = normalizeQuestions(data.customQuestions as Array<Partial<Question>>);
    localStorage.setItem(CUSTOM_Q_KEY, JSON.stringify(custom));
    const existing = useQuestionsStore.getState().questions;
    const seen = new Set(existing.map((q) => q.id));
    useQuestionsStore.getState().loadQuestions([...existing, ...custom.filter((q) => !seen.has(q.id))]);
    notes.push(`${custom.length} custom questions`);
  }
  if (data.settings && typeof data.settings === 'object') {
    const s = data.settings as Record<string, unknown>;
    const st = useSettingsStore.getState();
    if (s.theme) st.setTheme(s.theme as 'light' | 'dark' | 'system');
    if (s.quizMode) st.setQuizMode(s.quizMode as 'tutor' | 'exam');
    if (typeof s.showTimer === 'boolean') st.setShowTimer(s.showTimer);
    if (typeof s.requireConfidence === 'boolean') st.setRequireConfidence(s.requireConfidence);
    if (typeof s.dailyTarget === 'number') st.setDailyTarget(s.dailyTarget);
    if (typeof s.soundEnabled === 'boolean') st.setSoundEnabled(s.soundEnabled);
    if (typeof s.animationsEnabled === 'boolean') st.setAnimationsEnabled(s.animationsEnabled);
    if (s.sectionWeights) st.setSectionWeights(s.sectionWeights as never);
  }

  return notes.length ? `Pulled ${notes.join(', ')}.` : 'Nothing on the server for this device yet.';
}

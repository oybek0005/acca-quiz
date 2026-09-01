/**
 * SM-2 Spaced Repetition Engine
 * Implements the SuperMemo SM-2 algorithm with intervals: 1d, 3d, 7d, 14d, 30d+
 * Quality scale 0-5:
 *   0 = Complete blackout
 *   1 = Incorrect, but recognized answer
 *   2 = Incorrect, but seemed close
 *   3 = Correct with difficulty (hesitant)
 *   4 = Correct with slight hesitation
 *   5 = Perfect, instant recall
 */

import type { SRSCard, SRSQuality } from '@/types';

const LS_SRS = 'faq_srs_v1';

function loadJSON<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveJSON<T>(key: string, data: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save to localStorage:', e);
  }
}

function getSRSStore(): Record<string, SRSCard> {
  return loadJSON(LS_SRS, {});
}

function saveSRSStore(store: Record<string, SRSCard>): void {
  saveJSON(LS_SRS, store);
}

function defaultCard(qId = ''): SRSCard {
  return {
    qId,
    ease: 2.5,
    interval: 0,
    reps: 0,
    dueDate: null,
    lastQuality: null,
    lastReviewed: null,
  };
}

/* Core SM-2 update */
export function srsUpdate(card: SRSCard | null, quality: SRSQuality, qId?: string): SRSCard {
  const c: SRSCard = card ? { ...card } : defaultCard(qId);
  // Ensure qId is preserved
  c.qId = card?.qId ?? qId ?? c.qId;

  if (quality < 3) {
    // Reset on failure
    c.reps = 0;
    c.interval = 1;
  } else {
    if (c.reps === 0) {
      c.interval = 1;
    } else if (c.reps === 1) {
      c.interval = 3;
    } else {
      c.interval = Math.round(c.interval * c.ease);
    }
    c.reps++;
  }

  // Ease factor update (SM-2 formula)
  c.ease = Math.max(1.3, c.ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));

  // Due date
  const due = new Date();
  due.setDate(due.getDate() + c.interval);
  c.dueDate = due.toISOString();
  c.lastQuality = quality;
  c.lastReviewed = new Date().toISOString();

  return c;
}

/* Get card for a question (creates default if missing) */
export function getSRSCard(qId: string): SRSCard {
  const store = getSRSStore();
  return store[qId] || defaultCard(qId);
}

/* Set card after review */
export function setSRSCard(qId: string, card: SRSCard): void {
  const store = getSRSStore();
  store[qId] = card;
  saveSRSStore(store);
}

/* Record a review outcome for a question (quality 0-5) */
export function recordSRSReview(qId: string, quality: SRSQuality): SRSCard {
  const card = getSRSCard(qId);
  const updated = srsUpdate(card, quality, qId);
  updated.qId = qId;
  setSRSCard(qId, updated);
  return updated;
}

/* Get all cards due for review (dueDate <= now) */
export function getDueSRSCards(): Array<{ qId: string; card: SRSCard }> {
  const store = getSRSStore();
  const now = new Date();
  const due: Array<{ qId: string; card: SRSCard }> = [];

  Object.keys(store).forEach((qId) => {
    const card = store[qId];
    if (card.dueDate && new Date(card.dueDate) <= now) {
      due.push({ qId, card });
    }
  });

  // Sort by most overdue first
  due.sort((a, b) => new Date(a.card.dueDate!).getTime() - new Date(b.card.dueDate!).getTime());
  return due;
}

/* Get count of cards due today */
export function countDueSRSCards(): number {
  return getDueSRSCards().length;
}

/* Get SRS stats for a specific question (for Mistakes view) */
export function getSRSStatsForQuestion(qId: string): {
  ease: number;
  interval: number;
  reps: number;
  dueDate: string | null;
  overdue: boolean;
  daysUntil: number;
  lastQuality: number | null;
  lastReviewed: string | null;
} | null {
  const card = getSRSCard(qId);
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
}

/* Initialize SRS cards for all current mistakes.
   New cards are seeded as *due now* so the first review can happen immediately. */
export function initSRSForMistakesData(mistakes: Record<string, { lastResult: string }>): number {
  const store = getSRSStore();
  let created = 0;
  const nowIso = new Date().toISOString();

  Object.keys(mistakes).forEach((qId) => {
    if (mistakes[qId].lastResult === 'wrong' && !store[qId]) {
      store[qId] = {
        qId,
        ease: 2.5,
        interval: 0,
        reps: 0,
        dueDate: nowIso, // due immediately
        lastQuality: null,
        lastReviewed: null,
      };
      created++;
    }
  });

  if (created) saveSRSStore(store);
  return created;
}

/* Get all SRS cards (for export/backup) */
export function getAllSRSCards(): Record<string, SRSCard> {
  return getSRSStore();
}

/* Restore SRS from backup */
export function restoreSRSCards(data: Record<string, SRSCard> | null): void {
  saveSRSStore(data || {});
}

/* Quality labels for UI */
export const QUALITY_LABELS: Record<SRSQuality, string> = {
  0: 'Complete blackout',
  1: 'Incorrect, recognized',
  2: 'Incorrect, seemed close',
  3: 'Correct with difficulty',
  4: 'Correct, slight hesitation',
  5: 'Perfect, instant recall',
};

export const QUALITY_BUTTONS: Array<{ quality: SRSQuality; label: string; short: string; color: string }> = [
  { quality: 0, label: 'Complete blackout', short: 'Again', color: '#ef4444' },
  { quality: 1, label: 'Incorrect, recognized', short: 'Hard', color: '#f97316' },
  { quality: 2, label: 'Incorrect, seemed close', short: 'Hard', color: '#f97316' },
  { quality: 3, label: 'Correct with difficulty', short: 'Good', color: '#eab308' },
  { quality: 4, label: 'Correct, slight hesitation', short: 'Good', color: '#22c55e' },
  { quality: 5, label: 'Perfect, instant recall', short: 'Easy', color: '#22c55e' },
];

/* Canonical 4-button rating UI (Again / Hard / Good / Easy).
   Used by Flashcards, the SRS session, and the Mistakes list so the mapping
   from a click to an SM-2 quality is identical everywhere. */
export const SRS_RATING_BUTTONS: Array<{
  quality: SRSQuality;
  label: string;
  description: string;
  /* tailwind classes for a solid button */
  solid: string;
  /* tailwind classes for a soft button */
  soft: string;
}> = [
  { quality: 0, label: 'Again', description: 'Forgot it', solid: 'bg-red-600 hover:bg-red-700 text-white', soft: 'bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900/40 dark:text-red-300' },
  { quality: 2, label: 'Hard', description: 'Barely got it', solid: 'bg-orange-500 hover:bg-orange-600 text-white', soft: 'bg-orange-100 text-orange-800 hover:bg-orange-200 dark:bg-orange-900/40 dark:text-orange-300' },
  { quality: 4, label: 'Good', description: 'Recalled it', solid: 'bg-blue-600 hover:bg-blue-700 text-white', soft: 'bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-300' },
  { quality: 5, label: 'Easy', description: 'Instant recall', solid: 'bg-green-600 hover:bg-green-700 text-white', soft: 'bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900/40 dark:text-green-300' },
];

/* Convert quality to button index (0-3 for 4-button UI: Again/Hard/Good/Easy) */
export function qualityToButtonIndex(quality: SRSQuality): 0 | 1 | 2 | 3 {
  if (quality <= 1) return 0; // Again
  if (quality === 2) return 1; // Hard
  if (quality <= 4) return 2; // Good
  return 3; // Easy
}

/* Convert button index to quality */
export function buttonIndexToQuality(index: 0 | 1 | 2 | 3): SRSQuality {
  switch (index) {
    case 0: return 0; // Again
    case 1: return 2; // Hard
    case 2: return 4; // Good
    case 3: return 5; // Easy
    default: return 3;
  }
}
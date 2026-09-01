/**
 * One-time seed of prior progress carried over from the old quiz app.
 *
 * The data in `@/data/seed.json` was exported from the previous (static HTML)
 * quiz app and converted to this app's schema. It is loaded into the stores
 * exactly once — on the first run in a browser that has no progress yet — and
 * guarded by a localStorage flag so it never re-applies (e.g. after the user
 * deliberately clears their progress).
 */

import type { Attempt, MistakeRecord } from '@/types';
import { useAttemptsStore } from '@/store/attemptsStore';
import { useMistakesStore, useSRSStore } from '@/store/mistakesStore';
import seedData from '@/data/seed.json';

const SEED_FLAG = 'faq_seed_v1';

interface SeedFile {
  attempts: Attempt[];
  mistakes: Record<string, MistakeRecord>;
}

export function applySeedIfNeeded(): void {
  if (typeof window === 'undefined') return;

  try {
    if (localStorage.getItem(SEED_FLAG)) return;
  } catch {
    return; // storage unavailable — skip silently
  }

  const attemptsState = useAttemptsStore.getState();
  const mistakesState = useMistakesStore.getState();

  // Never overwrite real progress the user already has.
  const hasProgress =
    attemptsState.attempts.length > 0 || Object.keys(mistakesState.mistakes).length > 0;

  const seed = seedData as unknown as SeedFile;

  if (!hasProgress) {
    if (Array.isArray(seed.attempts) && seed.attempts.length) {
      attemptsState.loadAttempts(seed.attempts);
    }
    if (seed.mistakes && Object.keys(seed.mistakes).length) {
      mistakesState.loadMistakes(seed.mistakes);
      useSRSStore.getState().syncFromMistakes();
    }
  }

  try {
    localStorage.setItem(SEED_FLAG, new Date().toISOString());
  } catch {
    /* ignore */
  }
}

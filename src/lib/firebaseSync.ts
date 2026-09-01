/**
 * Auto-sync wiring for the optional Firebase cloud backup.
 *
 * When the user turns "Auto-sync" on (and is signed in):
 *   1. on startup we PULL the cloud copy first (it is the source of truth across
 *      devices), so a browser whose cache was cleared is restored, not overwritten;
 *   2. after that, every change to attempts / mistakes / streak / settings is
 *      pushed back up, debounced;
 *   3. a final push is attempted when the tab is hidden or closed.
 */

import { useSettingsStore } from '@/store/quizStore';
import { useMistakesStore, useStreakStore } from '@/store/mistakesStore';
import { useAttemptsStore } from '@/store/attemptsStore';
import { currentUser, onAuthChange, pullState, pushState } from '@/lib/firebase';
import { gatherLocalState, applyRemoteState } from '@/lib/sync';

const AUTOSYNC_KEY = 'faq_firebase_autosync';
const DEBOUNCE_MS = 4000;

export function isAutoSyncEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(AUTOSYNC_KEY) === '1';
  } catch {
    return false;
  }
}

export function setAutoSyncEnabled(on: boolean): void {
  try {
    if (on) localStorage.setItem(AUTOSYNC_KEY, '1');
    else localStorage.removeItem(AUTOSYNC_KEY);
  } catch {
    /* ignore */
  }
}

/** Push the current local state now. Throws if not signed in. */
export async function syncNow(): Promise<void> {
  await pushState(gatherLocalState());
}

let started = false;

/**
 * Idempotent. Call once from the app shell. Returns a cleanup function.
 */
export function startAutoSync(): () => void {
  if (started || typeof window === 'undefined') return () => {};
  started = true;

  let armed = false; // change-listeners push only after the initial pull
  let dirty = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const unsubs: Array<() => void> = [];

  const flush = async () => {
    if (!dirty || !isAutoSyncEnabled() || !currentUser()) return;
    dirty = false;
    try {
      await pushState(gatherLocalState());
    } catch {
      dirty = true; // retry on the next trigger
    }
  };

  const schedule = () => {
    if (!armed || !isAutoSyncEnabled() || !currentUser()) return;
    dirty = true;
    if (timer) clearTimeout(timer);
    timer = setTimeout(flush, DEBOUNCE_MS);
  };

  const armChangeListeners = () => {
    if (armed) return;
    armed = true;
    unsubs.push(useAttemptsStore.subscribe(schedule));
    unsubs.push(useMistakesStore.subscribe(schedule));
    unsubs.push(useStreakStore.subscribe(schedule));
    unsubs.push(useSettingsStore.subscribe(schedule));
  };

  const onSignedIn = async () => {
    if (!isAutoSyncEnabled()) return;
    try {
      const remote = await pullState();
      if (remote) applyRemoteState(remote.payload);
      else await pushState(gatherLocalState());
    } catch {
      /* offline / rules — user can still push manually */
    } finally {
      armChangeListeners();
    }
  };

  unsubs.push(
    onAuthChange((user) => {
      if (user) void onSignedIn();
    })
  );

  const onHide = () => {
    if (document.visibilityState === 'hidden') void flush();
  };
  document.addEventListener('visibilitychange', onHide);
  window.addEventListener('pagehide', onHide);
  unsubs.push(() => {
    document.removeEventListener('visibilitychange', onHide);
    window.removeEventListener('pagehide', onHide);
  });

  return () => {
    if (timer) clearTimeout(timer);
    unsubs.forEach((u) => {
      try {
        u();
      } catch {
        /* ignore */
      }
    });
    started = false;
  };
}

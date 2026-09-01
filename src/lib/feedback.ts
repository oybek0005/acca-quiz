/**
 * Lightweight audio feedback via the Web Audio API — no asset files.
 */

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new AC();
    }
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, durationMs: number, when = 0) {
  const ac = getCtx();
  if (!ac) return;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  const t0 = ac.currentTime + when;
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(0.15, t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + durationMs / 1000);
  osc.connect(gain).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + durationMs / 1000);
}

export function playCorrect(enabled: boolean) {
  if (!enabled) return;
  tone(660, 90);
  tone(880, 130, 0.09);
}

export function playIncorrect(enabled: boolean) {
  if (!enabled) return;
  tone(220, 180);
}

export function playComplete(enabled: boolean) {
  if (!enabled) return;
  tone(523, 100);
  tone(659, 100, 0.1);
  tone(784, 180, 0.2);
}

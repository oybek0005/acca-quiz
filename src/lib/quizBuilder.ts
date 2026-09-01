/**
 * Builds a question set for a quiz from a user configuration:
 * which sections, how many, which difficulty, and how to weight sections.
 */

import type { Question, SectionCode, Difficulty } from '@/types';
import { SECTION_ORDER, SECTIONS } from '@/types';

export type Weighting = 'even' | 'exam' | 'custom';

export interface QuizConfig {
  sections: SectionCode[]; // empty = all
  count: number;
  difficulty: Difficulty | 'any';
  weighting: Weighting;
  customWeights?: Record<SectionCode, number>;
}

export const DEFAULT_CONFIG: QuizConfig = {
  sections: [],
  count: 20,
  difficulty: 'any',
  weighting: 'exam',
};

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** How many questions each section holds, after the difficulty filter. */
export function sectionCounts(all: Question[], difficulty: QuizConfig['difficulty']): Record<SectionCode, number> {
  const counts = Object.fromEntries(SECTION_ORDER.map((s) => [s, 0])) as Record<SectionCode, number>;
  for (const q of all) {
    if (q.t === 'fs') continue; // fs questions have their own launcher, not the section mix
    if (difficulty !== 'any' && q.difficulty !== difficulty) continue;
    if (counts[q.section] !== undefined) counts[q.section] += 1;
  }
  return counts;
}

export function buildQuiz(all: Question[], cfg: QuizConfig): Question[] {
  const wantSections = cfg.sections.length ? cfg.sections : [...SECTION_ORDER];

  // fs questions are 15–30-mark drills — never fold them into a mixed/section quiz.
  let pool = all.filter((q) => q.t !== 'fs' && wantSections.includes(q.section));
  if (cfg.difficulty !== 'any') pool = pool.filter((q) => q.difficulty === cfg.difficulty);
  if (pool.length === 0) return [];

  const target = Math.min(cfg.count, pool.length);

  // Group by section
  const bySection: Partial<Record<SectionCode, Question[]>> = {};
  for (const q of pool) (bySection[q.section] ??= []).push(q);

  // Section weights
  const weights: Record<string, number> = {};
  for (const s of wantSections) {
    if (!bySection[s]?.length) continue;
    if (cfg.weighting === 'even') weights[s] = 1;
    else if (cfg.weighting === 'custom') weights[s] = cfg.customWeights?.[s] ?? 0;
    else weights[s] = SECTIONS[s].weight; // exam
  }
  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0) || 1;

  const picked: Question[] = [];
  const used = new Set<string>();

  for (const s of wantSections) {
    const avail = bySection[s];
    if (!avail?.length) continue;
    const want = Math.round((weights[s] / totalWeight) * target);
    for (const q of shuffle(avail).slice(0, want)) {
      picked.push(q);
      used.add(q.id);
    }
  }

  // Top up (or trim) to exactly `target`
  if (picked.length < target) {
    for (const q of shuffle(pool.filter((q) => !used.has(q.id)))) {
      if (picked.length >= target) break;
      picked.push(q);
    }
  }

  return shuffle(picked).slice(0, target);
}

/**
 * Backup / restore. One JSON file holds all local progress.
 * Import is defensive: size-capped, prototype-pollution-safe, schema-checked.
 */

import type { Attempt, MistakeRecord, Question, SRSCard, StreakState as StreakSnapshot } from '@/types';
import { normalizeQuestions } from '@/lib/questions';

export const BACKUP_VERSION = 3;
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

export interface BackupFile {
  version: number;
  exportedAt: string;
  app: 'acca-fa-quizapp';
  questions: Question[]; // custom questions only
  attempts: Attempt[];
  mistakes: Record<string, MistakeRecord>;
  srs: Record<string, SRSCard>;
  streak: StreakSnapshot | null;
  settings: Record<string, unknown> | null;
}

const BLOCKED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/** JSON.parse with a reviver that drops dangerous keys. */
function safeParse(text: string): unknown {
  return JSON.parse(text, (key, value) => (BLOCKED_KEYS.has(key) ? undefined : value));
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function buildBackup(input: {
  customQuestions: Question[];
  attempts: Attempt[];
  mistakes: Record<string, MistakeRecord>;
  srs: Record<string, SRSCard>;
  streak: StreakSnapshot;
  settings: Record<string, unknown>;
}): BackupFile {
  // Never export secrets: the AI API key and the Firebase config live in their
  // own localStorage keys, not in `settings`, so nothing extra to strip here.
  const safeSettings = { ...(input.settings as Record<string, unknown>) };
  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    app: 'acca-fa-quizapp',
    questions: input.customQuestions,
    attempts: input.attempts,
    mistakes: input.mistakes,
    srs: input.srs,
    streak: input.streak,
    settings: safeSettings,
  };
}

export interface ParsedBackup {
  customQuestions: Question[];
  attempts: Attempt[];
  mistakes: Record<string, MistakeRecord>;
  srs: Record<string, SRSCard>;
  streak: StreakSnapshot | null;
  settings: Record<string, unknown> | null;
  summary: string;
}

export function parseBackup(text: string): ParsedBackup {
  if (text.length > MAX_BYTES) {
    throw new Error(`Backup file is too large (max ${Math.round(MAX_BYTES / 1024 / 1024)} MB).`);
  }

  let data: unknown;
  try {
    data = safeParse(text);
  } catch {
    throw new Error('That file is not valid JSON.');
  }
  if (!isPlainObject(data)) throw new Error('Unrecognised backup format.');
  if (data.version && Number(data.version) > BACKUP_VERSION + 1) {
    throw new Error('This backup was made by a newer version of the app.');
  }

  const customQuestions = Array.isArray(data.questions)
    ? normalizeQuestions(data.questions as Array<Partial<Question>>)
    : [];
  const attempts = Array.isArray(data.attempts) ? (data.attempts as Attempt[]).filter(isPlainObject) : [];
  const mistakes = isPlainObject(data.mistakes) ? (data.mistakes as Record<string, MistakeRecord>) : {};
  const srs = isPlainObject(data.srs) ? (data.srs as Record<string, SRSCard>) : {};
  const streak = isPlainObject(data.streak) ? (data.streak as unknown as StreakSnapshot) : null;
  const settings = isPlainObject(data.settings) ? (data.settings as Record<string, unknown>) : null;

  const summary = [
    `${customQuestions.length} custom questions`,
    `${attempts.length} attempts`,
    `${Object.keys(mistakes).length} mistakes`,
    `${Object.keys(srs).length} SRS cards`,
  ].join(', ');

  return { customQuestions, attempts, mistakes, srs, streak, settings, summary };
}

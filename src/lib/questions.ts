/**
 * Question helpers — the single source of truth for answer checking and
 * rendering an answer as text. Both the quiz store and the UI import from here
 * so grading can never disagree with itself.
 */

import type { Difficulty, FSAnswers, Question } from '@/types';
import { gradeFS } from '@/lib/fsGrading';

const VALID_DIFF: Difficulty[] = ['easy', 'medium', 'hard'];

/**
 * Fill in fields the raw question bank may be missing (`difficulty`, `topic`,
 * `source`) so the rest of the app can treat every question uniformly.
 * A quick heuristic assigns difficulty from question type + text length.
 */
type LooseQuestion = Record<string, unknown>;

export function normalizeQuestion(raw: LooseQuestion): Question {
  const q = { ...raw } as unknown as Question;
  if (!q.difficulty || !VALID_DIFF.includes(q.difficulty)) {
    q.difficulty = inferDifficulty(q);
  }
  if (q.topic == null) q.topic = undefined;
  if (!q.subtopic) q.subtopic = q.topic || undefined;
  if (!q.source) q.source = 'original';
  if (!Array.isArray(q.opt)) delete (q as { opt?: unknown }).opt;
  return q;
}

export function normalizeQuestions(list: LooseQuestion[]): Question[] {
  return (list || [])
    .filter((q) => q && q.id && q.t && q.section)
    // an fs question is useless without its line list
    .filter((q) => q.t !== 'fs' || (Array.isArray(q.lines) && q.lines.length > 0))
    .map(normalizeQuestion);
}

function inferDifficulty(q: { t?: string; q?: string }): Difficulty {
  const len = (q.q || '').replace(/<[^>]*>/g, '').length;
  if (q.t === 'fs') return 'hard';
  if (q.t === 'multi' || q.t === 'manual') return 'hard';
  if (q.t === 'numeric') return len > 160 ? 'hard' : 'medium';
  if (q.t === 'tf') return 'easy';
  // mcq
  if (len > 220) return 'hard';
  if (len > 110) return 'medium';
  return 'easy';
}

/** Correct option indices for a multi-select question (tolerates missing `multi_correct`). */
export function multiCorrectIndices(q: Question): number[] {
  if (q.t !== 'multi') return [];
  if (Array.isArray(q.multi_correct) && q.multi_correct.length > 0) return [...q.multi_correct];
  if (Array.isArray(q.a)) return [...(q.a as number[])];
  return [];
}

function numbersClose(a: number, b: number): boolean {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  const diff = Math.abs(a - b);
  if (diff < 0.01) return true;
  // relative tolerance for large accounting figures (rounding to nearest unit)
  return diff / Math.max(Math.abs(a), Math.abs(b), 1) < 0.001;
}

/**
 * Grade a user's answer.
 * `manual` questions cannot be auto-graded: a non-empty response counts as
 * correct (self-study), an empty one as wrong — so they never silently
 * pollute the mistake bank for an engaged learner.
 */
export function checkAnswer(question: Question, userAnswer: unknown): boolean {
  if (question.t === 'manual') {
    return typeof userAnswer === 'string' && userAnswer.trim().length > 0;
  }
  if (question.t === 'fs') {
    // "Correct" for progress tracking = passed ACCA's 50% mark on the statements.
    return gradeFS(question, (userAnswer as FSAnswers) || {}).passed;
  }
  if (userAnswer === undefined || userAnswer === null) return false;

  switch (question.t) {
    case 'mcq':
      return userAnswer === question.a;
    case 'tf':
      return userAnswer === question.a;
    case 'numeric':
      return numbersClose(Number(userAnswer), Number(question.a));
    case 'multi': {
      const user = Array.isArray(userAnswer) ? (userAnswer as number[]) : [userAnswer as number];
      const correct = multiCorrectIndices(question);
      if (user.length !== correct.length) return false;
      const userSet = new Set(user);
      return correct.every((i) => userSet.has(i)); // order-independent
    }
    default:
      return false;
  }
}

/** Is this question type auto-gradable? */
export function isAutoGraded(question: Question): boolean {
  return question.t !== 'manual';
}

/** Human-readable correct answer, for flashcards / review lists. */
export function answerText(question: Question): string {
  switch (question.t) {
    case 'mcq':
      return question.opt?.[question.a] ?? String(question.a);
    case 'tf':
      return question.a ? 'True' : 'False';
    case 'numeric':
      return Number(question.a).toLocaleString();
    case 'multi': {
      const idx = multiCorrectIndices(question);
      const labels = idx.map((i) => question.opt?.[i]).filter(Boolean) as string[];
      return labels.length ? labels.join('  •  ') : idx.join(', ');
    }
    case 'manual':
      return stripHtml(question.ex) || 'See model answer';
    case 'fs':
      return 'See the model SPL and SOFP';
    default:
      return '';
  }
}

export function stripHtml(html: string): string {
  return String(html || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Grading for the "financial statements construction" (fs) question type.
 *
 * The learner builds a full Statement of Profit or Loss and Statement of
 * Financial Position from a trial balance + adjustment notes, typing every
 * figure (including subtotals) into a fixed proforma. Each line is marked
 * independently against its `correctValue`.
 *
 *  - default ("exact")   → line is right only if it matches correctValue
 *  - "ofr" coaching mode  → a wrong *subtotal* still scores if the learner
 *                           combined their OWN entered figures correctly
 */

import type { FSAnswers, FSLine, FSQuestion } from '@/types';

export type FSVerdict = 'correct' | 'ofr-credit' | 'incorrect' | 'blank';
export type FSMode = 'exact' | 'ofr';

export interface FSLineResult {
  verdict: FSVerdict;
  marksAwarded: number;
  marksAvailable: number;
  entered: number | null;
  expected: number;
}

export interface FSResult {
  lineResults: Record<string, FSLineResult>;
  scoredMarks: number;
  totalMarks: number;
  percentage: number;
  passed: boolean; // ACCA FA pass mark = 50%
  correctLines: number;
  totalLines: number;
}

export function fsLineMarks(line: FSLine): number {
  return typeof line.marks === 'number' && line.marks > 0 ? line.marks : 1;
}

export function fsTotalMarks(question: FSQuestion): number {
  return (question.lines || []).reduce((sum, l) => sum + fsLineMarks(l), 0);
}

function hasValue(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/**
 * Grade a learner's FS answer.
 * `answers` maps line id → entered number (or null / missing for blank).
 */
export function gradeFS(
  question: FSQuestion,
  answers: FSAnswers | undefined | null,
  opts: { mode?: FSMode } = {}
): FSResult {
  const mode: FSMode = opts.mode === 'ofr' ? 'ofr' : 'exact';
  const tolerance = typeof question.tolerance === 'number' ? Math.abs(question.tolerance) : 0;
  const lines = question.lines || [];
  const byId: Record<string, FSLine> = Object.fromEntries(lines.map((l) => [l.id, l]));
  const entered: Record<string, number> = {};
  const lineResults: Record<string, FSLineResult> = {};

  for (const line of lines) {
    const marksAvailable = fsLineMarks(line);
    const raw = answers ? answers[line.id] : undefined;
    let verdict: FSVerdict = 'blank';
    let marksAwarded = 0;

    if (hasValue(raw)) {
      entered[line.id] = raw;
      const exact = Math.abs(raw - line.correctValue) <= tolerance;

      if (exact) {
        verdict = 'correct';
        marksAwarded = marksAvailable;
      } else if (mode === 'ofr' && line.kind === 'subtotal' && line.formula && line.formula.length) {
        const ofrExpected = line.formula.reduce((total, term) => {
          const dep = entered[term.lineId] ?? byId[term.lineId]?.correctValue ?? 0;
          return term.op === '-' ? total - dep : total + dep;
        }, 0);
        if (Math.abs(raw - ofrExpected) <= tolerance) {
          verdict = 'ofr-credit';
          marksAwarded = marksAvailable;
        } else {
          verdict = 'incorrect';
        }
      } else {
        verdict = 'incorrect';
      }
    }

    lineResults[line.id] = {
      verdict,
      marksAwarded,
      marksAvailable,
      entered: hasValue(raw) ? raw : null,
      expected: line.correctValue,
    };
  }

  const totalMarks = fsTotalMarks(question);
  const scoredMarks = Object.values(lineResults).reduce((s, r) => s + r.marksAwarded, 0);
  const correctLines = Object.values(lineResults).filter(
    (r) => r.verdict === 'correct' || r.verdict === 'ofr-credit'
  ).length;

  return {
    lineResults,
    scoredMarks,
    totalMarks,
    percentage: totalMarks > 0 ? Math.round((scoredMarks / totalMarks) * 100) : 0,
    passed: totalMarks > 0 && scoredMarks / totalMarks >= 0.5,
    correctLines,
    totalLines: lines.length,
  };
}

/** True when the two "balancing" totals the learner entered agree (UX indicator, not scored). */
export function fsEnteredBalances(
  question: FSQuestion,
  answers: FSAnswers | undefined | null
): { assets: number | null; equityAndLiabilities: number | null; balanced: boolean } {
  if (!answers) return { assets: null, equityAndLiabilities: null, balanced: false };
  const findVal = (re: RegExp) => {
    const line = (question.lines || []).find((l) => l.statement === 'SOFP' && re.test(l.label));
    const v = line ? answers[line.id] : undefined;
    return hasValue(v) ? v : null;
  };
  const assets = findVal(/total assets/i);
  const equityAndLiabilities = findVal(/total equity and liabilities/i);
  return {
    assets,
    equityAndLiabilities,
    balanced: assets !== null && equityAndLiabilities !== null && Math.abs(assets - equityAndLiabilities) < 0.01,
  };
}

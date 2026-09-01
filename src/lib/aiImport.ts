/**
 * Ingest an AI-generated report about a mock exam / PDF paper.
 *
 * Expected shape (also accepts the legacy `faq_claude_import_v1`):
 * {
 *   "type": "faq_ai_report_v1",
 *   "sourceLabel": "Mock exam 2",
 *   "results": [
 *     { "qId": "DE05", "correct": false },
 *     { "qId": "P-1", "correct": false, "newQuestion": { "t":"mcq","q":"...","opt":[...],"a":1,"ex":"...","section":"DE","topic":"...","difficulty":"medium" } }
 *   ],
 *   "questionFixes": [ { "qId": "TAX12", "issue": "...", "fix": { "a": 2, "ex": "..." } } ],
 *   "insight": { "summary": "...", "recommendations": ["..."], "weakSections": ["DE"] }
 * }
 */

import type { Question, SectionCode } from '@/types';
import { SECTION_ORDER } from '@/types';
import { normalizeQuestion } from '@/lib/questions';
import { useMistakesStore } from '@/store/mistakesStore';
import { useSRSStore } from '@/store/mistakesStore';
import { useAttemptsStore } from '@/store/attemptsStore';
import { useQuestionsStore } from '@/store/quizStore';
import { useInsightsStore } from '@/store/insightsStore';

const CUSTOM_Q_KEY = 'faq_custom_questions';
const FIXES_KEY = 'faq_question_fixes';
const VALID_TYPES = ['mcq', 'multi', 'tf', 'numeric', 'manual'];

export interface AiReport {
  type?: string;
  sourceLabel?: string;
  generatedAt?: string;
  results?: Array<{
    qId: string;
    correct?: boolean;
    section?: string;
    newQuestion?: Partial<Question>;
  }>;
  questionFixes?: Array<{ qId: string; issue?: string; fix: Record<string, unknown> }>;
  insight?: { summary?: string; recommendations?: string[]; weakSections?: string[] };
  insights?: { summary?: string; recommendations?: string[]; weakSections?: string[] }; // legacy
}

export interface ApplyResult {
  gradedCount: number;
  newQuestions: number;
  fixes: number;
  insightAdded: boolean;
  warnings: string[];
}

function readCustom(): Question[] {
  try {
    return JSON.parse(localStorage.getItem(CUSTOM_Q_KEY) || '[]');
  } catch {
    return [];
  }
}
function writeCustom(list: Question[]) {
  localStorage.setItem(CUSTOM_Q_KEY, JSON.stringify(list));
}

export function readQuestionFixes(): Record<string, Record<string, unknown>> {
  try {
    const v = JSON.parse(localStorage.getItem(FIXES_KEY) || '{}');
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}
function writeQuestionFixes(map: Record<string, Record<string, unknown>>) {
  localStorage.setItem(FIXES_KEY, JSON.stringify(map));
}

export function parseAiReport(text: string): AiReport {
  const data = JSON.parse(text);
  if (!data || typeof data !== 'object') throw new Error('Not a JSON object.');
  const t = (data as AiReport).type;
  if (t && t !== 'faq_ai_report_v1' && t !== 'faq_claude_import_v1') {
    throw new Error(`Unknown report type "${t}".`);
  }
  return data as AiReport;
}

export function applyAiReport(report: AiReport): ApplyResult {
  const warnings: string[] = [];
  const res: ApplyResult = { gradedCount: 0, newQuestions: 0, fixes: 0, insightAdded: false, warnings };

  const custom = readCustom();
  const known = new Map(useQuestionsStore.getState().questions.map((q) => [q.id, q]));
  const graded: Array<{ qId: string; section: SectionCode; correct: boolean; timeSpent: number; confidence: null; subtopic: string; difficulty: Question['difficulty']; timestamp: string }> = [];

  for (const r of report.results ?? []) {
    if (!r?.qId) {
      warnings.push('A result without a qId was skipped.');
      continue;
    }
    let section: SectionCode = (r.section as SectionCode) || 'DE';
    let difficulty: Question['difficulty'] = 'medium';
    let subtopic = '';

    if (r.newQuestion) {
      const nq = r.newQuestion;
      const type = nq.t && VALID_TYPES.includes(nq.t) ? nq.t : 'manual';
      if (!custom.some((x) => x.id === r.qId) && !known.has(r.qId)) {
        const q = normalizeQuestion({
          ...(nq as Record<string, unknown>),
          id: r.qId,
          t: (type === 'mcq' || type === 'multi') && !Array.isArray(nq.opt) ? 'manual' : type,
          section: (nq.section as SectionCode) || section,
          source: 'ai-generated',
        });
        custom.push(q);
        res.newQuestions++;
        section = q.section;
        difficulty = q.difficulty;
        subtopic = q.subtopic || q.topic || '';
      }
    } else {
      const existing = known.get(r.qId) || custom.find((x) => x.id === r.qId);
      if (existing) {
        section = existing.section;
        difficulty = existing.difficulty;
        subtopic = existing.subtopic || existing.topic || '';
      } else {
        warnings.push(`Unknown qId (no newQuestion given): ${r.qId}`);
      }
    }

    graded.push({
      qId: r.qId,
      section: SECTION_ORDER.includes(section) ? section : 'DE',
      correct: !!r.correct,
      timeSpent: 0,
      confidence: null,
      subtopic,
      difficulty,
      timestamp: new Date().toISOString(),
    });
  }

  if (res.newQuestions > 0) {
    writeCustom(custom);
    const existing = useQuestionsStore.getState().questions;
    const seen = new Set(existing.map((q) => q.id));
    useQuestionsStore.getState().loadQuestions([...existing, ...custom.filter((q) => !seen.has(q.id))]);
  }

  if (graded.length > 0) {
    useMistakesStore.getState().updateFromAttempts(graded);
    useSRSStore.getState().syncFromMistakes();
    useAttemptsStore.getState().recordAttempt({
      mode: 'import',
      sectionLabel: report.sourceLabel || 'AI report',
      results: graded,
    });
    res.gradedCount = graded.length;
  }

  // Question fixes → overrides applied at bank load
  const fixList = report.questionFixes ?? [];
  if (fixList.length) {
    const map = readQuestionFixes();
    for (const f of fixList) {
      if (!f?.qId || !f.fix) continue;
      map[f.qId] = { ...(map[f.qId] || {}), ...f.fix };
      res.fixes++;
    }
    writeQuestionFixes(map);
    // reload bank so fixes take effect immediately
    const all = useQuestionsStore
      .getState()
      .questions.map((q) => (map[q.id] ? normalizeQuestion({ ...q, ...map[q.id] } as Record<string, unknown>) : q));
    useQuestionsStore.getState().loadQuestions(all);
  }

  const ins = report.insight || report.insights;
  if (ins && (ins.summary || (ins.recommendations && ins.recommendations.length))) {
    useInsightsStore.getState().add({
      sourceLabel: report.sourceLabel || 'AI report',
      summary: ins.summary || '',
      weakSections: Array.isArray(ins.weakSections) ? ins.weakSections : [],
      recommendations: Array.isArray(ins.recommendations) ? ins.recommendations : [],
      ts: report.generatedAt,
    });
    res.insightAdded = true;
  }

  return res;
}

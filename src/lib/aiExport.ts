/**
 * Builds a single JSON snapshot of the whole app state for pasting into an AI:
 * every question, the mistake history, recent attempts, and a computed analytics
 * summary (weak sections + weak subtopics). Includes prompt suggestions.
 */

import type { Question, MistakeRecord, Attempt } from '@/types';
import { SECTIONS } from '@/types';
import { computeSectionMastery, computeSubtopicMastery } from '@/lib/analytics';

export interface AiReviewExport {
  meta: {
    app: 'acca-fa-quizapp';
    exportedAt: string;
    kind: 'ai-review';
    counts: { questions: number; mistakes: number; attempts: number };
  };
  prompts: {
    checkQuestions: string;
    generateQuestions: string;
    analyseWeakSpots: string;
  };
  questions: Question[];
  analytics: {
    sections: Array<{ section: string; name: string; attempted: number; correct: number; percentage: number | null }>;
    weakSubtopics: Array<{ section: string; subtopic: string; total: number; errorRate: number; avgTimeSec: number }>;
    highConfidenceErrors: string[]; // question ids answered confidently but wrong
    slowQuestions: string[]; // question ids averaging > 90s
  };
  mistakes: Record<string, MistakeRecord>;
  recentAttempts: Attempt[];
}

const PROMPTS = {
  checkQuestions:
    'Below is a JSON export from my ACCA FA (FFA) quiz app. For every item in `questions`, check against the ACCA FA syllabus: (1) is the `a` answer correct, (2) is the `ex` explanation accurate and complete, (3) is `difficulty` reasonable. List ONLY the questions that are wrong or doubtful — for each give the `id`, the problem, and a corrected version.',
  generateQuestions:
    'This JSON is my existing question bank plus analytics. Using `analytics.weakSubtopics`, write 10 new questions for each of the 3 weakest subtopics. Match the exact format of the existing `questions` (new unique `id`, `"source": "ai-generated"`). Return only a JSON array.',
  analyseWeakSpots:
    'Analyse this ACCA FA study data. Using `analytics` and `mistakes`, tell me my 3 biggest knowledge gaps, the likely misconceptions behind them, and a focused 5-day study plan.',
};

export function buildAiReviewExport(input: {
  questions: Question[];
  mistakes: Record<string, MistakeRecord>;
  attempts: Attempt[];
}): AiReviewExport {
  const { questions, mistakes, attempts } = input;

  const mastery = computeSectionMastery(questions, mistakes);
  const subtopics = computeSubtopicMastery(questions, mistakes);

  return {
    meta: {
      app: 'acca-fa-quizapp',
      exportedAt: new Date().toISOString(),
      kind: 'ai-review',
      counts: {
        questions: questions.length,
        mistakes: Object.keys(mistakes).length,
        attempts: attempts.length,
      },
    },
    prompts: PROMPTS,
    questions,
    analytics: {
      sections: mastery.map((m) => ({
        section: m.section,
        name: SECTIONS[m.section].name,
        attempted: m.total,
        correct: m.correct,
        percentage: m.percentage,
      })),
      weakSubtopics: subtopics
        .filter((s) => s.errorRate > 0.25)
        .slice(0, 15)
        .map((s) => ({
          section: s.section,
          subtopic: s.subtopic,
          total: s.total,
          errorRate: Math.round(s.errorRate * 100) / 100,
          avgTimeSec: s.avgTime,
        })),
      highConfidenceErrors: Object.values(mistakes)
        .filter((m) => m.highConfidenceErrors > 0 && m.lastResult === 'wrong')
        .map((m) => m.qId),
      slowQuestions: Object.values(mistakes)
        .filter((m) => m.avgTimeSpent > 90)
        .map((m) => m.qId),
    },
    mistakes,
    recentAttempts: attempts.slice(-25),
  };
}

export function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

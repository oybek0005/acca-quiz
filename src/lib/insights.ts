/**
 * Local study-insight generator — a plain-language read of the analytics so the
 * dashboard says something useful even without an AI endpoint.
 */

import type { SectionMastery } from '@/types';
import { SECTIONS } from '@/types';

interface WeakSub {
  section: string;
  subtopic: string;
  errorRate: number;
  total: number;
}

export interface StudyInsight {
  headline: string;
  recommendations: string[];
}

export function generateStudyInsight(
  mastery: SectionMastery[],
  weakSubtopics: WeakSub[],
  streak: { current: number; todayCount: number; target: number },
  totalAnswered: number
): StudyInsight {
  const recommendations: string[] = [];

  const graded = mastery.filter((m) => m.percentage !== null);
  const weakestSection = [...graded].sort((a, b) => (a.percentage ?? 100) - (b.percentage ?? 100))[0];
  const strongestSection = [...graded].sort((a, b) => (b.percentage ?? 0) - (a.percentage ?? 0))[0];

  let headline: string;
  if (totalAnswered < 20) {
    headline = 'Not much data yet — a few more quizzes and this will get specific.';
  } else if (weakestSection && (weakestSection.percentage ?? 100) < 60) {
    headline = `${SECTIONS[weakestSection.section].name} is your weakest area at ${weakestSection.percentage}%.`;
  } else {
    headline = 'Solid across the board — keep the streak going.';
  }

  if (weakestSection && (weakestSection.percentage ?? 100) < 70) {
    recommendations.push(
      `Run a Section Quiz on ${SECTIONS[weakestSection.section].name} — currently ${weakestSection.percentage}%.`
    );
  }
  weakSubtopics.slice(0, 2).forEach((w) => {
    recommendations.push(`Drill "${w.subtopic}" — ${Math.round(w.errorRate * 100)}% wrong so far.`);
  });
  if (strongestSection && (strongestSection.percentage ?? 0) >= 85) {
    recommendations.push(`${SECTIONS[strongestSection.section].name} is strong (${strongestSection.percentage}%) — lower its weight to spend time elsewhere.`);
  }
  if (streak.todayCount < streak.target) {
    recommendations.push(`${streak.target - streak.todayCount} more questions today to hit your daily target.`);
  }
  if (recommendations.length === 0) {
    recommendations.push('Review your mistake bank, then start a Mixed Quiz.');
  }

  return { headline, recommendations: recommendations.slice(0, 4) };
}

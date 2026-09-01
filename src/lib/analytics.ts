/**
 * Analytics Library - Compute mastery, heatmap, and other analytics
 */

import type { Question, MistakeRecord, SectionCode, SectionMastery, HeatmapData, HeatmapCell, Difficulty } from '@/types';
import { SECTION_ORDER } from '@/types';

// ============================= Section Mastery =============================

export function computeSectionMastery(
  questions: Question[],
  mistakes: Record<string, MistakeRecord>
): SectionMastery[] {
  const mastery: SectionMastery[] = [];

  SECTION_ORDER.forEach((section) => {
    const sectionQuestions = questions.filter((q) => q.section === section);
    if (sectionQuestions.length === 0) return;

    let total = 0;
    let correct = 0;
    let totalTime = 0;

    const byDifficulty: Record<Difficulty, { total: number; correct: number }> = {
      easy: { total: 0, correct: 0 },
      medium: { total: 0, correct: 0 },
      hard: { total: 0, correct: 0 },
    };

    const bySubtopic: Record<string, { total: number; correct: number; avgTime: number }> = {};

    sectionQuestions.forEach((q) => {
      const mistake = mistakes[q.id];
      if (mistake) {
        total += mistake.wrongCount + mistake.correctCount;
        correct += mistake.correctCount;
        totalTime += mistake.avgTimeSpent * (mistake.wrongCount + mistake.correctCount);

        // By difficulty
        byDifficulty[q.difficulty].total += mistake.wrongCount + mistake.correctCount;
        byDifficulty[q.difficulty].correct += mistake.correctCount;

        // By subtopic
        const subtopic = q.subtopic || q.topic || 'General';
        if (!bySubtopic[subtopic]) bySubtopic[subtopic] = { total: 0, correct: 0, avgTime: 0 };
        bySubtopic[subtopic].total += mistake.wrongCount + mistake.correctCount;
        bySubtopic[subtopic].correct += mistake.correctCount;
        bySubtopic[subtopic].avgTime = mistake.avgTimeSpent;
      }
    });

    const percentage = total > 0 ? Math.round((correct / total) * 100) : null;
    const avgTime = total > 0 ? Math.round(totalTime / total) : 0;

    mastery.push({
      section,
      total,
      correct,
      percentage,
      avgTime,
      avgConfidence: 0, // Would need attempt-level data
      byDifficulty,
      bySubtopic,
    });
  });

  return mastery;
}

// ============================= Heatmap Data =============================

export function computeHeatmapData(
  questions: Question[],
  mistakes: Record<string, MistakeRecord>
): HeatmapData {
  // Collect all subtopics per section
  const sectionSubtopics: Record<SectionCode, Set<string>> = {
    DE: new Set(),
    INV: new Set(),
    NCA: new Set(),
    INT: new Set(),
    TAX: new Set(),
    ACC: new Set(),
    RPP: new Set(),
    CAP: new Set(),
  };

  questions.forEach((q) => {
    const subtopic = q.subtopic || q.topic || 'General';
    sectionSubtopics[q.section].add(subtopic);
  });

  // Get all unique subtopics across sections
  const allSubtopics = Array.from(new Set(
    Object.values(sectionSubtopics).flatMap(s => Array.from(s))
  )).sort();

  const cells: HeatmapCell[] = [];

  SECTION_ORDER.forEach((section) => {
    const subtopics = Array.from(sectionSubtopics[section]).sort();

    subtopics.forEach((subtopic) => {
      // Aggregate mistakes for this (section, subtopic)
      let totalAttempts = 0;
      let wrongAttempts = 0;
      let totalTime = 0;

      questions
        .filter(q => q.section === section && (q.subtopic || q.topic || 'General') === subtopic)
        .forEach(q => {
          const m = mistakes[q.id];
          if (m) {
            totalAttempts += m.wrongCount + m.correctCount;
            wrongAttempts += m.wrongCount;
            totalTime += m.avgTimeSpent * (m.wrongCount + m.correctCount);
          }
        });

      const errorRate = totalAttempts > 0 ? wrongAttempts / totalAttempts : 0;
      const avgTime = totalAttempts > 0 ? Math.round(totalTime / totalAttempts) : 0;

      cells.push({
        section,
        subtopic,
        errorRate,
        volume: totalAttempts,
        totalAttempts,
        wrongAttempts,
        avgTime,
      });
    });
  });

  return {
    sections: SECTION_ORDER,
    subtopics: allSubtopics,
    cells,
  };
}

// ============================= Daily Stats =============================

export function computeDailyStats(
  attempts: Array<{ ts: string; results: Array<{ correct: boolean; timeSpent: number }> }>
): Array<{ date: string; total: number; correct: number; timeSpent: number; questionsAnswered: number }> {
  const byDate: Record<string, { total: number; correct: number; timeSpent: number; questionsAnswered: number }> = {};

  attempts.forEach((attempt) => {
    const date = attempt.ts.split('T')[0];
    if (!byDate[date]) {
      byDate[date] = { total: 0, correct: 0, timeSpent: 0, questionsAnswered: 0 };
    }
    attempt.results.forEach((r) => {
      byDate[date].total++;
      byDate[date].questionsAnswered++;
      if (r.correct) byDate[date].correct++;
      byDate[date].timeSpent += r.timeSpent;
    });
  });

  return Object.entries(byDate)
    .map(([date, stats]) => ({ date, ...stats }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// ============================= Subtopic Mastery =============================

export function computeSubtopicMastery(
  questions: Question[],
  mistakes: Record<string, MistakeRecord>
): Array<{
  section: SectionCode;
  subtopic: string;
  total: number;
  correct: number;
  percentage: number;
  avgTime: number;
  errorRate: number;
  volume: number;
}> {
  const map: Record<string, {
    section: SectionCode;
    subtopic: string;
    total: number;
    correct: number;
    totalTime: number;
  }> = {};

  questions.forEach((q) => {
    const subtopic = q.subtopic || q.topic || 'General';
    const key = `${q.section}::${subtopic}`;

    if (!map[key]) {
      map[key] = { section: q.section, subtopic, total: 0, correct: 0, totalTime: 0 };
    }

    const m = mistakes[q.id];
    if (m) {
      map[key].total += m.wrongCount + m.correctCount;
      map[key].correct += m.correctCount;
      map[key].totalTime += m.avgTimeSpent * (m.wrongCount + m.correctCount);
    }
  });

  return Object.values(map)
    .filter(m => m.total > 0)
    .map(m => ({
      ...m,
      percentage: Math.round((m.correct / m.total) * 100),
      avgTime: Math.round(m.totalTime / m.total),
      errorRate: 1 - m.correct / m.total,
      volume: m.total,
    }))
    .sort((a, b) => b.errorRate - a.errorRate); // worst (highest error rate) first
}

// ============================= Weak Sections =============================

export function getWeakSections(
  mastery: SectionMastery[],
  threshold = 60
): SectionMastery[] {
  return mastery
    .filter(m => m.percentage !== null && m.percentage < threshold)
    .sort((a, b) => (a.percentage || 100) - (b.percentage || 100));
}

// ============================= Recommended Questions =============================

export function getRecommendedQuestions(
  questions: Question[],
  mistakes: Record<string, MistakeRecord>,
  count: number
): Question[] {
  // Priority: high-confidence errors > slow questions > SRS due > low mastery subtopics
  const scored = questions.map(q => {
    const m = mistakes[q.id];
    let score = 0;

    if (m) {
      if (m.lastResult === 'wrong') {
        score += 100; // Base for wrong
        if (m.highConfidenceErrors > 0) score += 50; // High confidence error
        if (m.avgTimeSpent > 90) score += 30; // Slow
        score += m.wrongCount * 5; // Frequency
      }
    }

    return { question: q, score };
  });

  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
    .map(s => s.question);
}
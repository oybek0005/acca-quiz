/**
 * Quiz Results - Shows quiz results with detailed breakdown
 */

'use client';

import { useMemo } from 'react';
import { Question, QuestionAttempt, FSAnswers } from '@/types';
import { cn, formatTime, percentage } from '@/lib/utils';
import { CheckCircle, XCircle, Clock, Brain, Target, Zap, RotateCcw, ArrowLeft, RefreshCw } from 'lucide-react';
import { FSStatementForm } from '@/components/FSStatementForm';
import { gradeFS } from '@/lib/fsGrading';

interface QuizResultsProps {
  results: QuestionAttempt[];
  questions: Question[];
  mode: string;
  onRetry: () => void;
  onDashboard: () => void;
  onMistakes: () => void;
}

export function QuizResults({ results, questions, mode, onRetry, onDashboard, onMistakes }: QuizResultsProps) {
  const questionMap = useMemo(() => new Map(questions.map(q => [q.id, q])), [questions]);

  const total = results.length;
  const correct = results.filter(r => r.correct).length;
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
  const avgTime = total > 0 ? Math.round(results.reduce((sum, r) => sum + r.timeSpent, 0) / total) : 0;
  const avgConfidence = results.filter(r => r.confidence).length > 0
    ? results.filter(r => r.confidence).reduce((sum, r) => {
        const confMap = { low: 1, medium: 2, high: 3 };
        return sum + (confMap[r.confidence!] || 0);
      }, 0) / results.filter(r => r.confidence).length
    : 0;

  const bySection = useMemo(() => {
    const map: Record<string, { total: number; correct: number; time: number }> = {};
    results.forEach(r => {
      if (!map[r.section]) map[r.section] = { total: 0, correct: 0, time: 0 };
      map[r.section].total++;
      if (r.correct) map[r.section].correct++;
      map[r.section].time += r.timeSpent;
    });
    return map;
  }, [results]);

  const byDifficulty = useMemo(() => {
    const map: Record<string, { total: number; correct: number }> = { easy: { total: 0, correct: 0 }, medium: { total: 0, correct: 0 }, hard: { total: 0, correct: 0 } };
    results.forEach(r => {
      map[r.difficulty].total++;
      if (r.correct) map[r.difficulty].correct++;
    });
    return map;
  }, [results]);

  const passed = pct >= 60;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="card text-center">
        <div className={cn('w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center', passed ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30')}>
          {passed ? <CheckCircle className="w-10 h-10 text-green-600" /> : <XCircle className="w-10 h-10 text-red-600" />}
        </div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          {passed ? 'Quiz Passed!' : 'Keep Practicing'}
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mb-4">{mode} • {correct}/{total} correct</p>
        <div className={cn('text-5xl font-bold', passed ? 'text-green-600' : 'text-red-600')}>{pct}%</div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card text-center">
          <Clock className="w-6 h-6 text-blue-500 mx-auto mb-2" />
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{formatTime(avgTime)}</div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Avg Time/Question</div>
        </div>
        <div className="card text-center">
          <Brain className="w-6 h-6 text-purple-500 mx-auto mb-2" />
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{avgConfidence.toFixed(1)}/3</div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Avg Confidence</div>
        </div>
        <div className="card text-center">
          <Target className="w-6 h-6 text-green-500 mx-auto mb-2" />
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {results.filter(r => r.confidence === 'high' && r.correct).length}/{results.filter(r => r.confidence === 'high').length}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">High Confidence Correct</div>
        </div>
        <div className="card text-center">
          <Zap className="w-6 h-6 text-yellow-500 mx-auto mb-2" />
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {results.filter(r => r.confidence === 'high' && !r.correct).length}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">High Confidence Errors</div>
        </div>
      </div>

      {/* Section Breakdown */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">By Section</h2>
        <div className="space-y-3">
          {Object.entries(bySection).map(([section, stats]) => {
            const secPct = percentage(stats.correct, stats.total);
            const color = secPct >= 80 ? 'green' : secPct >= 60 ? 'yellow' : 'red';
            return (
              <div key={section} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded" style={{ backgroundColor: `hsl(${['DE','INV','NCA','INT','TAX','ACC','RPP','CAP'].indexOf(section) * 45}, 70%, 50%)` }} />
                  <span className="font-medium text-gray-900 dark:text-gray-100">{section}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className={cn('font-mono font-semibold', color === 'green' && 'text-green-600', color === 'yellow' && 'text-yellow-600', color === 'red' && 'text-red-600')}>
                    {secPct}%
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">{stats.correct}/{stats.total}</span>
                  <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">⌀{Math.round(stats.time / stats.total)}s</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Difficulty Breakdown */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">By Difficulty</h2>
        <div className="grid grid-cols-3 gap-4">
          {(['easy', 'medium', 'hard'] as const).map(diff => {
            const stats = byDifficulty[diff];
            const pct = percentage(stats.correct, stats.total);
            return (
              <div key={diff} className="text-center p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                <span className={`badge badge-${diff} mb-2`}>{diff.charAt(0).toUpperCase() + diff.slice(1)}</span>
                <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">{pct}%</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">{stats.correct}/{stats.total}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Question Review */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4 flex items-center justify-between">
          Question Review
          <button onClick={onMistakes} className="btn-ghost btn-sm">
            <RotateCcw className="w-4 h-4 mr-1" /> View Mistakes
          </button>
        </h2>
        <div className="space-y-2 max-h-[32rem] overflow-y-auto">
          {results.map((result) => {
            const question = questionMap.get(result.qId);

            if (question && question.t === 'fs') {
              const g = gradeFS(question, (result.userAnswer as FSAnswers) || {});
              return (
                <details key={result.qId} className={cn('rounded-lg border', result.correct ? 'border-green-200 bg-green-50 dark:bg-green-900/10' : 'border-red-200 bg-red-50 dark:bg-red-900/10')}>
                  <summary className="cursor-pointer select-none p-3 flex items-center gap-3">
                    <div className={cn('w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0', result.correct ? 'bg-green-500' : 'bg-red-500')}>
                      {result.correct ? <CheckCircle className="w-5 h-5 text-white" /> : <XCircle className="w-5 h-5 text-white" />}
                    </div>
                    <span className="flex-1 min-w-0 font-medium text-gray-900 dark:text-gray-100 truncate">
                      {question.q.replace(/<[^>]*>/g, '').slice(0, 90)}
                    </span>
                    <span className="text-sm font-mono tabular-nums text-gray-600 dark:text-gray-300">
                      {g.scoredMarks}/{g.totalMarks} · {g.percentage}%
                    </span>
                  </summary>
                  <div className="p-3 pt-0">
                    <FSStatementForm question={question} value={(result.userAnswer as FSAnswers) || {}} locked showSolution />
                  </div>
                </details>
              );
            }

            return (
              <div key={result.qId} className={cn('p-3 rounded-lg border', result.correct ? 'border-green-200 bg-green-50 dark:bg-green-900/10' : 'border-red-200 bg-red-50 dark:bg-red-900/10')}>
                <div className="flex items-start gap-3">
                  <div className={cn('w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0', result.correct ? 'bg-green-500' : 'bg-red-500')}>
                    {result.correct ? <CheckCircle className="w-5 h-5 text-white" /> : <XCircle className="w-5 h-5 text-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900 dark:text-gray-100 truncate">
                        {question ? question.q.replace(/<[^>]*>/g, '').slice(0, 100) : `Question ${result.qId}`}
                      </span>
                      <span className={`badge badge-${result.difficulty}`}>{result.difficulty}</span>
                      {result.confidence && (
                        <span className={`badge badge-confidence-${result.confidence}`}>
                          {result.confidence.charAt(0).toUpperCase() + result.confidence.slice(1)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                      <span className="font-mono">{formatTime(result.timeSpent)}</span>
                      {result.subtopic && <span>{result.subtopic}</span>}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <button onClick={onRetry} className="btn-primary btn-lg">
          <RefreshCw className="w-5 h-5" /> Retry Quiz
        </button>
        <button onClick={onMistakes} className="btn-secondary btn-lg">
          <RotateCcw className="w-5 h-5" /> Review Mistakes
        </button>
        <button onClick={onDashboard} className="btn-secondary btn-lg">
          <ArrowLeft className="w-5 h-5" /> Dashboard
        </button>
      </div>
    </div>
  );
}
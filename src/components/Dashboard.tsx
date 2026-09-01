/**
 * Dashboard - home screen: quick stats, quiz launchers, per-section practice,
 * saved quizzes, and analytics once there's activity.
 */

'use client';

import { useMemo, useState } from 'react';
import { useQuizStore, useQuestionsStore } from '@/store/quizStore';
import { useMistakesStore, useSRSStore, useStreakStore } from '@/store/mistakesStore';
import { useAttemptsStore } from '@/store/attemptsStore';
import { useSavedQuizStore } from '@/store/savedQuizStore';
import { useInsightsStore } from '@/store/insightsStore';
import { SectionMasteryBars } from '@/components/SectionMasteryBars';
import { Heatmap } from '@/components/Heatmap';
import { RecentActivity } from '@/components/RecentActivity';
import { ProgressChart } from '@/components/ProgressChart';
import { QuizSetup } from '@/components/QuizSetup';
import { computeSectionMastery, computeHeatmapData, computeSubtopicMastery } from '@/lib/analytics';
import { generateStudyInsight } from '@/lib/insights';
import { sectionCounts } from '@/lib/quizBuilder';
import { cn } from '@/lib/utils';
import { SECTION_ORDER, SECTIONS } from '@/types';
import type { SectionCode } from '@/types';
import {
  Sparkles, Flame, RotateCcw, AlertTriangle, Play, Brain, Layers, BookOpen,
  ArrowRight, BarChart3, BookmarkCheck, Trash2, ChevronRight, Zap, Table2,
} from 'lucide-react';

function shuffleTake<T>(arr: T[], n: number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}

export function Dashboard() {
  const setView = useQuizStore((s) => s.setView);
  const questions = useQuestionsStore((s) => s.questions);
  const mistakes = useMistakesStore((s) => s.mistakes);
  const srsDueCount = useSRSStore((s) => s.getDueCount());
  const streakCurrent = useStreakStore((s) => s.current);
  const streakLongest = useStreakStore((s) => s.longest);
  const streakToday = useStreakStore((s) => s.todayCount);
  const streakTarget = useStreakStore((s) => s.target);
  const attempts = useAttemptsStore((s) => s.attempts);
  const savedQuizzes = useSavedQuizStore((s) => s.saved);
  const removeSaved = useSavedQuizStore((s) => s.remove);
  const importedInsights = useInsightsStore((s) => s.insights);
  const latestImported = importedInsights.length ? importedInsights[importedInsights.length - 1] : null;

  const [setup, setSetup] = useState<{ open: boolean; section?: SectionCode }>({ open: false });

  const totalWrong = Object.values(mistakes).reduce((s, m) => s + m.wrongCount, 0);
  const highConfErrors = Object.values(mistakes).filter((m) => m.highConfidenceErrors > 0 && m.lastResult === 'wrong').length;
  const streakProgress = streakTarget > 0 ? Math.min(100, Math.round((streakToday / streakTarget) * 100)) : 0;

  const counts = useMemo(() => sectionCounts(questions, 'any'), [questions]);
  const sectionMastery = useMemo(() => computeSectionMastery(questions, mistakes), [questions, mistakes]);
  const masteryPct = useMemo(() => {
    const m: Partial<Record<SectionCode, number | null>> = {};
    for (const s of sectionMastery) m[s.section] = s.percentage;
    return m;
  }, [sectionMastery]);

  const heatmap = useMemo(() => computeHeatmapData(questions, mistakes), [questions, mistakes]);
  const weakSubtopics = useMemo(
    () => computeSubtopicMastery(questions, mistakes).filter((m) => m.errorRate > 0.4),
    [questions, mistakes]
  );
  const totalAnswered = useMemo(() => attempts.reduce((s, a) => s + a.total, 0), [attempts]);
  const insight = useMemo(
    () => generateStudyInsight(sectionMastery, weakSubtopics, { current: streakCurrent, todayCount: streakToday, target: streakTarget }, totalAnswered),
    [sectionMastery, weakSubtopics, streakCurrent, streakToday, streakTarget, totalAnswered]
  );

  const hasActivity = attempts.length > 0 || Object.keys(mistakes).length > 0 || importedInsights.length > 0;

  const launchMistakes = (filter: 'all' | 'highConfidence') => {
    const ids = useMistakesStore.getState().getRetryQuestions(filter);
    const pool = questions.filter((q) => ids.includes(q.id));
    useQuizStore.getState().startQuiz(
      shuffleTake(pool, 20),
      filter === 'highConfidence' ? 'High-confidence errors' : 'Mistake review',
      'mistakes'
    );
  };

  const launchSrs = () => {
    const dueIds = new Set(useSRSStore.getState().getDueCards().map((d) => d.qId));
    const pool = questions.filter((q) => dueIds.has(q.id));
    useQuizStore.getState().startQuiz(shuffleTake(pool, 20), 'SRS review', 'srs');
  };

  const fsQuestions = useMemo(() => questions.filter((q) => q.t === 'fs'), [questions]);
  const launchFS = () => {
    if (fsQuestions.length === 0) return;
    useQuizStore.getState().startQuiz(shuffleTake(fsQuestions, fsQuestions.length), 'Financial statements', 'section', 'tutor');
  };

  const resumeSaved = (id: string) => {
    const sq = useSavedQuizStore.getState().get(id);
    if (sq) {
      useQuizStore.getState().resumeSession(sq.session);
      removeSaved(id);
    }
  };

  return (
    <div className="space-y-6">
      {setup.open && <QuizSetup preselectSection={setup.section} onClose={() => setSetup({ open: false })} />}

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted mt-1 text-sm">
          {streakToday > 0
            ? `You've done ${streakToday} question${streakToday === 1 ? '' : 's'} today.`
            : 'Ready to study? Pick a quiz below.'}
        </p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat icon={<Flame className="w-4 h-4" />} tone="warn" label="Streak" value={streakCurrent}
          sub={`${streakToday}/${streakTarget} today · best ${streakLongest}`} progress={streakProgress} />
        <Stat icon={<RotateCcw className="w-4 h-4" />} tone="accent" label="SRS due" value={srsDueCount}
          sub="cards to review" onAction={srsDueCount > 0 ? launchSrs : undefined} actionLabel="Review" />
        <Stat icon={<AlertTriangle className="w-4 h-4" />} tone="bad" label="Mistakes" value={totalWrong}
          sub="wrong answers" onAction={totalWrong > 0 ? () => launchMistakes('all') : undefined} actionLabel="Practise" />
        <Stat icon={<BookOpen className="w-4 h-4" />} tone="ok" label="Question bank" value={questions.length} sub="across 8 sections" />
      </div>

      {/* Start a quiz */}
      <section className="card">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Zap className="w-5 h-5 text-[color:rgb(var(--accent))]" /> Start a quiz
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <Launcher
            icon={<Play className="w-5 h-5" />}
            title="New quiz"
            desc="Choose sections, difficulty, and length"
            onClick={() => setSetup({ open: true })}
            accent
          />
          <Launcher
            icon={<RotateCcw className="w-5 h-5" />}
            title="Review mistakes"
            desc={`${totalWrong} wrong answers tracked`}
            onClick={() => launchMistakes('all')}
            disabled={totalWrong === 0}
          />
          <Launcher
            icon={<Brain className="w-5 h-5" />}
            title="SRS session"
            desc={`${srsDueCount} cards due`}
            onClick={launchSrs}
            disabled={srsDueCount === 0}
          />
          <Launcher
            icon={<AlertTriangle className="w-5 h-5" />}
            title="Weak areas"
            desc={`${highConfErrors} high-confidence errors`}
            onClick={() => launchMistakes('highConfidence')}
            disabled={highConfErrors === 0}
          />
          <Launcher
            icon={<Layers className="w-5 h-5" />}
            title="Flashcards"
            desc="Flip through the bank"
            onClick={() => setView('flashcards')}
          />
          {fsQuestions.length > 0 && (
            <Launcher
              icon={<Table2 className="w-5 h-5" />}
              title="Financial statements"
              desc={`Build a full SPL + SOFP · ${fsQuestions.length} question${fsQuestions.length === 1 ? '' : 's'}`}
              onClick={launchFS}
            />
          )}
        </div>
      </section>

      {/* Saved quizzes */}
      {savedQuizzes.length > 0 && (
        <section className="card">
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <BookmarkCheck className="w-5 h-5 text-[color:rgb(var(--accent))]" /> Saved quizzes
          </h2>
          <div className="space-y-2">
            {savedQuizzes.map((sq) => (
              <div key={sq.id} className="flex items-center gap-3 p-3 rounded-lg border border-line hover:bg-surface-2">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm truncate">{sq.title}</p>
                  <p className="text-xs text-muted">
                    {sq.answeredCount}/{sq.total} answered · saved {new Date(sq.savedAt).toLocaleDateString()}
                  </p>
                </div>
                <button onClick={() => resumeSaved(sq.id)} className="btn-primary btn-sm">
                  Resume <ChevronRight className="w-4 h-4" />
                </button>
                <button onClick={() => removeSaved(sq.id)} className="icon-btn" aria-label="Delete">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Practise by section */}
      <section className="card">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-[color:rgb(var(--accent))]" /> Practise by section
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {SECTION_ORDER.map((s) => {
            const pct = masteryPct[s];
            return (
              <button
                key={s}
                onClick={() => setSetup({ open: true, section: s })}
                className="flex items-center gap-3 p-3 rounded-lg border border-line hover:border-[color:rgb(var(--accent))] transition-colors text-left"
              >
                <span className={`badge badge-${s} flex-shrink-0`}>{s}</span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium truncate">{SECTIONS[s].name}</span>
                  <span className="block text-xs text-muted">{counts[s] || 0} questions</span>
                </span>
                {pct != null && (
                  <span className={cn('text-sm font-semibold tabular-nums', pct >= 80 ? 'text-green-600 dark:text-green-400' : pct >= 60 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400')}>
                    {pct}%
                  </span>
                )}
                <ArrowRight className="w-4 h-4 text-faint flex-shrink-0" />
              </button>
            );
          })}
        </div>
      </section>

      {/* Analytics */}
      {hasActivity && (
        <section className="space-y-5">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[color:rgb(var(--accent))]" /> Your progress
          </h2>

          <div className="card bg-[color:rgb(var(--accent-soft))] border-[color:rgb(var(--accent))]/30">
            <p className="font-medium mb-2">{insight.headline}</p>
            <ul className="space-y-1.5 text-sm text-muted">
              {insight.recommendations.map((r, i) => (
                <li key={i} className="flex gap-2">
                  <ArrowRight className="w-4 h-4 flex-shrink-0 mt-0.5 text-[color:rgb(var(--accent))]" />
                  {r}
                </li>
              ))}
            </ul>
          </div>

          {latestImported && (
            <div className="card">
              <h3 className="font-semibold flex items-center gap-2 mb-2 text-sm">
                <Sparkles className="w-4 h-4 text-[color:rgb(var(--accent))]" />
                AI review — {latestImported.sourceLabel || 'imported'}
                <span className="text-xs text-faint font-normal">{new Date(latestImported.ts).toLocaleDateString()}</span>
              </h3>
              {latestImported.summary && <p className="text-sm text-muted mb-2">{latestImported.summary}</p>}
              {latestImported.recommendations.length > 0 && (
                <ul className="space-y-1 text-sm text-muted">
                  {latestImported.recommendations.map((r, i) => (
                    <li key={i} className="flex gap-2">
                      <ArrowRight className="w-4 h-4 flex-shrink-0 mt-0.5 text-[color:rgb(var(--accent))]" />
                      {r}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {weakSubtopics.length > 0 && (
            <div className="card">
              <h3 className="font-semibold flex items-center gap-2 mb-3 text-sm">
                <AlertTriangle className="w-4 h-4 text-[color:rgb(var(--warn))]" /> Focus areas
              </h3>
              <div className="flex flex-wrap gap-2">
                {weakSubtopics.slice(0, 8).map((w) => (
                  <span key={w.section + w.subtopic} className="badge badge-red">
                    {w.subtopic} · {Math.round(w.errorRate * 100)}% ({w.total})
                  </span>
                ))}
              </div>
            </div>
          )}

          <ProgressChart />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <SectionMasteryBars mastery={sectionMastery} />
            <RecentActivity />
          </div>
          {heatmap.cells.some((c) => c.totalAttempts > 0) && (
            <Heatmap data={heatmap} onCellClick={() => setView('mistakes')} />
          )}
        </section>
      )}
    </div>
  );
}

const TONE: Record<string, string> = {
  warn: 'text-[color:rgb(var(--warn))]',
  accent: 'text-[color:rgb(var(--accent))]',
  bad: 'text-[color:rgb(var(--bad))]',
  ok: 'text-[color:rgb(var(--ok))]',
};

function Stat({
  icon, tone, label, value, sub, progress, onAction, actionLabel,
}: {
  icon: React.ReactNode;
  tone: string;
  label: string;
  value: number;
  sub: string;
  progress?: number;
  onAction?: () => void;
  actionLabel?: string;
}) {
  return (
    <div className="card p-4">
      <div className={cn('flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide', TONE[tone])}>
        {icon} {label}
      </div>
      <p className="text-3xl font-bold mt-1 tabular-nums">{value}</p>
      <p className="text-xs text-muted mt-0.5">{sub}</p>
      {progress != null && (
        <div className="progress-bar mt-2 h-1.5">
          <div className="progress-fill progress-orange h-full" style={{ width: `${progress}%` }} />
        </div>
      )}
      {onAction && (
        <button onClick={onAction} className="btn-secondary btn-sm w-full mt-3">
          {actionLabel}
        </button>
      )}
    </div>
  );
}

function Launcher({
  icon, title, desc, onClick, disabled, accent,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  onClick: () => void;
  disabled?: boolean;
  accent?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'p-4 rounded-xl border text-left transition-all',
        disabled
          ? 'border-line opacity-45 cursor-not-allowed'
          : accent
            ? 'border-[color:rgb(var(--accent))] bg-[color:rgb(var(--accent-soft))] hover:brightness-95'
            : 'border-line hover:border-[color:rgb(var(--accent))]'
      )}
    >
      <div className={cn('mb-2', accent ? 'text-[color:rgb(var(--accent))]' : 'text-muted')}>{icon}</div>
      <p className="font-semibold text-sm">{title}</p>
      <p className="text-xs text-muted mt-0.5">{desc}</p>
    </button>
  );
}

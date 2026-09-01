/**
 * Quiz Setup - configure a quiz before starting: sections, count, difficulty,
 * section weighting, and tutor/exam mode.
 */

'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuestionsStore, useQuizStore, useSettingsStore } from '@/store/quizStore';
import { useToaster } from '@/components/Toaster';
import { SECTION_ORDER, SECTIONS } from '@/types';
import type { SectionCode, Difficulty, QuizInteraction } from '@/types';
import { buildQuiz, sectionCounts, type QuizConfig, type Weighting } from '@/lib/quizBuilder';
import { cn } from '@/lib/utils';
import { X, Play, Shuffle } from 'lucide-react';

const DIFFICULTIES: { value: Difficulty | 'any'; label: string }[] = [
  { value: 'any', label: 'Any' },
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
];

export function QuizSetup({
  preselectSection,
  onClose,
}: {
  preselectSection?: SectionCode;
  onClose: () => void;
}) {
  const questions = useQuestionsStore((s) => s.questions);
  const startQuiz = useQuizStore((s) => s.startQuiz);
  const savedInteraction = useSettingsStore((s) => (s.quizMode === 'exam' ? 'exam' : 'tutor'));

  const [sections, setSections] = useState<SectionCode[]>(preselectSection ? [preselectSection] : []);
  const [difficulty, setDifficulty] = useState<Difficulty | 'any'>('any');
  const [count, setCount] = useState(preselectSection ? 15 : 20);
  const [weighting, setWeighting] = useState<Weighting>(preselectSection ? 'even' : 'exam');
  const [interaction, setInteraction] = useState<QuizInteraction>(savedInteraction);
  const toast = useToaster();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const counts = useMemo(() => sectionCounts(questions, difficulty), [questions, difficulty]);

  const selected = sections.length ? sections : [...SECTION_ORDER];
  const available = useMemo(
    () => selected.reduce((sum, s) => sum + (counts[s] || 0), 0),
    [selected, counts]
  );
  const maxCount = Math.min(50, available);
  const effectiveCount = Math.min(count, maxCount);

  const toggleSection = (s: SectionCode) => {
    setSections((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));
  };

  const start = () => {
    const cfg: QuizConfig = { sections, count: effectiveCount, difficulty, weighting };
    const qs = buildQuiz(questions, cfg);
    if (qs.length === 0) {
      toast.error('No questions match those filters', 'Try a different difficulty or add sections.');
      return;
    }
    const label =
      sections.length === 1
        ? `${SECTIONS[sections[0]].name}`
        : sections.length === 0
          ? 'Mixed Quiz'
          : `${sections.length} sections`;
    startQuiz(qs, label, sections.length === 1 ? 'section' : 'mixed', interaction);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/50 p-3 overflow-y-auto"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Quiz setup"
    >
      <div
        className="card w-full max-w-lg my-6 sm:my-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">
            {preselectSection ? `Practise: ${SECTIONS[preselectSection].name}` : 'New quiz'}
          </h2>
          <button onClick={onClose} className="icon-btn" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sections */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium">Sections</label>
            <button
              onClick={() => setSections([])}
              className={cn('text-xs', sections.length === 0 ? 'text-[color:rgb(var(--accent))] font-semibold' : 'text-muted')}
            >
              All sections
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {SECTION_ORDER.map((s) => {
              const on = sections.length === 0 || sections.includes(s);
              const n = counts[s] || 0;
              return (
                <button
                  key={s}
                  onClick={() => toggleSection(s)}
                  disabled={n === 0}
                  className={cn(
                    'flex items-center gap-2 px-2.5 py-2 rounded-lg border text-left text-sm transition-colors',
                    on && sections.length > 0
                      ? 'border-[color:rgb(var(--accent))] bg-[color:rgb(var(--accent-soft))]'
                      : 'border-line hover:border-[color:rgb(var(--accent))]',
                    n === 0 && 'opacity-40'
                  )}
                >
                  <span className={`badge badge-${s} flex-shrink-0`}>{s}</span>
                  <span className="flex-1 truncate text-xs text-muted">{SECTIONS[s].name}</span>
                  <span className="text-xs text-faint tabular-nums">{n}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Difficulty */}
        <div className="mb-5">
          <label className="text-sm font-medium block mb-2">Difficulty</label>
          <div className="flex gap-2">
            {DIFFICULTIES.map((d) => (
              <button
                key={d.value}
                onClick={() => setDifficulty(d.value)}
                className={cn(
                  'flex-1 py-1.5 rounded-lg border text-sm transition-colors',
                  difficulty === d.value
                    ? 'border-[color:rgb(var(--accent))] bg-[color:rgb(var(--accent-soft))] font-semibold'
                    : 'border-line hover:border-[color:rgb(var(--accent))]'
                )}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {/* Count */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-1">
            <label className="text-sm font-medium">Questions</label>
            <span className="text-sm font-semibold tabular-nums">{effectiveCount}</span>
          </div>
          <input
            type="range"
            min={5}
            max={Math.max(5, maxCount)}
            step={1}
            value={effectiveCount}
            onChange={(e) => setCount(parseInt(e.target.value))}
            className="w-full accent-[color:rgb(var(--accent))]"
          />
          <p className="text-xs text-muted mt-1">{available} available with these filters</p>
        </div>

        {/* Weighting (only meaningful with 2+ sections) */}
        {selected.length > 1 && (
          <div className="mb-5">
            <label className="text-sm font-medium block mb-2">Mix</label>
            <div className="flex gap-2">
              {([
                { value: 'exam', label: 'Exam weights' },
                { value: 'even', label: 'Even split' },
              ] as { value: Weighting; label: string }[]).map((w) => (
                <button
                  key={w.value}
                  onClick={() => setWeighting(w.value)}
                  className={cn(
                    'flex-1 py-1.5 rounded-lg border text-sm transition-colors',
                    weighting === w.value
                      ? 'border-[color:rgb(var(--accent))] bg-[color:rgb(var(--accent-soft))] font-semibold'
                      : 'border-line hover:border-[color:rgb(var(--accent))]'
                  )}
                >
                  {w.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Mode */}
        <div className="mb-6">
          <label className="text-sm font-medium block mb-2">Mode</label>
          <div className="flex gap-2">
            {([
              { value: 'tutor', label: 'Tutor', hint: 'Feedback as you go' },
              { value: 'exam', label: 'Exam', hint: 'Grade at the end' },
            ] as { value: QuizInteraction; label: string; hint: string }[]).map((m) => (
              <button
                key={m.value}
                onClick={() => setInteraction(m.value)}
                className={cn(
                  'flex-1 py-2 px-2 rounded-lg border text-sm transition-colors',
                  interaction === m.value
                    ? 'border-[color:rgb(var(--accent))] bg-[color:rgb(var(--accent-soft))] font-semibold'
                    : 'border-line hover:border-[color:rgb(var(--accent))]'
                )}
              >
                <div>{m.label}</div>
                <div className="text-xs text-muted font-normal">{m.hint}</div>
              </button>
            ))}
          </div>
        </div>

        <button onClick={start} disabled={available === 0} className="btn-primary btn-lg w-full">
          <Play className="w-5 h-5" /> Start quiz ({effectiveCount})
        </button>
        <button
          onClick={() => {
            setSections([]);
            setDifficulty('any');
            setCount(20);
            setWeighting('exam');
          }}
          className="btn-ghost btn-sm w-full mt-2"
        >
          <Shuffle className="w-4 h-4" /> Reset to a random mix
        </button>
      </div>
    </div>
  );
}

/**
 * Quiz Header - title, mode chips, progress, timer, and controls.
 */

'use client';

import { cn, formatTime } from '@/lib/utils';
import { X, Pause, Play, Save } from 'lucide-react';

interface QuizHeaderProps {
  title: string;
  mode: string;
  interaction: 'tutor' | 'exam';
  current: number;
  total: number;
  elapsedTime: number;
  showTimer: boolean;
  onPause: () => void;
  paused: boolean;
  onSave: () => void;
  onExit: () => void;
}

const MODE_LABEL: Record<string, string> = {
  mixed: 'Mixed',
  mistakes: 'Mistakes',
  srs: 'SRS',
  flashcard: 'Flashcard',
  section: 'Section',
};

export function QuizHeader({
  title,
  mode,
  interaction,
  current,
  total,
  elapsedTime,
  showTimer,
  onPause,
  paused,
  onSave,
  onExit,
}: QuizHeaderProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 p-4 rounded-xl bg-surface border border-line">
      <h1 className="text-base font-semibold truncate mr-auto">{title}</h1>

      <span className="badge badge-gray">{MODE_LABEL[mode] ?? mode}</span>
      <span className={cn('badge', interaction === 'exam' ? 'badge-red' : 'badge-blue')}>
        {interaction === 'exam' ? 'Exam' : 'Tutor'}
      </span>
      <span className="text-xs text-muted font-mono">{current}/{total}</span>

      {showTimer && (
        <div className={cn('timer', elapsedTime > 120 ? 'timer-danger' : elapsedTime > 90 ? 'timer-warning' : 'timer-normal')}>
          <span className="font-mono">{formatTime(elapsedTime)}</span>
        </div>
      )}

      <button onClick={onPause} className="icon-btn" aria-label={paused ? 'Resume' : 'Pause'}>
        {paused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
      </button>
      <button onClick={onSave} className="icon-btn" aria-label="Save & exit" title="Save & exit">
        <Save className="w-5 h-5" />
      </button>
      <button onClick={onExit} className="icon-btn hover:text-red-500" aria-label="Exit quiz">
        <X className="w-5 h-5" />
      </button>
    </div>
  );
}

/**
 * Quiz Navigation - prev / next / submit plus a jump-to-question grid.
 */

'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, LayoutGrid, Send } from 'lucide-react';

interface QuizNavigationProps {
  current: number; // 1-based
  total: number;
  answeredIndexes: boolean[];
  revealedIndexes: boolean[];
  onPrev: () => void;
  onNext: () => void;
  onJump: (index: number) => void; // 0-based
  onSubmit: () => void;
  isLast: boolean;
  canProceed: boolean;
  hideNext?: boolean; // tutor mode renders its own "Continue" button after a wrong answer
}

export function QuizNavigation({
  current,
  total,
  answeredIndexes,
  revealedIndexes,
  onPrev,
  onNext,
  onJump,
  onSubmit,
  isLast,
  canProceed,
  hideNext,
}: QuizNavigationProps) {
  const [showGrid, setShowGrid] = useState(false);
  const answeredCount = answeredIndexes.filter(Boolean).length;
  const allAnswered = answeredIndexes.every(Boolean);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <button onClick={onPrev} disabled={current === 1} className="btn btn-secondary btn-sm">
          <ChevronLeft className="w-4 h-4" /> Prev
        </button>

        <button onClick={() => setShowGrid((v) => !v)} className="btn btn-ghost btn-sm">
          <LayoutGrid className="w-4 h-4" /> {current}/{total}
        </button>

        {hideNext ? (
          <span />
        ) : isLast ? (
          <button onClick={onSubmit} disabled={!canProceed} className="btn btn-primary btn-sm">
            <Send className="w-4 h-4" /> Submit
          </button>
        ) : (
          <button onClick={onNext} disabled={!canProceed} className="btn btn-primary btn-sm">
            Next <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {showGrid && (
        <div className="animate-slide-up">
          <div className="grid grid-cols-6 sm:grid-cols-10 gap-2">
            {Array.from({ length: total }, (_, i) => i).map((i) => {
              const isCurrent = i + 1 === current;
              return (
                <button
                  key={i}
                  onClick={() => {
                    onJump(i);
                    setShowGrid(false);
                  }}
                  className={cn(
                    'aspect-square rounded-lg text-sm font-medium transition-colors',
                    isCurrent
                      ? 'bg-blue-600 text-white ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-gray-900'
                      : revealedIndexes[i]
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
                        : answeredIndexes[i]
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                  )}
                  aria-current={isCurrent ? 'step' : undefined}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
          {isLast && (
            <button onClick={onSubmit} disabled={!allAnswered} className="btn btn-primary btn-sm mt-3 w-full">
              <Send className="w-4 h-4" /> Submit all {total} answers
            </button>
          )}
        </div>
      )}

      <p className="text-xs text-muted text-center">{answeredCount}/{total} answered</p>
    </div>
  );
}

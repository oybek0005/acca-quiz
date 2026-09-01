/**
 * Progress Chart - daily questions answered + accuracy over the last 14 days.
 * Inline SVG (no chart library) so it stays light and theme-aware.
 */

'use client';

import { useMemo } from 'react';
import { useAttemptsStore } from '@/store/attemptsStore';
import { computeDailyStats } from '@/lib/analytics';
import { TrendingUp } from 'lucide-react';

const DAYS = 14;

function lastNDates(n: number): string[] {
  const out: string[] = [];
  const d = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const x = new Date(d);
    x.setDate(d.getDate() - i);
    out.push(x.toISOString().split('T')[0]);
  }
  return out;
}

export function ProgressChart() {
  const attempts = useAttemptsStore((s) => s.attempts);

  const days = useMemo(() => {
    const stats = computeDailyStats(attempts);
    const byDate = new Map(stats.map((s) => [s.date, s]));
    return lastNDates(DAYS).map((date) => {
      const s = byDate.get(date);
      const total = s?.total ?? 0;
      const correct = s?.correct ?? 0;
      return {
        date,
        total,
        correct,
        accuracy: total > 0 ? Math.round((correct / total) * 100) : null,
      };
    });
  }, [attempts]);

  const maxTotal = Math.max(...days.map((d) => d.total), 1);
  const hasData = days.some((d) => d.total > 0);

  return (
    <div className="card">
      <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-blue-500" />
        14-Day Progress
      </h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Questions answered per day, shaded by accuracy</p>

      {!hasData ? (
        <p className="text-gray-500 dark:text-gray-400 text-center py-8">
          No activity in the last two weeks.
        </p>
      ) : (
        <div
          role="img"
          aria-label="Daily progress bar chart"
          style={{ display: 'grid', gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))`, gap: '6px' }}
        >
          {days.map((d) => {
            const h = d.total > 0 ? Math.max(4, Math.round((d.total / maxTotal) * 144)) : 2;
            const acc = d.accuracy ?? 0;
            const color =
              d.accuracy === null ? '#9ca3af' : acc >= 80 ? '#22c55e' : acc >= 60 ? '#eab308' : '#ef4444';
            return (
              <div key={d.date} className="min-w-0 flex flex-col items-center gap-1" title={d.total > 0 ? `${d.date}: ${d.correct}/${d.total} (${d.accuracy}%)` : d.date}>
                <div className="w-full flex items-end" style={{ height: '144px' }}>
                  <div
                    className="w-full rounded-t"
                    style={{ height: `${h}px`, backgroundColor: d.total > 0 ? color : '#d1d5db' }}
                  />
                </div>
                <span className="text-[10px] text-gray-400 dark:text-gray-500 tabular-nums">{d.date.slice(8)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

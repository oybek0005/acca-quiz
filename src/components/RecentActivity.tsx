/**
 * Recent Activity - the last few completed quizzes.
 */

'use client';

import { useAttemptsStore } from '@/store/attemptsStore';
import { getRelativeTime } from '@/lib/utils';
import { Clock, CheckCircle, XCircle } from 'lucide-react';

const MODE_LABEL: Record<string, string> = {
  quiz: 'Quiz',
  srs: 'SRS',
  flashcard: 'Flashcards',
  import: 'Imported',
  manual: 'Manual',
};

export function RecentActivity() {
  const attempts = useAttemptsStore((s) => s.attempts);
  const recent = [...attempts].slice(-8).reverse();

  return (
    <div className="card">
      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Clock className="w-5 h-5 text-gray-500" />
        Recent Activity
      </h2>

      {recent.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400 text-center py-8">
          No quizzes yet — finish one and it will show up here.
        </p>
      ) : (
        <div className="space-y-3">
          {recent.map((a) => {
            const pct = a.total > 0 ? Math.round((a.score / a.total) * 100) : 0;
            const isPass = pct >= 60;
            return (
              <div
                key={a.id}
                className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center text-white flex-shrink-0 ${isPass ? 'bg-green-500' : 'bg-red-500'}`}
                  >
                    {isPass ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 dark:text-gray-100 truncate">{a.sectionLabel}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {getRelativeTime(a.ts)} • {a.total} questions • {MODE_LABEL[a.mode] ?? a.mode}
                    </p>
                  </div>
                </div>
                <div className="text-right flex-shrink-0 ml-3">
                  <p className={`font-bold ${isPass ? 'text-green-600' : 'text-red-600'}`}>{pct}%</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {a.score}/{a.total}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

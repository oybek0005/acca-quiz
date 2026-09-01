/**
 * Section Mastery Bars - Horizontal progress bars for each section
 */

'use client';

import { SectionMastery, SECTIONS, SECTION_ORDER } from '@/types';
import { cn } from '@/lib/utils';

interface SectionMasteryBarsProps {
  mastery: SectionMastery[];
}

export function SectionMasteryBars({ mastery }: SectionMasteryBarsProps) {
  const masteryMap = new Map(mastery.map(m => [m.section, m]));

  return (
    <div className="card">
      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        Section Mastery
      </h2>

      <div className="space-y-3">
        {SECTION_ORDER.map(section => {
          const m = masteryMap.get(section);
          const sectionInfo = SECTIONS[section];
          const pct = m?.percentage ?? null;
          const total = m?.total ?? 0;
          const correct = m?.correct ?? 0;
          const avgTime = m?.avgTime ?? 0;

          let colorClass = 'progress-gray';
          let colorName = 'gray';
          if (pct !== null) {
            if (pct >= 80) { colorClass = 'progress-green'; colorName = 'green'; }
            else if (pct >= 60) { colorClass = 'progress-yellow'; colorName = 'yellow'; }
            else { colorClass = 'progress-red'; colorName = 'red'; }
          }

          return (
            <div key={section} className="group">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2 min-w-[120px]">
                  <div className="w-3 h-3 rounded" style={{ backgroundColor: `hsl(${SECTION_ORDER.indexOf(section) * 45}, 70%, 50%)` }} />
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {sectionInfo?.name || section}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  {pct !== null && (
                    <span className={cn('font-mono font-semibold', colorName === 'green' && 'text-green-600', colorName === 'yellow' && 'text-yellow-600', colorName === 'red' && 'text-red-600', colorName === 'gray' && 'text-gray-500')}>
                      {pct}%
                    </span>
                  )}
                  {pct === null && (
                    <span className="text-gray-400 font-mono">—</span>
                  )}
                  <span className="text-gray-500 dark:text-gray-400">
                    {correct}/{total}
                  </span>
                  {avgTime > 0 && (
                    <span className="text-gray-400 dark:text-gray-500 font-mono text-xs">
                      ⌀{avgTime}s
                    </span>
                  )}
                </div>
              </div>
              <div className="progress-bar">
                <div
                  className={cn('progress-fill', colorClass)}
                  style={{ width: pct !== null ? `${pct}%` : '0%' }}
                ></div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
        <span>Mastery:</span>
        <div className="flex items-center gap-1">
          <div className="w-6 h-3 rounded bg-green-500" />
          <span>≥80%</span>
          <div className="w-6 h-3 rounded bg-yellow-500 ml-2" />
          <span>60-79%</span>
          <div className="w-6 h-3 rounded bg-red-500 ml-2" />
          <span>{'<'}60%</span>
          <div className="w-6 h-3 rounded bg-gray-300 dark:bg-gray-600 ml-2" />
          <span>No data</span>
        </div>
      </div>
    </div>
  );
}
/**
 * Weak Spot Heatmap - Visualizes error rates by section and subtopic
 */

'use client';

import { useState, useMemo } from 'react';
import { HeatmapData, HeatmapCell, SECTIONS, SECTION_ORDER } from '@/types';
import { cn } from '@/lib/utils';
import { useTheme } from '@/components/ThemeProvider';

interface HeatmapProps {
  data: HeatmapData;
  onCellClick?: (cell: HeatmapCell) => void;
}

const COLORS = {
  0: '#dcfce7', // green-100 - no errors
  1: '#fef9c3', // yellow-100 - low
  2: '#fed7aa', // orange-100 - medium
  3: '#fecaca', // red-100 - high
  4: '#fca5a5', // red-200 - very high
};

const DARK_COLORS = {
  0: '#14532d', // green-900
  1: '#713f12', // yellow-900
  2: '#9a3412', // orange-900
  3: '#7f1d1d', // red-900
  4: '#991b1b', // red-950
};

function getColorIntensity(errorRate: number, volume: number): number {
  if (volume === 0) return 0;
  if (errorRate === 0) return 0;
  if (errorRate < 0.25) return 1;
  if (errorRate < 0.5) return 2;
  if (errorRate < 0.75) return 3;
  return 4;
}

function getCellSize(volume: number, maxVolume: number): string {
  if (maxVolume === 0) return 'w-8 h-8';
  const ratio = volume / maxVolume;
  if (ratio < 0.25) return 'w-8 h-8';
  if (ratio < 0.5) return 'w-10 h-10';
  if (ratio < 0.75) return 'w-12 h-12';
  return 'w-14 h-14';
}

export function Heatmap({ data, onCellClick }: HeatmapProps) {
  const [hoveredCell, setHoveredCell] = useState<HeatmapCell | null>(null);
  const [selectedCell, setSelectedCell] = useState<HeatmapCell | null>(null);
  const [tipPos, setTipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const maxVolume = useMemo(() => Math.max(...data.cells.map(c => c.volume), 1), [data.cells]);

  // Group cells by section for rendering
  const cellsBySection = useMemo(() => {
    const map: Record<string, HeatmapCell[]> = {};
    data.cells.forEach(cell => {
      if (!map[cell.section]) map[cell.section] = [];
      map[cell.section].push(cell);
    });
    return map;
  }, [data.cells]);

  const handleCellClick = (cell: HeatmapCell) => {
    setSelectedCell(cell);
    onCellClick?.(cell);
  };

  const getColor = (intensity: number, isDark: boolean) => {
    return isDark ? DARK_COLORS[intensity as keyof typeof DARK_COLORS] : COLORS[intensity as keyof typeof COLORS];
  };

  return (
    <div className="card">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          Weak Spot Heatmap
        </h2>
        <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
          <span>Cell size = attempt volume</span>
          <div className="flex items-center gap-2">
            {[0, 1, 2, 3, 4].map(i => (
              <div key={i} className="w-4 h-4 rounded" style={{ backgroundColor: getColor(i, isDark) }} />
            ))}
          </div>
        </div>
      </div>

      {/* Tooltip */}
      {(hoveredCell || selectedCell) && (
        <div
          className="fixed z-50 bg-gray-900 text-white text-xs rounded-lg shadow-lg p-3 pointer-events-none max-w-xs animate-fade-in"
          style={{
            top: Math.min(tipPos.y + 14, (typeof window !== 'undefined' ? window.innerHeight : 800) - 160),
            left: Math.min(tipPos.x + 14, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 260),
          }}
        >
          <div className="font-medium mb-1">
            {SECTIONS[hoveredCell?.section || selectedCell?.section || 'DE']?.name || 'Unknown'}
          </div>
          <div className="text-gray-300 mb-2">{hoveredCell?.subtopic || selectedCell?.subtopic}</div>
          <div className="grid grid-cols-2 gap-1 text-xs">
            <span>Error Rate:</span>
            <span className="font-mono">
              {hoveredCell ? Math.round(hoveredCell.errorRate * 100) : Math.round((selectedCell?.errorRate || 0) * 100)}%
            </span>
            <span>Attempts:</span>
            <span className="font-mono">{hoveredCell?.totalAttempts || selectedCell?.totalAttempts || 0}</span>
            <span>Wrong:</span>
            <span className="font-mono text-red-300">{hoveredCell?.wrongAttempts || selectedCell?.wrongAttempts || 0}</span>
            <span>Avg Time:</span>
            <span className="font-mono">{hoveredCell?.avgTime || selectedCell?.avgTime || 0}s</span>
          </div>
          {selectedCell && (
            <button
              onClick={() => onCellClick?.(selectedCell)}
              className="mt-2 text-blue-400 hover:text-blue-300 text-sm underline"
            >
              Filter mistakes →
            </button>
          )}
        </div>
      )}

      {/* Heatmap Grid */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse" role="table" aria-label="Weak spot heatmap">
          <thead>
            <tr>
              <th className="w-32 text-left p-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Section
              </th>
              {data.subtopics.map(subtopic => (
                <th key={subtopic} className="p-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  <div className="rotate-45 origin-bottom-left inline-block w-24">
                    {subtopic}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SECTION_ORDER.map(section => {
              const cells = cellsBySection[section] || [];
              const cellMap = new Map(cells.map(c => [c.subtopic, c]));

              return (
                <tr key={section}>
                  <td className="p-2 text-sm font-medium text-gray-900 dark:text-gray-100 w-32">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded" style={{ backgroundColor: `hsl(${SECTION_ORDER.indexOf(section) * 45}, 70%, 50%)` }} />
                      <span className="truncate">{SECTIONS[section]?.name || section}</span>
                    </div>
                  </td>
                  {data.subtopics.map(subtopic => {
                    const cell = cellMap.get(subtopic);
                    const intensity = cell ? getColorIntensity(cell.errorRate, cell.volume) : 0;
                    const size = cell ? getCellSize(cell.volume, maxVolume) : 'w-8 h-8';
                    const isSelected = selectedCell?.section === section && selectedCell?.subtopic === subtopic;

                    return (
                      <td
                        key={subtopic}
                        className="p-1 text-center"
                        onClick={() => cell && handleCellClick(cell)}
                        onMouseEnter={(e) => {
                          if (cell) {
                            setHoveredCell(cell);
                            setTipPos({ x: e.clientX, y: e.clientY });
                          }
                        }}
                        onMouseMove={(e) => setTipPos({ x: e.clientX, y: e.clientY })}
                        onMouseLeave={() => setHoveredCell(null)}
                        style={{ cursor: cell && cell.volume > 0 ? 'pointer' : 'default' }}
                      >
                        {cell && cell.volume > 0 && (
                          <div
                            className={cn(
                              'rounded transition-all duration-200 mx-auto',
                              size,
                              isSelected && 'ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-gray-900'
                            )}
                            style={{
                              backgroundColor: getColor(intensity, isDark),
                            }}
                            title={`${subtopic}: ${Math.round(cell.errorRate * 100)}% error rate, ${cell.totalAttempts} attempts`}
                          />
                        )}
                        {!cell || cell.volume === 0 ? (
                          <div className={cn('w-6 h-6 rounded mx-auto bg-gray-100 dark:bg-gray-800', size)}>
                          </div>
                        ) : null}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
        <span>Error Rate:</span>
        <div className="flex items-center gap-1">
          {[0, 1, 2, 3, 4].map(i => (
            <div
              key={i}
              className="w-6 h-6 rounded border border-gray-200 dark:border-gray-700"
              style={{ backgroundColor: getColor(i, isDark) }}
            />
          ))}
        </div>
        <div className="flex items-center gap-1 ml-auto">
          <span>0%</span>
          <span>25%</span>
          <span>50%</span>
          <span>75%</span>
          <span>100%</span>
        </div>
      </div>
    </div>
  );
}
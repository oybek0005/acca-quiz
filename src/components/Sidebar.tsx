/**
 * Sidebar navigation (desktop only — mobile uses the bottom bar).
 */

'use client';

import { useStreakStore, useSRSStore, useMistakesStore } from '@/store/mistakesStore';
import type { ViewName } from '@/types';
import {
  LayoutDashboard,
  HelpCircle,
  AlertTriangle,
  Layers,
  RotateCcw,
  FileText,
  Settings,
} from 'lucide-react';

const NAV_ITEMS: { id: ViewName; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'quiz', label: 'Quiz', icon: HelpCircle },
  { id: 'mistakes', label: 'Mistakes', icon: AlertTriangle },
  { id: 'flashcards', label: 'Flashcards', icon: Layers },
  { id: 'srs', label: 'SRS Review', icon: RotateCcw },
  { id: 'import', label: 'Import / Export', icon: FileText },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export function Sidebar({
  currentView,
  onNavigate,
}: {
  currentView: string;
  onNavigate: (view: ViewName) => void;
}) {
  const current = useStreakStore((s) => s.current);
  const target = useStreakStore((s) => s.target);
  const todayCount = useStreakStore((s) => s.todayCount);
  const progress = target > 0 ? Math.min(100, Math.round((todayCount / target) * 100)) : 0;

  const srsDueCount = useSRSStore((s) => s.getDueCount());
  const mistakes = useMistakesStore((s) => s.mistakes);
  const mistakeCount = Object.values(mistakes).filter((m) => m.lastResult === 'wrong').length;

  return (
    <aside className="sidebar hidden lg:flex w-64 flex-col" aria-label="Main navigation">
      <div className="flex items-center gap-2 px-4 h-16 border-b border-line flex-shrink-0">
        <span className="w-8 h-8 rounded-lg bg-[color:rgb(var(--accent))] text-[color:rgb(var(--accent-ink))] flex items-center justify-center text-sm font-bold">
          FA
        </span>
        <span className="font-bold text-[color:rgb(var(--accent))]">ACCA FA</span>
      </div>

      <nav className="flex-1 overflow-y-auto py-3" aria-label="Main menu">
        {NAV_ITEMS.map((item) => {
          const active = currentView === item.id;
          const badge =
            item.id === 'srs' && srsDueCount > 0
              ? srsDueCount
              : item.id === 'mistakes' && mistakeCount > 0
                ? mistakeCount
                : null;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`sidebar-link w-full ${active ? 'sidebar-link-active' : ''}`}
              aria-current={active ? 'page' : undefined}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
              <span className="flex-1 text-left">{item.label}</span>
              {badge !== null && <span className="badge badge-red">{badge}</span>}
            </button>
          );
        })}
      </nav>

      {/* Compact streak footer */}
      <div className="flex-shrink-0 border-t border-line p-3">
        <div className="flex items-center gap-2.5">
          <span className="streak-flame text-xl" aria-hidden="true">🔥</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg font-bold text-orange-500 leading-none">{current}</span>
              <span className="text-xs text-muted">day{current === 1 ? '' : 's'}</span>
              <span className="ml-auto text-xs text-faint tabular-nums">
                {todayCount}/{target}
              </span>
            </div>
            <div className="progress-bar mt-1.5 h-1.5">
              <div className="progress-fill progress-orange h-full" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

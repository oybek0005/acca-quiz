/**
 * Mobile bottom navigation. Can be hidden (with a small tab to bring it back)
 * so it doesn't cover content on small screens.
 */

'use client';

import { useState } from 'react';
import type { ViewName } from '@/types';
import {
  LayoutDashboard,
  HelpCircle,
  AlertTriangle,
  Layers,
  RotateCcw,
  FileText,
  Settings,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

const NAV_ITEMS: { id: ViewName; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
  { id: 'quiz', label: 'Quiz', icon: HelpCircle },
  { id: 'mistakes', label: 'Mistakes', icon: AlertTriangle },
  { id: 'flashcards', label: 'Cards', icon: Layers },
  { id: 'srs', label: 'SRS', icon: RotateCcw },
  { id: 'import', label: 'Import', icon: FileText },
  { id: 'settings', label: 'Settings', icon: Settings },
];

const LS_KEY = 'faq_mobilenav_hidden';

export function MobileNav({
  currentView,
  onNavigate,
}: {
  currentView: string;
  onNavigate: (view: ViewName) => void;
}) {
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(LS_KEY) === '1';
    } catch {
      return false;
    }
  });

  const setHiddenPersist = (v: boolean) => {
    setHidden(v);
    try {
      localStorage.setItem(LS_KEY, v ? '1' : '0');
    } catch {}
  };

  if (hidden) {
    return (
      <button
        onClick={() => setHiddenPersist(false)}
        className="lg:hidden fixed bottom-2 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 px-3 py-1.5 rounded-full bg-surface border border-line shadow-md text-xs text-muted"
        aria-label="Show navigation"
      >
        <ChevronUp className="w-4 h-4" /> Menu
      </button>
    );
  }

  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-50 bg-surface border-t border-line">
      <div className="flex items-center">
        <div className="flex-1 grid grid-cols-7">
          {NAV_ITEMS.map((item) => {
            const active = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                aria-current={active ? 'page' : undefined}
                className={
                  'flex flex-col items-center gap-0.5 py-2 text-[0.65rem] font-medium transition-colors ' +
                  (active ? 'text-[color:rgb(var(--accent))]' : 'text-muted')
                }
              >
                <item.icon className="w-5 h-5" aria-hidden="true" />
                {item.label}
              </button>
            );
          })}
        </div>
        <button
          onClick={() => setHiddenPersist(true)}
          className="px-2 py-3 text-muted border-l border-line"
          aria-label="Hide navigation"
        >
          <ChevronDown className="w-5 h-5" />
        </button>
      </div>
    </nav>
  );
}

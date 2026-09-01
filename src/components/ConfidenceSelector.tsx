/**
 * Confidence Selector - Low / Medium / High rating before moving on.
 */

'use client';

import { cn } from '@/lib/utils';
import { HelpCircle, Scale, Target } from 'lucide-react';

interface ConfidenceSelectorProps {
  value: 'low' | 'medium' | 'high' | null;
  onChange: (confidence: 'low' | 'medium' | 'high') => void;
  required?: boolean;
}

const OPTIONS = [
  { level: 'low' as const, label: 'Low', hint: 'Guessing', icon: HelpCircle },
  { level: 'medium' as const, label: 'Medium', hint: 'Fairly sure', icon: Scale },
  { level: 'high' as const, label: 'High', hint: 'Confident', icon: Target },
];

export function ConfidenceSelector({ value, onChange, required }: ConfidenceSelectorProps) {
  return (
    <div>
      <div className="confidence-selector" role="radiogroup" aria-label="Confidence rating" aria-required={required}>
        {OPTIONS.map(({ level, label, hint, icon: Icon }) => {
          const selected = value === level;
          return (
            <button
              key={level}
              type="button"
              onClick={() => onChange(level)}
              aria-pressed={selected}
              aria-label={`${label} confidence — ${hint}`}
              className={cn('confidence-btn', selected && 'confidence-btn-selected', required && !value && 'animate-pulse')}
            >
              <span className="flex items-center justify-center gap-1.5">
                <Icon className="w-4 h-4" />
                {label}
              </span>
              <span className="block text-[0.7rem] opacity-70 mt-0.5">{hint}</span>
            </button>
          );
        })}
      </div>
      {required && !value && (
        <p className="text-xs text-muted mt-1.5 text-center">
          Rate how confident you are before continuing.
        </p>
      )}
    </div>
  );
}

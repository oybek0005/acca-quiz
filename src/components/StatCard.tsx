/**
 * Stat Card Component
 */

'use client';

import { ReactNode } from 'react';

interface StatCardProps {
  icon: ReactNode;
  value: string | number;
  label: string;
  subtitle?: string;
  trend?: { value: number; label: string };
}

export function StatCard({ icon, value, label, subtitle, trend }: StatCardProps) {
  return (
    <div className="card">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-1">{value}</p>
          {subtitle && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>}
        </div>
        <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">{icon}</div>
      </div>
      {trend && (
        <div className="mt-3 flex items-center gap-1 text-sm">
          <span className={trend.value >= 0 ? 'text-green-600' : 'text-red-600'}>
            {trend.value >= 0 ? '+' : ''}{trend.value}%
          </span>
          <span className="text-gray-500 dark:text-gray-400">{trend.label}</span>
        </div>
      )}
    </div>
  );
}
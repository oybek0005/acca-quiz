/**
 * Tabs Component - Accessible tab navigation
 */

'use client';

import React, { useState, ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface TabsProps {
  value: string;
  onValueChange: (value: string) => void;
  children: ReactNode;
  className?: string;
}

interface TabProps {
  value: string;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
}

type TabElement = React.ReactElement<TabProps & { isActive?: boolean; onClick?: () => void }>;

function isTabElement(child: React.ReactNode): child is TabElement {
  return React.isValidElement(child) && child.type === Tab;
}

export function Tabs({ value, onValueChange, children, className }: TabsProps) {
  return (
    <div className={cn('flex flex-col', className)} role="tablist">
      <div className="flex border-b border-gray-200 dark:border-gray-700 mb-4">
        {React.Children.map(children, (child) => {
          if (isTabElement(child)) {
            return React.cloneElement(child, {
              isActive: child.props.value === value,
              onClick: () => onValueChange(child.props.value),
            });
          }
          return child;
        })}
      </div>
      <div className="flex-1">
        {React.Children.map(children, (child) => {
          if (isTabElement(child) && child.props.value === value) {
            return child.props.children;
          }
          return null;
        })}
      </div>
    </div>
  );
}

export function Tab({ value, children, className, disabled, isActive, onClick }: TabProps & { isActive?: boolean; onClick?: () => void }) {
  if (typeof children === 'function') {
    // This is the content panel
    return <>{children}</>;
  }

  return (
    <button
      role="tab"
      aria-selected={isActive}
      aria-disabled={disabled}
      onClick={disabled ? undefined : onClick}
      className={cn(
        'px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
        disabled
          ? 'text-gray-400 cursor-not-allowed'
          : isActive
            ? 'text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400'
            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 border-transparent hover:border-gray-300 dark:hover:border-gray-600',
        className
      )}
    >
      {children}
    </button>
  );
}

Tab.displayName = 'Tab';
Tabs.displayName = 'Tabs';
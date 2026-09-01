/**
 * Main App Page - Shell with sidebar navigation and view routing.
 */

'use client';

import { useEffect } from 'react';
import { useQuizStore } from '@/store/quizStore';
import { useQuestionsStore } from '@/store/quizStore';
import { useSRSStore } from '@/store/mistakesStore';
import { Dashboard } from '@/components/Dashboard';
import { QuizView } from '@/components/QuizView';
import { MistakesView } from '@/components/MistakesView';
import { ImportView } from '@/components/ImportView';
import { SettingsView } from '@/components/SettingsView';
import { FlashcardsView } from '@/components/FlashcardsView';
import { SRSView } from '@/components/SRSView';
import { Sidebar } from '@/components/Sidebar';
import { MobileNav } from '@/components/MobileNav';
import { ThemeProvider } from '@/components/ThemeProvider';
import { ToasterProvider } from '@/components/Toaster';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import type { Question } from '@/types';
import bundledBank from '@/data/questions.json';
import { readQuestionFixes } from '@/lib/aiImport';
import { applySeedIfNeeded } from '@/lib/seed';
import { startAutoSync } from '@/lib/firebaseSync';

function buildQuestionBank(): Question[] {
  try {
    const bank = bundledBank as unknown as {
      sections: Record<string, { code?: string; questions?: Array<Partial<Question>> }>;
    };
    const bundled = Object.entries(bank.sections).flatMap(([key, s]) =>
      (s.questions ?? []).map((q) => ({ ...q, section: (q.section || s.code || key) as Question['section'] }))
    ) as Question[];

    let custom: Question[] = [];
    try {
      const raw = localStorage.getItem('faq_custom_questions');
      if (raw) custom = JSON.parse(raw);
    } catch {}

    const seen = new Set(bundled.map((q) => q.id));
    const merged = [...bundled, ...custom.filter((q) => q && q.id && !seen.has(q.id))];

    // Apply any AI-report corrections
    const fixes = readQuestionFixes();
    if (Object.keys(fixes).length) {
      return merged.map((q) => (fixes[q.id] ? ({ ...q, ...fixes[q.id] } as Question) : q));
    }
    return merged;
  } catch {
    return [];
  }
}

export default function Home() {
  const { currentView, setView, session } = useQuizStore();
  const { isLoaded: questionsLoaded, loadQuestions } = useQuestionsStore();
  const { loadCards } = useSRSStore();

  useEffect(() => {
    loadQuestions(buildQuestionBank());
    loadCards({});
    applySeedIfNeeded();
    return startAutoSync();
  }, [loadQuestions, loadCards]);

  if (!questionsLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-current border-t-transparent rounded-full animate-spin text-[color:rgb(var(--accent))]" />
          <p className="text-muted">Loading…</p>
        </div>
      </div>
    );
  }

  const views: Record<string, React.ReactNode> = {
    dashboard: <Dashboard />,
    quiz: session ? <QuizView /> : <Dashboard />,
    mistakes: <MistakesView />,
    import: <ImportView />,
    settings: <SettingsView />,
    flashcards: <FlashcardsView />,
    srs: <SRSView />,
  };

  return (
    <ThemeProvider>
      <ToasterProvider>
        <div className="min-h-screen flex">
          <Sidebar currentView={currentView} onNavigate={setView} />

          <main className="flex-1 min-w-0 lg:ml-64 min-h-screen">
            <div className="p-4 sm:p-6 lg:pl-8 pb-28 lg:pb-8 max-w-[1400px]">
              <ErrorBoundary key={currentView}>{views[currentView] || views.dashboard}</ErrorBoundary>
            </div>
          </main>

          <MobileNav currentView={currentView} onNavigate={setView} />
        </div>
      </ToasterProvider>
    </ThemeProvider>
  );
}

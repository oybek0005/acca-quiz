/**
 * Mistakes View - 4 tabs: All, High Confidence Errors, Slow Questions, SRS Due
 */

'use client';

import { useState, useMemo } from 'react';
import { useMistakesStore } from '@/store/mistakesStore';
import { useSRSStore } from '@/store/mistakesStore';
import { useQuestionsStore } from '@/store/quizStore';
import { useQuizStore } from '@/store/quizStore';
import { useAttemptsStore } from '@/store/attemptsStore';
import { Question, MistakeRecord, SectionCode } from '@/types';
import { SECTION_ORDER, SECTIONS } from '@/types';
import { normalizeQuestion } from '@/lib/questions';
import { cn, formatTime, getRelativeTime } from '@/lib/utils';
import { Tabs, Tab } from '@/components/ui/Tabs';
import { SRS_RATING_BUTTONS } from '@/lib/srs';
import { AlertTriangle, Clock, Brain, RotateCcw, RefreshCw, ExternalLink, Plus } from 'lucide-react';

const CUSTOM_Q_KEY = 'faq_custom_questions';

type MistakeFilter = 'all' | 'highConfidence' | 'slow' | 'srsDue';

export function MistakesView() {
  const { mistakes, getMistakesBySection, clearMistake, clearAllMistakes } = useMistakesStore();
  const { getDueCards, reviewCard } = useSRSStore();
  const { questions } = useQuestionsStore();
  const { startQuiz } = useQuizStore();

  const { updateFromAttempts } = useMistakesStore();
  const { recordAttempt } = useAttemptsStore();
  const { loadQuestions } = useQuestionsStore();

  const [activeTab, setActiveTab] = useState<MistakeFilter>('all');
  const [selectedQuestions, setSelectedQuestions] = useState<Set<string>>(new Set());
  const [showAdd, setShowAdd] = useState(false);
  const [addText, setAddText] = useState('');
  const [addSection, setAddSection] = useState<SectionCode>('DE');

  const addManualMistake = () => {
    const text = addText.trim();
    if (!text) return;
    const q = normalizeQuestion({
      id: `MANUAL-${Date.now().toString(36)}`,
      t: 'manual',
      q: text,
      a: null,
      ex: 'Added manually — no model answer.',
      section: addSection,
      topic: 'Manual entry',
      subtopic: 'Manual entry',
      difficulty: 'medium',
      source: 'custom',
    });
    try {
      const custom = JSON.parse(localStorage.getItem(CUSTOM_Q_KEY) || '[]');
      custom.push(q);
      localStorage.setItem(CUSTOM_Q_KEY, JSON.stringify(custom));
    } catch {}
    loadQuestions([...questions, q]);
    updateFromAttempts([
      { qId: q.id, section: addSection, correct: false, timeSpent: 0, confidence: null, subtopic: 'Manual entry', difficulty: 'medium', timestamp: new Date().toISOString() },
    ]);
    useSRSStore.getState().syncFromMistakes();
    recordAttempt({ mode: 'manual', sectionLabel: 'Manual entry', results: [{ qId: q.id, section: addSection, correct: false, timeSpent: 0, confidence: null, subtopic: 'Manual entry', difficulty: 'medium', timestamp: new Date().toISOString() }] });
    setAddText('');
    setShowAdd(false);
  };

  const questionMap = useMemo(() => new Map(questions.map(q => [q.id, q])), [questions]);

  const filteredMistakes = useMemo(() => {
    switch (activeTab) {
      case 'highConfidence':
        return Object.values(mistakes).filter(m => m.highConfidenceErrors > 0 && m.lastResult === 'wrong');
      case 'slow':
        return Object.values(mistakes).filter(m => m.avgTimeSpent > 90 && m.lastResult === 'wrong');
      case 'srsDue':
        const dueCards = getDueCards();
        const dueQIds = new Set(dueCards.map(d => d.qId));
        return Object.values(mistakes).filter(m => dueQIds.has(m.qId) && m.lastResult === 'wrong');
      default:
        return Object.values(mistakes).filter(m => m.lastResult === 'wrong');
    }
  }, [mistakes, activeTab, getDueCards]);

  const handleRetry = (qIds: string[]) => {
    const quizQuestions = questions.filter(q => qIds.includes(q.id));
    if (quizQuestions.length > 0) {
      startQuiz(quizQuestions, 'Mistake Retry', 'mistakes');
    }
  };

  const handleSRSReview = (qId: string, quality: 0 | 1 | 2 | 3 | 4 | 5) => {
    reviewCard(qId, quality);
  };

  const totalWrong = Object.values(mistakes).reduce((sum, m) => sum + m.wrongCount, 0);

  const AddForm = showAdd ? (
    <div className="card">
      <h3 className="font-semibold mb-2 text-sm">Log a question you got wrong elsewhere</h3>
      <textarea
        value={addText}
        onChange={(e) => setAddText(e.target.value)}
        rows={3}
        placeholder="Paste or type the question you missed on a paper mock…"
        className="input"
      />
      <div className="flex flex-wrap gap-2 mt-2 items-center">
        <select value={addSection} onChange={(e) => setAddSection(e.target.value as SectionCode)} className="input max-w-[220px]">
          {SECTION_ORDER.map((s) => (
            <option key={s} value={s}>{SECTIONS[s].name}</option>
          ))}
        </select>
        <button onClick={addManualMistake} disabled={!addText.trim()} className="btn-primary btn-sm">
          Add to mistake bank
        </button>
        <button onClick={() => setShowAdd(false)} className="btn-ghost btn-sm">Cancel</button>
      </div>
    </div>
  ) : null;

  if (Object.keys(mistakes).length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Mistake bank</h1>
          <button onClick={() => setShowAdd((v) => !v)} className="btn-secondary btn-sm">
            <Plus className="w-4 h-4" /> Add a mistake
          </button>
        </div>
        {AddForm}
        <div className="card text-center py-12">
          <AlertTriangle className="w-14 h-14 text-faint mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-1">No mistakes yet</h2>
          <p className="text-muted">Finish a quiz, or add one you missed on paper.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Mistake Bank</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {totalWrong} total mistakes • {filteredMistakes.length} showing
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setShowAdd((v) => !v)} className="btn-secondary btn-sm">
            <Plus className="w-4 h-4" /> Add
          </button>
          <button onClick={() => handleRetry(filteredMistakes.map(m => m.qId))} className="btn-primary btn-sm" disabled={filteredMistakes.length === 0}>
            <RefreshCw className="w-4 h-4" /> Retry all ({filteredMistakes.length})
          </button>
          {activeTab === 'all' && Object.keys(mistakes).length > 0 && (
            <button onClick={clearAllMistakes} className="btn-ghost btn-sm text-red-600">
              Clear all
            </button>
          )}
        </div>
      </div>

      {AddForm}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as MistakeFilter)}>
        <Tab value="all">All Mistakes</Tab>
        <Tab value="highConfidence">High Confidence Errors</Tab>
        <Tab value="slow">Slow Questions ({'>'}90s)</Tab>
        <Tab value="srsDue">SRS Due Today</Tab>
      </Tabs>

      {/* Mistake List */}
      <div className="card">
        {filteredMistakes.length === 0 ? (
          <div className="text-center py-12">
            <AlertTriangle className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">No mistakes in this category</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredMistakes.map((mistake) => {
              const question = questionMap.get(mistake.qId);
              const srsStats = useSRSStore.getState().getCardStats(mistake.qId);
              const isSelected = selectedQuestions.has(mistake.qId);

              return (
                <div
                  key={mistake.qId}
                  className={cn(
                    'p-4 rounded-lg border transition-colors',
                    isSelected ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300' : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50'
                  )}
                >
                  <div className="flex items-start gap-4">
                    {/* Checkbox */}
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => {
                        const newSet = new Set(selectedQuestions);
                        if (e.target.checked) newSet.add(mistake.qId);
                        else newSet.delete(mistake.qId);
                        setSelectedQuestions(newSet);
                      }}
                      className="mt-1 w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                    />

                    {/* Question Preview */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`badge badge-${mistake.section}`}>{mistake.section}</span>
                        {question?.subtopic && <span className="badge badge-gray">{question.subtopic}</span>}
                        {question?.difficulty && <span className={`badge badge-${question.difficulty}`}>{question.difficulty}</span>}
                      </div>
                      <p className="font-medium text-gray-900 dark:text-gray-100 truncate">
                        {question ? question.q.replace(/<[^>]*>/g, '').slice(0, 120) : `Question ${mistake.qId}`}
                      </p>
                      <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-gray-500 dark:text-gray-400">
                        <span className="flex items-center gap-1">
                          <AlertTriangle className="w-4 h-4" /> Wrong: {mistake.wrongCount}
                        </span>
                        <span className="flex items-center gap-1">
                          <CheckCircle className="w-4 h-4 text-green-500" /> Correct: {mistake.correctCount}
                        </span>
                        {mistake.highConfidenceErrors > 0 && (
                          <span className="flex items-center gap-1 badge badge-purple">
                            <Brain className="w-3 h-3" /> High-conf errors: {mistake.highConfidenceErrors}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" /> Avg: {formatTime(Math.round(mistake.avgTimeSpent))}
                        </span>
                        {srsStats && (
                          <span className={cn('flex items-center gap-1 badge', srsStats.overdue ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800')}>
                            <RotateCcw className="w-3 h-3" />
                            SRS: {srsStats.overdue ? 'Overdue' : `Due in ${srsStats.daysUntil}d`} (Interval: {srsStats.interval}d)
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => handleRetry([mistake.qId])}
                        className="btn-primary btn-sm"
                      >
                        Retry
                      </button>
                      {question && (
                        <button
                          onClick={() => startQuiz([question], `Flashcard: ${question.id}`, 'flashcard')}
                          className="btn-secondary btn-sm"
                        >
                          <ExternalLink className="w-4 h-4" /> Flashcard
                        </button>
                      )}
                      {srsStats && (
                        <div className="flex gap-1">
                          {SRS_RATING_BUTTONS.map(({ quality, label }) => (
                            <button
                              key={quality}
                              onClick={() => handleSRSReview(mistake.qId, quality)}
                              className={cn(
                                'btn-ghost btn-sm px-2 py-1 text-xs',
                                quality === 0 ? 'text-red-600' : quality === 2 ? 'text-orange-600' : 'text-green-600'
                              )}
                              title={`Mark "${label}"`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bulk Actions */}
      {selectedQuestions.size > 0 && (
        <div className="card border-blue-300 dark:border-blue-700">
          <div className="flex items-center justify-between">
            <span className="font-medium">{selectedQuestions.size} questions selected</span>
            <div className="flex gap-2">
              <button onClick={() => handleRetry(Array.from(selectedQuestions))} className="btn-primary btn-sm">
                <RefreshCw className="w-4 h-4" /> Retry Selected
              </button>
              <button onClick={() => setSelectedQuestions(new Set())} className="btn-ghost btn-sm">
                Clear Selection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Need to import CheckCircle
import { CheckCircle } from 'lucide-react';
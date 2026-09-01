/**
 * Flashcards View - Study mode with flip cards and SRS integration
 */

'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useQuestionsStore } from '@/store/quizStore';
import { useSRSStore } from '@/store/mistakesStore';
import { useMistakesStore } from '@/store/mistakesStore';
import { cn, shuffleArray } from '@/lib/utils';
import { answerText } from '@/lib/questions';
import { safeHtml } from '@/lib/sanitize';
import { SRS_RATING_BUTTONS } from '@/lib/srs';
import type { SRSQuality } from '@/types';
import { RotateCcw, RefreshCw, Brain, Target, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';

export function FlashcardsView() {
  const { questions, questionBank } = useQuestionsStore();
  const { getCardStats, getDueCards, reviewCard } = useSRSStore();
  const { mistakes } = useMistakesStore();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [filterSection, setFilterSection] = useState<string>('all');
  const [filterDifficulty, setFilterDifficulty] = useState<string>('all');
  const [showOnlyDue, setShowOnlyDue] = useState(false);
  const [showOnlyMistakes, setShowOnlyMistakes] = useState(false);
  const [shuffleNonce, setShuffleNonce] = useState(0);

  const sections = useMemo(() => Object.keys(questionBank), [questionBank]);

  const filteredQuestions = useMemo(() => {
    // Full financial-statements questions don't work as a two-sided flashcard.
    let filtered = questions.filter((q) => q.t !== 'fs');

    if (filterSection !== 'all') {
      filtered = filtered.filter(q => q.section === filterSection);
    }
    if (filterDifficulty !== 'all') {
      filtered = filtered.filter(q => q.difficulty === filterDifficulty);
    }
    if (showOnlyDue) {
      const dueQIds = new Set(getDueCards().map(d => d.qId));
      filtered = filtered.filter(q => dueQIds.has(q.id));
    }
    if (showOnlyMistakes) {
      const mistakeQIds = new Set(Object.keys(mistakes).filter(qId => mistakes[qId].lastResult === 'wrong'));
      filtered = filtered.filter(q => mistakeQIds.has(q.id));
    }
    // shuffleNonce forces a re-shuffle; identity otherwise stable per filter set
    return shuffleNonce >= 0 ? shuffleArray(filtered) : filtered;
     
  }, [questions, filterSection, filterDifficulty, showOnlyDue, showOnlyMistakes, getDueCards, mistakes, shuffleNonce]);

  const totalCards = filteredQuestions.length;
  const safeIndex = currentIndex < totalCards ? currentIndex : 0;
  const currentCard = filteredQuestions[safeIndex];

  const srsStats = currentCard ? getCardStats(currentCard.id) : null;
  const mistakeData = currentCard ? mistakes[currentCard.id] : null;

  const nextCard = useCallback(() => {
    setCurrentIndex(i => (i < totalCards - 1 ? i + 1 : 0));
    setIsFlipped(false);
  }, [totalCards]);

  const prevCard = useCallback(() => {
    setCurrentIndex(i => (i > 0 ? i - 1 : Math.max(0, totalCards - 1)));
    setIsFlipped(false);
  }, [totalCards]);

  const handleRate = useCallback((quality: SRSQuality) => {
    if (currentCard) {
      reviewCard(currentCard.id, quality);
      nextCard();
    }
  }, [currentCard, reviewCard, nextCard]);

  const shuffleCards = () => {
    setShuffleNonce(n => n + 1);
    setCurrentIndex(0);
    setIsFlipped(false);
  };

  // Keyboard: Space/Enter flip, ← → navigate, 1-4 rate (when flipped)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT')) return;
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setIsFlipped(f => !f); }
      else if (e.key === 'ArrowRight') nextCard();
      else if (e.key === 'ArrowLeft') prevCard();
      else if (isFlipped && ['1', '2', '3', '4'].includes(e.key)) {
        handleRate(SRS_RATING_BUTTONS[Number(e.key) - 1].quality);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isFlipped, nextCard, prevCard, handleRate]);

  if (totalCards === 0) {
    return (
      <div className="card text-center py-12">
        <Brain className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">No Cards to Show</h2>
        <p className="text-gray-500 dark:text-gray-400 mb-4">
          {showOnlyDue ? 'No cards due for review today.' : showOnlyMistakes ? 'No mistakes to review.' : 'No questions match your filters.'}
        </p>
        <div className="flex gap-2 justify-center">
          <Button variant="secondary" onClick={() => setShowOnlyDue(false)}>Show All</Button>
          <Button variant="secondary" onClick={() => setShowOnlyMistakes(false)}>Clear Mistakes Filter</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Flashcards</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {totalCards} cards • {safeIndex + 1}/{totalCards}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={shuffleCards}>
            <RefreshCw className="w-4 h-4" /> Shuffle
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Filters:</span>
          </div>

          <Select
            value={filterSection}
            onChange={(e) => setFilterSection(e.target.value)}
            options={[
              { value: 'all', label: 'All Sections' },
              ...sections.map(s => ({ value: s, label: s }))
            ]}
            className="w-40"
          />

          <Select
            value={filterDifficulty}
            onChange={(e) => setFilterDifficulty(e.target.value)}
            options={[
              { value: 'all', label: 'All Difficulties' },
              { value: 'easy', label: 'Easy' },
              { value: 'medium', label: 'Medium' },
              { value: 'hard', label: 'Hard' },
            ]}
            className="w-40"
          />

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showOnlyDue}
              onChange={(e) => setShowOnlyDue(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">SRS Due Only</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showOnlyMistakes}
              onChange={(e) => setShowOnlyMistakes(e.target.checked)}
              className="w-4 h-4 text-red-600 rounded border-gray-300 focus:ring-red-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">Mistakes Only</span>
          </label>
        </div>
      </div>

      {/* Flashcard */}
      <div className="card" style={{ perspective: '1000px' }}>
        <div
          className={cn(
            'relative w-full aspect-[4/3] max-w-3xl mx-auto cursor-pointer transition-transform duration-700 transform-style-3d',
            isFlipped && 'rotate-y-180'
          )}
          onClick={() => setIsFlipped(!isFlipped)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && setIsFlipped(!isFlipped)}
          aria-label={isFlipped ? 'Show question' : 'Show answer'}
        >
          {/* Front - Question */}
          <div className="absolute w-full h-full backface-hidden bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 flex flex-col justify-center items-center text-center">
            <div className="flex items-center gap-2 mb-4">
              <span className={`badge badge-${currentCard?.section}`}>{currentCard?.section}</span>
              {currentCard?.subtopic && <span className="badge badge-gray">{currentCard.subtopic}</span>}
              {currentCard?.difficulty && <span className={`badge badge-${currentCard.difficulty}`}>{currentCard.difficulty}</span>}
            </div>
            <div className="text-2xl md:text-3xl font-medium text-gray-900 dark:text-gray-100 mb-6 leading-relaxed">
              {currentCard?.q.replace(/<[^>]*>/g, '') || 'Loading...'}
            </div>
            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
              <RotateCcw className="w-5 h-5 animate-spin" />
              <span>Click or press Space to flip</span>
            </div>
          </div>

          {/* Back - Answer */}
          <div className="absolute w-full h-full backface-hidden rotate-y-180 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800 p-8 flex flex-col justify-center items-center text-center">
            <div className="flex items-center gap-2 mb-4">
              <span className="badge bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Answer</span>
            </div>
            <div className="text-2xl md:text-3xl font-medium text-gray-900 dark:text-gray-100 mb-6 leading-relaxed">
              {currentCard ? answerText(currentCard) : 'No answer'}
            </div>
            {currentCard?.ex && (
              <div className="rich-text max-w-none text-gray-700 dark:text-gray-300 mb-6" dangerouslySetInnerHTML={safeHtml(currentCard.ex)} />
            )}
            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-4">
              <Target className="w-4 h-4" />
              <span>Rate your recall to schedule next review</span>
            </div>

            {/* SRS Rating Buttons */}
            <div className="flex flex-wrap justify-center gap-2">
              {SRS_RATING_BUTTONS.map(({ quality, label }, i) => (
                <button
                  key={quality}
                  onClick={(e) => { e.stopPropagation(); handleRate(quality); }}
                  className={cn('px-4 py-2 rounded-lg font-medium text-sm transition-colors', SRS_RATING_BUTTONS[i].soft)}
                >
                  <span className="mr-1 opacity-60">{i + 1}</span>{label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Progress Indicators */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-4">
            {srsStats && (
              <div className={cn('px-3 py-1 rounded-full text-xs font-medium', srsStats.overdue ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800')}>
                {srsStats.overdue ? 'Overdue' : `Due in ${srsStats.daysUntil}d`}
              </div>
            )}
            {mistakeData && mistakeData.lastResult === 'wrong' && (
              <div className="px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                Mistake ({mistakeData.wrongCount}x)
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <span>Progress: {Math.round(((safeIndex + 1) / totalCards) * 100)}%</span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="secondary" onClick={prevCard} disabled={totalCards === 0}>
          <ChevronLeft className="w-4 h-4" /> Previous
        </Button>

        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {safeIndex + 1} / {totalCards}
          </span>
        </div>

        <Button variant="primary" onClick={nextCard} disabled={totalCards === 0}>
          Next <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Keyboard Shortcuts Hint */}
      <div className="card p-4 bg-gray-50 dark:bg-gray-800/50">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600 dark:text-gray-400">
          <kbd className="px-2 py-1 bg-white dark:bg-gray-700 rounded border">Space / Click</kbd> <span>Flip card</span>
          <kbd className="px-2 py-1 bg-white dark:bg-gray-700 rounded border">← / →</kbd> <span>Previous / Next</span>
          <kbd className="px-2 py-1 bg-white dark:bg-gray-700 rounded border">1</kbd> <span>Again</span>
          <kbd className="px-2 py-1 bg-white dark:bg-gray-700 rounded border">2</kbd> <span>Hard</span>
          <kbd className="px-2 py-1 bg-white dark:bg-gray-700 rounded border">3</kbd> <span>Good</span>
          <kbd className="px-2 py-1 bg-white dark:bg-gray-700 rounded border">4</kbd> <span>Easy</span>
        </div>
      </div>
    </div>
  );
}
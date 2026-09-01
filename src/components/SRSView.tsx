/**
 * SRS Review View - Spaced repetition session interface
 */

'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useQuestionsStore } from '@/store/quizStore';
import { useSRSStore } from '@/store/mistakesStore';
import { useMistakesStore } from '@/store/mistakesStore';
import { Question, SRSCard, SRSQuality } from '@/types';
import { cn } from '@/lib/utils';
import { answerText } from '@/lib/questions';
import { safeHtml } from '@/lib/sanitize';
import { SRS_RATING_BUTTONS } from '@/lib/srs';
import { Button } from '@/components/ui/Button';
import { RotateCcw, Brain, CheckCircle, Clock, AlertCircle } from 'lucide-react';

interface DueCard {
  card: SRSCard & { qId: string };
  question: Question;
}

export function SRSView() {
  const { questions, questionBank } = useQuestionsStore();
  const { getDueCards, reviewCard, getCardStats, cards } = useSRSStore();
  const { mistakes } = useMistakesStore();

  const [sessionActive, setSessionActive] = useState(false);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [reviewedCount, setReviewedCount] = useState(0);

  const dueCards = useMemo(() => getDueCards(), [getDueCards]);

  const questionById = useMemo(
    () => new Map(questions.map(q => [q.id, q])),
    [questions]
  );

  const sessionCards: DueCard[] = useMemo(() => {
    return dueCards
      .map(card => {
        const q = questionById.get(card.qId);
        return q ? { card: { ...card.card, qId: card.qId }, question: q } : null;
      })
      .filter((x): x is DueCard => x !== null);
  }, [dueCards, questionById]);

  const currentCard = sessionCards[currentCardIndex];
  const totalCards = sessionCards.length;

  const startSession = () => {
    if (totalCards === 0) return;
    setSessionActive(true);
    setCurrentCardIndex(0);
    setShowAnswer(false);
    setReviewedCount(0);
    setSessionComplete(false);
  };

  const handleRate = useCallback((quality: SRSQuality) => {
    if (!currentCard) return;
    reviewCard(currentCard.card.qId, quality);
    setReviewedCount((c) => c + 1);
    if (currentCardIndex < totalCards - 1) {
      setCurrentCardIndex((i) => i + 1);
      setShowAnswer(false);
    } else {
      setSessionActive(false);
      setSessionComplete(true);
    }
  }, [currentCard, reviewCard, currentCardIndex, totalCards]);

  // Keyboard: Space reveals the answer; 1-4 rate once revealed.
  useEffect(() => {
    if (!sessionActive) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ') { e.preventDefault(); setShowAnswer(true); }
      else if (showAnswer && ['1', '2', '3', '4'].includes(e.key)) {
        handleRate(SRS_RATING_BUTTONS[Number(e.key) - 1].quality);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sessionActive, showAnswer, handleRate]);

  const getUrgencyColor = (daysOverdue: number) => {
    if (daysOverdue <= 0) return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    if (daysOverdue <= 3) return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
    return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
  };

  if (sessionComplete) {
    return (
      <div className="card text-center py-12 animate-fade-in">
        <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Session Complete!</h2>
        <p className="text-gray-500 dark:text-gray-400 mb-6">
          You reviewed {reviewedCount} card{reviewedCount !== 1 ? 's' : ''} this session.
        </p>
        <div className="flex gap-3 justify-center">
          <Button variant="primary" onClick={startSession}>
            <RotateCcw className="w-4 h-4" /> Review More Due Cards
          </Button>
        </div>
      </div>
    );
  }

  if (!sessionActive) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">SRS Review</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              Spaced repetition for long-term retention
            </p>
          </div>
          {totalCards > 0 && (
            <Button variant="primary" onClick={startSession}>
              <RotateCcw className="w-4 h-4" /> Start Session ({totalCards})
            </Button>
          )}
        </div>

        {/* Due Cards Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Due Today</h3>
              <Clock className="w-5 h-5 text-blue-500" />
            </div>
            <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">{totalCards}</div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">cards ready for review</p>
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Reviewed</h3>
              <AlertCircle className="w-5 h-5 text-orange-500" />
            </div>
            <div className="text-3xl font-bold text-orange-600 dark:text-orange-400">
              {Object.values(cards).filter((c) => c.reps > 0 || c.lastReviewed).length}
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">cards reviewed at least once</p>
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Total Tracked</h3>
              <Brain className="w-5 h-5 text-purple-500" />
            </div>
            <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">{Object.keys(cards).length}</div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">cards in the SRS system</p>
          </div>
        </div>

        {/* Due Cards List */}
        {totalCards === 0 ? (
          <div className="card text-center py-12">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">All Caught Up!</h2>
            <p className="text-gray-500 dark:text-gray-400">No cards are due for review right now. Come back later or add more cards to SRS.</p>
          </div>
        ) : (
          <div className="card">
            <h2 className="font-semibold text-lg text-gray-900 dark:text-gray-100 mb-4">Cards Due for Review</h2>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {sessionCards.map(({ card, question }) => {
                const stats = getCardStats(card.qId);
                const mistakeData = mistakes[card.qId];

                return (
                  <div
                    key={card.qId}
                    className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`badge badge-${question.section}`}>{question.section}</span>
                        <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', getUrgencyColor(stats?.daysUntil ?? 0))}>
                          {stats?.overdue ? `${Math.abs(stats.daysUntil)}d overdue` : `Due in ${stats?.daysUntil}d`}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {question?.q.replace(/<[^>]*>/g, '').slice(0, 80) || card.qId}
                      </p>
                    </div>
                    {mistakeData?.lastResult === 'wrong' && (
                      <span className="badge bg-red-100 text-red-800 text-xs">Mistake</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Active session view
  return (
    <div className="space-y-6">
      {/* Progress */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Card {currentCardIndex + 1} / {totalCards}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <RotateCcw className="w-4 h-4 text-blue-500" />
          <span className="text-sm text-gray-500 dark:text-gray-400">SRS Session</span>
        </div>
      </div>

      <div className="progress-bar">
        <div
          className="progress-fill progress-blue"
          style={{ width: `${((currentCardIndex + (showAnswer ? 1 : 0)) / totalCards) * 100}%` }}
        ></div>
      </div>

      {/* Card */}
      {currentCard && (
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <span className={`badge badge-${currentCard.question.section}`}>{currentCard.question.section}</span>
            {currentCard.question.subtopic && <span className="badge badge-gray">{currentCard.question.subtopic}</span>}
            {currentCard.question.difficulty && <span className={`badge badge-${currentCard.question.difficulty}`}>{currentCard.question.difficulty}</span>}
          </div>

          <div className="text-2xl font-medium text-gray-900 dark:text-gray-100 mb-6 leading-relaxed">
            {currentCard.question.q.replace(/<[^>]*>/g, '')}
          </div>

          {!showAnswer ? (
            <div className="space-y-4">
              <Button
                variant="primary"
                onClick={() => setShowAnswer(true)}
                className="w-full"
              >
                Show Answer
              </Button>
              <div className="text-center text-sm text-gray-500 dark:text-gray-400">
                Press <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded border">Space</kbd> to reveal
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                <p className="font-semibold text-green-800 dark:text-green-200 mb-2">Answer:</p>
                <p className="text-lg text-gray-900 dark:text-gray-100">
                  {answerText(currentCard.question)}
                </p>
                {currentCard.question.ex && (
                  <div
                    className="rich-text max-w-none text-gray-700 dark:text-gray-300 mt-2"
                    dangerouslySetInnerHTML={safeHtml(currentCard.question.ex)}
                  />
                )}
              </div>

              <div>
                <p className="text-center font-medium text-gray-900 dark:text-gray-100 mb-3">
                  How well did you recall this?
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {SRS_RATING_BUTTONS.map(({ quality, label, description, solid }, i) => (
                    <button
                      key={quality}
                      onClick={() => handleRate(quality)}
                      className={cn(solid, 'p-4 rounded-lg font-medium transition-colors flex flex-col items-center')}
                    >
                      <span className="text-lg">
                        <span className="opacity-60 mr-1 text-sm">{i + 1}</span>{label}
                      </span>
                      <span className="text-xs opacity-90 mt-1">{description}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
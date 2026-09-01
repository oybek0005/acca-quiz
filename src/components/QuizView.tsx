/**
 * Quiz View - Tutor/Exam interaction, deferred grading, live timer, save & resume.
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuizStore } from '@/store/quizStore';
import { useSettingsStore } from '@/store/quizStore';
import { useStreakStore } from '@/store/mistakesStore';
import { useMistakesStore } from '@/store/mistakesStore';
import { useSRSStore } from '@/store/mistakesStore';
import { useAttemptsStore } from '@/store/attemptsStore';
import { useSavedQuizStore } from '@/store/savedQuizStore';
import { useToaster } from '@/components/Toaster';
import type { QuestionAttempt, ConfidenceLevel } from '@/types';
import { checkAnswer, isAutoGraded } from '@/lib/questions';
import { playCorrect, playIncorrect, playComplete } from '@/lib/feedback';
import { QuestionCard } from '@/components/QuestionCard';
import { QuizHeader } from '@/components/QuizHeader';
import { QuizNavigation } from '@/components/QuizNavigation';
import { QuizResults } from '@/components/QuizResults';
import { ConfidenceSelector } from '@/components/ConfidenceSelector';
import { CheckCircle, ArrowRight } from 'lucide-react';

const AUTO_ADVANCE_MS = 1100;

export function QuizView() {
  const {
    session,
    goToQuestion,
    nextQuestion,
    prevQuestion,
    answerQuestion,
    revealQuestion,
    markQuestionSeen,
    setConfidence,
    submitQuiz,
    endQuiz,
    setView,
  } = useQuizStore();

  const { showTimer, requireConfidence, soundEnabled } = useSettingsStore();
  const toast = useToaster();

  const [showResults, setShowResults] = useState(false);
  const [results, setResults] = useState<QuestionAttempt[]>([]);
  const [paused, setPaused] = useState(false);
  const [pausedMs, setPausedMs] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentIndex = session?.currentIndex ?? 0;
  const question = session?.questions[currentIndex];
  const totalQuestions = session?.questions.length ?? 0;
  const isLast = currentIndex === totalQuestions - 1;

  const isExam = session?.interaction === 'exam';
  const isTutor = session?.interaction === 'tutor';
  const isMistakesMode = session?.mode === 'mistakes';

  const hasAnswer = !!question && !!session && question.id in session.answers;
  const isRevealed = !!question && !!session && !!session.revealed[question.id];
  const needsCheckButton =
    !!question && (question.t === 'multi' || question.t === 'numeric' || question.t === 'manual' || question.t === 'fs');
  const showExplanation = (isTutor && isRevealed) || isMistakesMode;

  const clearAdvance = useCallback(() => {
    if (advanceTimer.current) {
      clearTimeout(advanceTimer.current);
      advanceTimer.current = null;
    }
  }, []);

  const handleSubmit = useCallback(() => {
    if (!session) return;
    clearAdvance();
    const attempts = submitQuiz();
    if (attempts.length === 0) return;

    useMistakesStore.getState().updateFromAttempts(attempts);
    useSRSStore.getState().syncFromMistakes();
    useAttemptsStore.getState().recordAttempt({
      mode: session.mode,
      sectionLabel: session.title,
      results: attempts,
    });
    const streak = useStreakStore.getState();
    streak.updateStreak();
    for (let i = 0; i < attempts.length; i++) streak.incrementTodayCount();

    playComplete(soundEnabled);
    setResults(attempts);
    setShowResults(true);
  }, [session, submitQuiz, soundEnabled, clearAdvance]);

  const advanceOrFinish = useCallback(() => {
    if (isLast) handleSubmit();
    else nextQuestion();
  }, [isLast, handleSubmit, nextQuestion]);

  /** Grade the current question, play sound, and (tutor + correct) auto-advance. */
  const reveal = useCallback(() => {
    if (!question || !session) return;
    revealQuestion(question.id);
    const answer = session.answers[question.id];
    const correct = isAutoGraded(question) && checkAnswer(question, answer);
    if (correct) playCorrect(soundEnabled);
    else playIncorrect(soundEnabled);

    // Tutor: glide on when correct, wait for the learner when wrong.
    // Never auto-advance an fs question — the learner needs time with the worked solution.
    if (isTutor && correct && question.t !== 'fs') {
      clearAdvance();
      advanceTimer.current = setTimeout(advanceOrFinish, AUTO_ADVANCE_MS);
    }
  }, [question, session, revealQuestion, soundEnabled, isTutor, advanceOrFinish, clearAdvance]);

  const handleAnswer = useCallback(
    (answer: unknown) => {
      if (!question) return;
      clearAdvance();
      answerQuestion(question.id, answer);
      // Single-tap types (MCQ, True/False) grade immediately in tutor mode.
      if (isTutor && (question.t === 'mcq' || question.t === 'tf')) {
        // reveal() reads the just-set answer from the store on the next tick
        setTimeout(reveal, 0);
      }
    },
    [question, answerQuestion, isTutor, reveal, clearAdvance]
  );

  const handleConfidence = useCallback(
    (confidence: ConfidenceLevel) => {
      if (question) setConfidence(question.id, confidence);
    },
    [question, setConfidence]
  );

  const togglePause = useCallback(() => {
    setPaused((p) => {
      if (!p) return true;
      setPausedMs((ms) => ms + (Date.now() - now));
      return false;
    });
  }, [now]);

  const saveAndExit = useCallback(() => {
    if (!session) return;
    useSavedQuizStore.getState().save(session);
    toast.success('Quiz saved', 'Resume it from Dashboard → Saved quizzes');
    endQuiz();
    setView('dashboard');
  }, [session, toast, endQuiz, setView]);

  // Seen-time stamp
  useEffect(() => {
    if (question) markQuestionSeen(question.id);
  }, [question, markQuestionSeen]);

  // Live timer
  useEffect(() => {
    if (paused || showResults) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [paused, showResults]);

  // Cancel a pending auto-advance if the user navigates away manually
  useEffect(() => clearAdvance, [currentIndex, clearAdvance]);
  useEffect(() => clearAdvance, [clearAdvance]);

  // Keyboard: ← / → navigate (not while typing)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return;
      if (e.key === 'ArrowRight' && currentIndex < totalQuestions - 1) {
        clearAdvance();
        nextQuestion();
      }
      if (e.key === 'ArrowLeft' && currentIndex > 0) {
        clearAdvance();
        prevQuestion();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [currentIndex, totalQuestions, nextQuestion, prevQuestion, clearAdvance]);

  const elapsedTime = session
    ? Math.max(0, Math.round((now - session.startedAt - pausedMs) / 1000))
    : 0;

  if (!session || !question) {
    return (
      <div className="card text-center py-12">
        <p className="text-muted">No active quiz session.</p>
        <button onClick={() => setView('dashboard')} className="btn btn-primary mt-4">
          Back to Dashboard
        </button>
      </div>
    );
  }

  if (showResults) {
    return (
      <QuizResults
        results={results}
        questions={session.questions}
        mode={session.mode}
        onRetry={() => {
          setShowResults(false);
          setPausedMs(0);
          setNow(Date.now());
          useQuizStore.getState().startQuiz(session.questions, session.title, session.mode, session.interaction);
        }}
        onDashboard={() => {
          setShowResults(false);
          endQuiz();
          setView('dashboard');
        }}
        onMistakes={() => {
          setShowResults(false);
          endQuiz();
          setView('mistakes');
        }}
      />
    );
  }

  const confidenceRequired = isExam || requireConfidence;
  const answeredCount = Object.keys(session.answers).length;
  const correctNow = isRevealed && isAutoGraded(question) && checkAnswer(question, session.answers[question.id]);
  // fs never auto-advances, so it always needs an explicit Continue after reveal.
  const showContinue = isTutor && isRevealed && (!correctNow || question.t === 'fs');

  // When can the user move on?
  //  - exam: as soon as they've answered (+ rated confidence if required)
  //  - tutor: after the question is revealed
  const canProceed = isExam ? hasAnswer && (!confidenceRequired || !!session.confidenceAnswers[question.id]) : isRevealed;

  return (
    <div className="space-y-4">
      <QuizHeader
        title={session.title}
        mode={session.mode}
        interaction={session.interaction}
        current={currentIndex + 1}
        total={totalQuestions}
        elapsedTime={elapsedTime}
        showTimer={showTimer}
        onPause={togglePause}
        paused={paused}
        onSave={saveAndExit}
        onExit={() => {
          if (answeredCount === 0 || window.confirm('Exit without saving? Your progress will be lost.')) {
            endQuiz();
            setView('dashboard');
          }
        }}
      />

      <div
        className="progress-bar"
        role="progressbar"
        aria-valuenow={currentIndex + 1}
        aria-valuemin={1}
        aria-valuemax={totalQuestions}
      >
        <div className="progress-fill progress-blue" style={{ width: `${((currentIndex + 1) / totalQuestions) * 100}%` }} />
      </div>

      {paused ? (
        <div className="card text-center py-16">
          <p className="text-lg font-medium">Paused</p>
          <p className="text-muted mt-1">The timer is stopped.</p>
          <button onClick={togglePause} className="btn btn-primary mt-4">
            Resume
          </button>
        </div>
      ) : (
        <>
          <QuestionCard
            question={question}
            interaction={session.interaction}
            userAnswer={session.answers[question.id]}
            confidence={session.confidenceAnswers[question.id] || null}
            onAnswer={handleAnswer}
            revealed={isRevealed}
            showExplanation={showExplanation}
          />

          {confidenceRequired && (
            <ConfidenceSelector
              value={session.confidenceAnswers[question.id] || null}
              onChange={handleConfidence}
              required={isExam && hasAnswer}
            />
          )}

          {/* Check answer — deferred grading for multi-select / typed answers in tutor mode */}
          {isTutor && needsCheckButton && !isRevealed && (
            <button
              onClick={reveal}
              disabled={!hasAnswer && question.t !== 'fs'}
              className="btn btn-primary btn-lg w-full"
            >
              <CheckCircle className="w-5 h-5" />
              {question.t === 'fs' ? 'Check & show model answer' : 'Check answer'}
            </button>
          )}

          {/* After a wrong answer (or any fs question) in tutor mode, an explicit Continue */}
          {showContinue && (
            <button onClick={advanceOrFinish} className="btn btn-primary btn-lg w-full">
              {isLast ? 'See results' : 'Continue'} <ArrowRight className="w-5 h-5" />
            </button>
          )}

          <QuizNavigation
            current={currentIndex + 1}
            total={totalQuestions}
            answeredIndexes={session.questions.map((q) => q.id in session.answers)}
            revealedIndexes={session.questions.map((q) => !!session.revealed[q.id])}
            onPrev={() => {
              clearAdvance();
              prevQuestion();
            }}
            onNext={() => {
              clearAdvance();
              nextQuestion();
            }}
            onJump={(i) => {
              clearAdvance();
              goToQuestion(i);
            }}
            onSubmit={handleSubmit}
            isLast={isLast}
            canProceed={canProceed}
            hideNext={showContinue}
          />
        </>
      )}
    </div>
  );
}

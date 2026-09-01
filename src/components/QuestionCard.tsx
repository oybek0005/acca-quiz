/**
 * Question Card - renders one question, its options/input, and (once revealed)
 * the feedback + explanation. Grading is driven by the `revealed` prop.
 */

'use client';

import { useState, useCallback } from 'react';
import { Question, AIExplanationResponse, AIHintResponse, AIWhyWrongResponse, FSAnswers } from '@/types';
import { cn } from '@/lib/utils';
import { checkAnswer, multiCorrectIndices, isAutoGraded } from '@/lib/questions';
import { safeHtml } from '@/lib/sanitize';
import { FSStatementForm } from '@/components/FSStatementForm';
import { CheckCircle, XCircle, Lightbulb, BookOpen, HelpCircle, Zap, Search, Loader2, X } from 'lucide-react';
import { getAIExplanation, getAIHint, getAIWhyWrong } from '@/lib/ai-client';

interface QuestionCardProps {
  question: Question;
  interaction: 'tutor' | 'exam';
  userAnswer: unknown;
  confidence: 'low' | 'medium' | 'high' | null;
  onAnswer: (answer: unknown) => void;
  revealed: boolean; // feedback shown + answer locked
  showExplanation: boolean; // render the explanation block + AI tools
}

export function QuestionCard({
  question,
  userAnswer,
  confidence,
  onAnswer,
  revealed,
  showExplanation,
}: QuestionCardProps) {
  const [showExplanationState, setShowExplanationState] = useState(false);
  const locked = revealed;
  const hasAnswer = userAnswer !== undefined && userAnswer !== null && !(Array.isArray(userAnswer) && userAnswer.length === 0);
  const isCorrect = hasAnswer && isAutoGraded(question) && checkAnswer(question, userAnswer);

  // AI state
  const [aiExplanation, setAiExplanation] = useState<AIExplanationResponse | null>(null);
  const [aiHint, setAiHint] = useState<AIHintResponse | null>(null);
  const [aiWhyWrong, setAiWhyWrong] = useState<AIWhyWrongResponse | null>(null);
  const [aiLoading, setAiLoading] = useState({ explanation: false, hint: false, whyWrong: false });
  const [aiError, setAiError] = useState<string | null>(null);

  const handleGetExplanation = useCallback(async () => {
    setAiLoading((p) => ({ ...p, explanation: true }));
    setAiError(null);
    try {
      setAiExplanation(await getAIExplanation({ question, userAnswer, correctAnswer: question.a, style: 'conceptual' }));
    } catch {
      setAiError('Could not load an explanation.');
    } finally {
      setAiLoading((p) => ({ ...p, explanation: false }));
    }
  }, [question, userAnswer]);

  const handleGetHint = useCallback(async () => {
    setAiLoading((p) => ({ ...p, hint: true }));
    setAiError(null);
    try {
      setAiHint(await getAIHint({ question, step: aiHint ? 2 : 1 }));
    } catch {
      setAiError('Could not load a hint.');
    } finally {
      setAiLoading((p) => ({ ...p, hint: false }));
    }
  }, [question, aiHint]);

  const handleGetWhyWrong = useCallback(async () => {
    if (isCorrect) return;
    setAiLoading((p) => ({ ...p, whyWrong: true }));
    setAiError(null);
    try {
      setAiWhyWrong(await getAIWhyWrong({ question, userAnswer, correctAnswer: question.a }));
    } catch {
      setAiError('Could not analyse the mistake.');
    } finally {
      setAiLoading((p) => ({ ...p, whyWrong: false }));
    }
  }, [question, userAnswer, isCorrect]);

  const toggleOption = (idx: number) => {
    if (locked) return;
    if (question.t === 'mcq') {
      onAnswer(idx);
    } else if (question.t === 'multi') {
      const cur = Array.isArray(userAnswer) ? (userAnswer as number[]) : [];
      onAnswer(cur.includes(idx) ? cur.filter((i) => i !== idx) : [...cur, idx]);
    }
  };

  // Financial-statements construction has its own full-width proforma UI.
  if (question.t === 'fs') {
    return (
      <div className="question-card">
        <div className="question-header">
          <div className="flex flex-wrap items-center gap-2">
            <span className="badge badge-hard">Financial statements</span>
            {question.subtopic && <span className="badge badge-gray">{question.subtopic}</span>}
          </div>
          <span className="text-xs text-muted font-mono">
            {question.section} · {question.id}
          </span>
        </div>

        <div className="question-text" dangerouslySetInnerHTML={safeHtml(question.q)} />

        <FSStatementForm
          question={question}
          value={(userAnswer as FSAnswers) || {}}
          onChange={locked ? undefined : (v) => onAnswer(v)}
          locked={locked}
          showSolution={revealed && showExplanation}
        />

        {revealed && showExplanation && question.ex && (
          <div className="mt-4 p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
            <p className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-1 flex items-center gap-1.5">
              <BookOpen className="w-4 h-4" /> Worked solution notes
            </p>
            <div className="rich-text text-sm text-blue-800 dark:text-blue-200" dangerouslySetInnerHTML={safeHtml(question.ex)} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="question-card">
      <div className="question-header">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`badge badge-${question.difficulty}`}>
            {question.difficulty.charAt(0).toUpperCase() + question.difficulty.slice(1)}
          </span>
          {question.subtopic && <span className="badge badge-gray">{question.subtopic}</span>}
        </div>
        <span className="text-xs text-muted font-mono">
          {question.section} · {question.id}
        </span>
      </div>

      <div className="question-text" dangerouslySetInnerHTML={safeHtml(question.q)} />

      {question.t === 'multi' && !revealed && (
        <p className="text-xs text-muted -mt-1">Select all that apply, then press “Check answer”.</p>
      )}

      <div
        className="space-y-2"
        role={question.t === 'multi' ? 'group' : 'radiogroup'}
        aria-label="Answer options"
        onKeyDown={(e) => {
          if (!['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft'].includes(e.key)) return;
          const items = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('button:not([disabled])'));
          const idx = items.indexOf(document.activeElement as HTMLButtonElement);
          if (idx === -1) return;
          e.preventDefault();
          const dir = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : -1;
          items[(idx + dir + items.length) % items.length]?.focus();
        }}
      >
        {renderOptions()}
      </div>

      {renderInput()}

      {revealed && showExplanation && renderFeedback()}
      {revealed && !showExplanation && !showExplanationState && renderExplanationToggle()}
      {showExplanationState && renderFullExplanation()}
    </div>
  );

  function optionState(selected: boolean, correct: boolean) {
    if (!revealed) return selected ? 'sel' : 'idle';
    if (selected && correct) return 'right';
    if (selected && !correct) return 'wrong';
    if (!selected && correct) return 'missed';
    return 'idle';
  }

  function renderOptions() {
    if (question.t === 'tf') {
      return (
        <div className="flex gap-3">
          {['True', 'False'].map((label, idx) => {
            const value = idx === 0;
            const selected = userAnswer === value;
            const st = optionState(selected, question.a === value);
            return (
              <button
                key={label}
                type="button"
                onClick={() => !locked && onAnswer(value)}
                disabled={locked}
                role="radio"
                aria-checked={selected}
                className={cn('option-item flex-1 justify-center', st !== 'idle' && `option-item-${st}`)}
              >
                {revealed && st === 'right' && <CheckCircle className="w-4 h-4 text-green-600" />}
                {revealed && st === 'wrong' && <XCircle className="w-4 h-4 text-red-600" />}
                {revealed && st === 'missed' && <CheckCircle className="w-4 h-4 text-green-600" />}
                <span className="font-medium">{label}</span>
              </button>
            );
          })}
        </div>
      );
    }

    if (question.t !== 'mcq' && question.t !== 'multi') return null;

    return question.opt?.map((opt, idx) => {
      const isMulti = question.t === 'multi';
      const selected = isMulti ? (Array.isArray(userAnswer) && (userAnswer as number[]).includes(idx)) : userAnswer === idx;
      const correct = isMulti ? multiCorrectIndices(question).includes(idx) : question.a === idx;
      const st = optionState(selected, correct);
      return (
        <button
          key={idx}
          type="button"
          onClick={() => toggleOption(idx)}
          disabled={locked}
          role={isMulti ? 'checkbox' : 'radio'}
          aria-checked={!!selected}
          className={cn('option-item', st !== 'idle' && `option-item-${st}`)}
        >
          <span
            className={cn(
              'w-5 h-5 flex items-center justify-center flex-shrink-0 border-2',
              isMulti ? 'rounded' : 'rounded-full',
              st === 'right' && 'border-green-500 bg-green-500 text-white',
              st === 'wrong' && 'border-red-500 bg-red-500 text-white',
              st === 'missed' && 'border-green-500',
              st === 'sel' && 'border-blue-500 bg-blue-500 text-white',
              st === 'idle' && 'border-gray-300 dark:border-gray-600'
            )}
          >
            {st === 'right' && <CheckCircle className="w-3.5 h-3.5" />}
            {st === 'wrong' && <XCircle className="w-3.5 h-3.5" />}
            {st === 'missed' && <CheckCircle className="w-3.5 h-3.5 text-green-500" />}
            {st === 'sel' && (isMulti ? <CheckCircle className="w-3.5 h-3.5" /> : <span className="w-2 h-2 bg-white rounded-full" />)}
          </span>
          <span className="flex-1 text-left" dangerouslySetInnerHTML={safeHtml(opt)} />
          {isMulti && revealed && correct && !selected && (
            <span className="text-xs text-green-600 dark:text-green-400 flex-shrink-0">missed</span>
          )}
        </button>
      );
    });
  }

  function renderInput() {
    if (question.t === 'numeric') {
      const val = typeof userAnswer === 'number' || typeof userAnswer === 'string' ? String(userAnswer) : '';
      return (
        <div>
          <input
            type="number"
            inputMode="decimal"
            step="any"
            value={val}
            onChange={(e) => !locked && onAnswer(e.target.value === '' ? null : parseFloat(e.target.value))}
            onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
            disabled={locked}
            placeholder="Type your answer…"
            className="input max-w-xs"
            autoFocus
          />
          {revealed && (
            <p className={cn('mt-2 text-sm font-medium', isCorrect ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400')}>
              Correct answer: {question.a.toLocaleString()}
            </p>
          )}
        </div>
      );
    }

    if (question.t === 'manual') {
      return (
        <div>
          <textarea
            value={(userAnswer as string) || ''}
            onChange={(e) => !locked && onAnswer(e.target.value)}
            disabled={locked}
            placeholder="Write your answer…"
            rows={4}
            className="input"
          />
          {revealed && (
            <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-1 flex items-center gap-1.5">
                <BookOpen className="w-4 h-4" /> Model answer
              </p>
              <div className="rich-text text-blue-800 dark:text-blue-200" dangerouslySetInnerHTML={safeHtml(question.ex)} />
            </div>
          )}
        </div>
      );
    }
    return null;
  }

  function renderFeedback() {
    const graded = isAutoGraded(question);
    return (
      <div
        className={cn(
          'p-4 rounded-xl border',
          !graded
            ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
            : isCorrect
              ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
              : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
        )}
      >
        <div className="flex items-center gap-2 mb-2">
          {graded ? (
            isCorrect ? <CheckCircle className="w-5 h-5 text-green-500" /> : <XCircle className="w-5 h-5 text-red-500" />
          ) : (
            <BookOpen className="w-5 h-5 text-blue-500" />
          )}
          <span className="font-semibold">{!graded ? 'Self-check' : isCorrect ? 'Correct' : 'Not quite'}</span>
          {confidence && <span className={`badge badge-confidence-${confidence}`}>Confidence: {confidence}</span>}
        </div>
        {question.ex && <div className="text-sm rich-text" dangerouslySetInnerHTML={safeHtml(question.ex)} />}

        {showExplanation && (
          <div className="mt-4 pt-4 border-t border-black/10 dark:border-white/10">
            <div className="flex flex-wrap gap-2 mb-3">
              <AiButton onClick={handleGetExplanation} loading={aiLoading.explanation} icon={<HelpCircle className="w-4 h-4" />}>
                {aiExplanation ? 'Re-explain' : 'Explain differently'}
              </AiButton>
              <AiButton onClick={handleGetHint} loading={aiLoading.hint} icon={<Lightbulb className="w-4 h-4" />}>
                {aiHint ? 'Another hint' : 'Hint'}
              </AiButton>
              {!isCorrect && graded && (
                <AiButton onClick={handleGetWhyWrong} loading={aiLoading.whyWrong} icon={<Search className="w-4 h-4" />}>
                  {aiWhyWrong ? 'Re-analyse' : 'Why wrong?'}
                </AiButton>
              )}
            </div>

            {aiExplanation && (
              <AiPanel color="purple" icon={<Zap className="w-4 h-4" />} title="Explanation">
                <div className="rich-text" dangerouslySetInnerHTML={safeHtml(aiExplanation.explanation)} />
                {aiExplanation.keyPoints.length > 0 && (
                  <ul className="mt-2 space-y-1 text-sm">
                    {aiExplanation.keyPoints.map((p, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60 flex-shrink-0 mt-1.5" />
                        {p}
                      </li>
                    ))}
                  </ul>
                )}
              </AiPanel>
            )}
            {aiHint && (
              <AiPanel color="amber" icon={<Lightbulb className="w-4 h-4" />} title="Hint">
                <p className="text-sm">{aiHint.hint}</p>
              </AiPanel>
            )}
            {aiWhyWrong && (
              <AiPanel color="red" icon={<Search className="w-4 h-4" />} title="Why this was wrong">
                <div className="space-y-1.5 text-sm">
                  <p><strong>Analysis:</strong> {aiWhyWrong.analysis}</p>
                  <p><strong>Misconception:</strong> {aiWhyWrong.misconception}</p>
                  <p className="text-green-700 dark:text-green-400"><strong>Correct reasoning:</strong> {aiWhyWrong.correctReasoning}</p>
                </div>
              </AiPanel>
            )}
            {aiError && <p className="text-sm text-red-600 dark:text-red-400 mt-2">{aiError}</p>}
          </div>
        )}
      </div>
    );
  }

  function renderExplanationToggle() {
    return (
      <button onClick={() => setShowExplanationState(true)} className="btn btn-ghost btn-sm w-full">
        <Lightbulb className="w-4 h-4" /> Show explanation
      </button>
    );
  }

  function renderFullExplanation() {
    return (
      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
        <div className="flex items-center gap-2 mb-2">
          <Lightbulb className="w-5 h-5 text-blue-600" />
          <h4 className="font-semibold text-blue-800 dark:text-blue-300">Explanation</h4>
          <button onClick={() => setShowExplanationState(false)} className="ml-auto p-1 rounded hover:bg-black/10 dark:hover:bg-white/10">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="rich-text" dangerouslySetInnerHTML={safeHtml(question.ex)} />
      </div>
    );
  }
}

function AiButton({ onClick, loading, icon, children }: { onClick: () => void; loading: boolean; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button onClick={onClick} disabled={loading} className="btn btn-secondary btn-sm">
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}

const AI_PANEL: Record<string, string> = {
  purple: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800 text-purple-800 dark:text-purple-200',
  amber: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200',
  red: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200',
};

function AiPanel({ color, icon, title, children }: { color: string; icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className={cn('p-3 border rounded-lg mt-2 animate-slide-up', AI_PANEL[color])}>
      <div className="flex items-center gap-2 mb-1.5 font-semibold text-sm">
        {icon} {title}
      </div>
      {children}
    </div>
  );
}

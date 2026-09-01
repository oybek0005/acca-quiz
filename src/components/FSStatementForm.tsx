/**
 * Financial-statements construction (fs) — the on-screen proforma.
 *
 * Used two ways:
 *   - during the quiz  (onChange set, showSolution false) — learner types every figure
 *   - on the results   (showSolution true)                — model figures + per-line verdict + workings
 */

'use client';

import { useState } from 'react';
import type { FSAnswers, FSLine, FSQuestion } from '@/types';
import { gradeFS, fsEnteredBalances, fsLineMarks, type FSMode, type FSResult } from '@/lib/fsGrading';
import { safeHtml } from '@/lib/sanitize';
import { cn } from '@/lib/utils';
import { CheckCircle2, XCircle, MinusCircle, Scale } from 'lucide-react';

interface Props {
  question: FSQuestion;
  value: FSAnswers;
  onChange?: (next: FSAnswers) => void;
  locked?: boolean;
  showSolution?: boolean;
  mode?: FSMode;
}

const STATEMENT_TITLE: Record<'SPL' | 'SOFP', string> = {
  SPL: 'Statement of Profit or Loss',
  SOFP: 'Statement of Financial Position',
};

export function FSStatementForm({ question, value, onChange, locked, showSolution, mode = 'exact' }: Props) {
  const answers = value || {};
  const result: FSResult | null = showSolution ? gradeFS(question, answers, { mode }) : null;
  const balance = fsEnteredBalances(question, answers);

  const setLine = (id: string, n: number | null) => {
    if (locked || !onChange) return;
    onChange({ ...answers, [id]: n });
  };

  const spl = question.lines.filter((l) => l.statement === 'SPL');
  const sofp = question.lines.filter((l) => l.statement === 'SOFP');

  return (
    <div className="space-y-5">
      {(question.scenario || question.yearEndDate) && (
        <div className="rich-text text-sm">
          {question.entityType && (
            <span className="badge badge-gray mr-2">
              {question.entityType === 'company' ? 'Limited company' : 'Sole trader'}
            </span>
          )}
          {question.yearEndDate && <span className="text-muted">Year end: {question.yearEndDate}</span>}
          {question.scenario && <div className="mt-2" dangerouslySetInnerHTML={safeHtml(question.scenario)} />}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        {/* Reference: trial balance + notes */}
        <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          {question.trialBalance?.length > 0 && (
            <details open className="card p-0 overflow-hidden">
              <summary className="cursor-pointer select-none px-4 py-2.5 font-semibold text-sm bg-surface-2">
                Trial balance
              </summary>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-muted text-xs">
                      <th className="text-left font-medium px-4 py-1.5">Account</th>
                      <th className="text-right font-medium px-3 py-1.5">Dr</th>
                      <th className="text-right font-medium px-4 py-1.5">Cr</th>
                    </tr>
                  </thead>
                  <tbody>
                    {question.trialBalance.map((row, i) => (
                      <tr key={i} className="border-t border-[color:rgb(var(--line))]">
                        <td className="px-4 py-1.5">{row.account}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{fmt(row.debit)}</td>
                        <td className="px-4 py-1.5 text-right tabular-nums">{fmt(row.credit)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}

          {question.adjustmentNotes?.length > 0 && (
            <details open className="card p-0 overflow-hidden">
              <summary className="cursor-pointer select-none px-4 py-2.5 font-semibold text-sm bg-surface-2">
                Adjustment notes
              </summary>
              <ol className="px-4 py-2 space-y-2 text-sm list-decimal list-inside marker:text-muted marker:font-semibold">
                {question.adjustmentNotes.map((n) => (
                  <li key={n.ref}>
                    <span dangerouslySetInnerHTML={safeHtml(n.text)} />
                  </li>
                ))}
              </ol>
            </details>
          )}
        </div>

        {/* The two statements */}
        <div className="space-y-5">
          {result && (
            <div
              className={cn(
                'flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border px-4 py-3 text-sm font-medium',
                result.passed
                  ? 'border-[color:rgb(var(--ok))] bg-[color:rgb(var(--ok-soft))] text-[color:rgb(var(--ok))]'
                  : 'border-[color:rgb(var(--bad))] bg-[color:rgb(var(--bad-soft))] text-[color:rgb(var(--bad))]'
              )}
            >
              <span className="text-base">
                {result.scoredMarks} / {result.totalMarks} marks · {result.percentage}%
              </span>
              <span>{result.passed ? 'Pass (≥ 50%)' : 'Below the 50% pass mark'}</span>
              <span className="text-muted font-normal">
                {result.correctLines}/{result.totalLines} lines correct
              </span>
            </div>
          )}

          {!showSolution && (
            <div
              className={cn(
                'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm',
                balance.balanced
                  ? 'border-[color:rgb(var(--ok))] bg-[color:rgb(var(--ok-soft))] text-[color:rgb(var(--ok))]'
                  : 'border-[color:rgb(var(--line))] text-muted'
              )}
            >
              <Scale className="w-4 h-4 flex-shrink-0" />
              {balance.balanced ? (
                <span>Your statement balances ({fmt(balance.assets)}).</span>
              ) : balance.assets !== null && balance.equityAndLiabilities !== null ? (
                <span>
                  Doesn&apos;t balance yet — assets {fmt(balance.assets)} vs equity + liabilities{' '}
                  {fmt(balance.equityAndLiabilities)}.
                </span>
              ) : (
                <span>Fill in both totals to check that your statement balances.</span>
              )}
            </div>
          )}

          {([['SPL', spl], ['SOFP', sofp]] as const).map(([key, lines]) =>
            lines.length === 0 ? null : (
              <div key={key} className="card">
                <h3 className="font-semibold mb-1">{STATEMENT_TITLE[key]}</h3>
                {key === 'SPL' && question.yearEndDate && (
                  <p className="text-xs text-muted mb-3">for the year ended {question.yearEndDate}</p>
                )}
                {key === 'SOFP' && question.yearEndDate && (
                  <p className="text-xs text-muted mb-3">as at {question.yearEndDate}</p>
                )}
                <div className="divide-y divide-[color:rgb(var(--line))]">
                  {lines.map((line, i) => {
                    const prevGroup = i > 0 ? lines[i - 1].group : null;
                    return (
                      <div key={line.id}>
                        {line.group && line.group !== prevGroup && (
                          <p className="pt-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted">
                            {line.group}
                          </p>
                        )}
                        <FSLineRow
                          line={line}
                          entered={answers[line.id] ?? null}
                          onChange={(n) => setLine(line.id, n)}
                          locked={!!locked}
                          solution={result ? result.lineResults[line.id] : null}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}

function FSLineRow({
  line,
  entered,
  onChange,
  locked,
  solution,
}: {
  line: FSLine;
  entered: number | null;
  onChange: (n: number | null) => void;
  locked: boolean;
  solution: FSResult['lineResults'][string] | null;
}) {
  const isSubtotal = line.kind === 'subtotal';
  const marks = fsLineMarks(line);

  return (
    <div className="py-1.5">
      <div className="flex items-center gap-3">
        <span className={cn('flex-1 text-sm', isSubtotal && 'font-semibold')}>
          {line.label}
          {line.deduction && <span className="text-muted"> ( )</span>}
        </span>
        {marks > 1 && <span className="text-[10px] text-muted tabular-nums">{marks} marks</span>}
        <FSNumberInput
          value={entered}
          onChange={onChange}
          disabled={locked}
          deduction={line.deduction}
          emphasise={isSubtotal}
        />
      </div>

      {solution && solution.verdict !== 'correct' && (
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 pl-1 text-xs">
          <VerdictBadge verdict={solution.verdict} />
          <span className="text-muted">
            Correct: <span className="tabular-nums font-medium text-[color:rgb(var(--ink))]">{fmt(solution.expected)}</span>
            {line.deduction ? ' (deduction)' : ''}
          </span>
          {line.workingHint && <span className="text-muted">· {line.workingHint}</span>}
        </div>
      )}
      {solution && solution.verdict === 'correct' && line.workingHint && (
        <div className="mt-1 pl-1 text-xs text-muted">✓ {line.workingHint}</div>
      )}
    </div>
  );
}

function VerdictBadge({ verdict }: { verdict: FSResult['lineResults'][string]['verdict'] }) {
  if (verdict === 'ofr-credit')
    return (
      <span className="inline-flex items-center gap-1 text-[color:rgb(var(--ok))]">
        <CheckCircle2 className="w-3.5 h-3.5" /> Own-figure credit
      </span>
    );
  if (verdict === 'blank')
    return (
      <span className="inline-flex items-center gap-1 text-muted">
        <MinusCircle className="w-3.5 h-3.5" /> Left blank
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-[color:rgb(var(--bad))]">
      <XCircle className="w-3.5 h-3.5" /> Incorrect
    </span>
  );
}

function FSNumberInput({
  value,
  onChange,
  disabled,
  deduction,
  emphasise,
}: {
  value: number | null;
  onChange: (n: number | null) => void;
  disabled: boolean;
  deduction?: boolean;
  emphasise?: boolean;
}) {
  // `draft` is non-null only while the field is being edited; otherwise the
  // displayed value is derived straight from the `value` prop (no effect sync).
  const [draft, setDraft] = useState<string | null>(null);
  const display =
    draft !== null && !disabled ? draft : value === null ? '' : formatText(String(value));

  const commit = (raw: string) => {
    const cleaned = raw.replace(/[^0-9.]/g, '');
    if (cleaned === '' || cleaned === '.') {
      onChange(null);
      return;
    }
    const n = Number(cleaned);
    onChange(Number.isFinite(n) ? n : null);
  };

  return (
    <span
      className={cn(
        'inline-flex items-center',
        deduction && "before:content-['('] after:content-[')'] before:text-muted after:text-muted"
      )}
    >
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        disabled={disabled}
        value={display}
        onFocus={() => setDraft(value === null ? '' : String(value))}
        onBlur={() => {
          commit(draft ?? '');
          setDraft(null);
        }}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^0-9.]/g, '');
          setDraft(raw);
          commit(raw);
        }}
        onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
        placeholder="—"
        className={cn(
          'w-28 rounded-md border border-[color:rgb(var(--line-strong))] bg-[color:rgb(var(--surface))] px-2 py-1 text-right text-sm tabular-nums',
          'focus:outline-none focus:ring-2 focus:ring-[color:rgb(var(--accent))] focus:border-transparent',
          'disabled:opacity-70 disabled:cursor-default',
          emphasise && 'font-semibold'
        )}
      />
    </span>
  );
}

function formatText(text: string): string {
  if (text === '') return '';
  const n = Number(text);
  if (!Number.isFinite(n)) return text;
  return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '';
  return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

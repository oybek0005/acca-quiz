/**
 * Import / Export - back up and restore all local progress in one JSON file.
 */

'use client';

import { useState, useRef } from 'react';
import { useQuestionsStore, useSettingsStore } from '@/store/quizStore';
import { useMistakesStore, useSRSStore, useStreakStore } from '@/store/mistakesStore';
import { useAttemptsStore } from '@/store/attemptsStore';
import { cn } from '@/lib/utils';
import { buildBackup, parseBackup } from '@/lib/backup';
import { buildAiReviewExport, downloadJson } from '@/lib/aiExport';
import { parseAiReport, applyAiReport } from '@/lib/aiImport';
import { normalizeQuestions } from '@/lib/questions';
import { getAllSRSCards, restoreSRSCards } from '@/lib/srs';
import { Button } from '@/components/ui/Button';
import { Download, Upload, FileText, Database, AlertCircle, CheckCircle, Sparkles, BrainCircuit, BookPlus } from 'lucide-react';

const CUSTOM_Q_KEY = 'faq_custom_questions';

export function ImportView() {
  const { questions, loadQuestions } = useQuestionsStore();
  const { mistakes, loadMistakes } = useMistakesStore();
  const { loadCards } = useSRSStore();
  const streak = useStreakStore();
  const { attempts, loadAttempts } = useAttemptsStore();
  const settings = useSettingsStore();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [confirm, setConfirm] = useState<null | 'import' | 'clear'>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [aiText, setAiText] = useState('');
  const [aiMsg, setAiMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const applyReport = () => {
    try {
      const report = parseAiReport(aiText);
      const r = applyAiReport(report);
      const parts = [
        r.gradedCount ? `${r.gradedCount} graded` : '',
        r.newQuestions ? `${r.newQuestions} new questions` : '',
        r.fixes ? `${r.fixes} corrections` : '',
        r.insightAdded ? 'insight added' : '',
      ].filter(Boolean);
      setAiMsg({ ok: true, text: `Applied: ${parts.join(', ') || 'nothing new'}.${r.warnings.length ? ` (${r.warnings.length} warnings)` : ''}` });
      setAiText('');
    } catch (e) {
      setAiMsg({ ok: false, text: e instanceof Error ? e.message : 'Could not read that report.' });
    }
  };

  const importBankFile = async (file: File) => {
    try {
      const data = JSON.parse(await file.text());
      const raw = Array.isArray(data)
        ? data
        : data?.sections
          ? Object.entries(data.sections).flatMap(([k, s]) =>
              ((s as { questions?: unknown[] }).questions ?? []).map((q) => ({ ...(q as object), section: (q as { section?: string }).section || k }))
            )
          : Array.isArray(data?.questions)
            ? data.questions
            : [];
      const qs = normalizeQuestions(raw as never);
      if (qs.length === 0) throw new Error('No questions found in that file.');
      localStorage.setItem(CUSTOM_Q_KEY, JSON.stringify(qs.filter((q) => !questions.some((e) => e.id === q.id))));
      const seen = new Set(questions.map((q) => q.id));
      loadQuestions([...questions, ...qs.filter((q) => !seen.has(q.id))]);
      setAiMsg({ ok: true, text: `Imported ${qs.length} questions (${qs.filter((q) => !seen.has(q.id)).length} new).` });
    } catch (e) {
      setAiMsg({ ok: false, text: e instanceof Error ? e.message : 'Import failed.' });
    }
  };

  const customQuestions = (() => {
    try {
      return JSON.parse(localStorage.getItem(CUSTOM_Q_KEY) || '[]');
    } catch {
      return [];
    }
  })();

  const handleExport = () => {
    const backup = buildBackup({
      customQuestions,
      attempts,
      mistakes,
      srs: getAllSRSCards(),
      streak: {
        current: streak.current,
        longest: streak.longest,
        lastDate: streak.lastDate,
        target: streak.target,
        todayCount: streak.todayCount,
        updatedAt: streak.updatedAt,
      },
      settings: {
        theme: settings.theme,
        quizMode: settings.quizMode,
        showTimer: settings.showTimer,
        requireConfidence: settings.requireConfidence,
        dailyTarget: settings.dailyTarget,
        soundEnabled: settings.soundEnabled,
        animationsEnabled: settings.animationsEnabled,
        sectionWeights: settings.sectionWeights,
      },
    });

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `acca-fa-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const runImport = async (file: File) => {
    setStatus('loading');
    setMessage('Reading file…');
    try {
      const parsed = parseBackup(await file.text());

      if (parsed.customQuestions.length > 0) {
        localStorage.setItem(CUSTOM_Q_KEY, JSON.stringify(parsed.customQuestions));
        const seen = new Set(questions.map((q) => q.id));
        loadQuestions([...questions, ...parsed.customQuestions.filter((q) => !seen.has(q.id))]);
      }
      loadMistakes(parsed.mistakes);
      restoreSRSCards(parsed.srs);
      loadCards(parsed.srs);
      loadAttempts(parsed.attempts);
      if (parsed.streak) streak.loadStreak(parsed.streak);
      if (parsed.settings) {
        const s = parsed.settings;
        if (s.theme) settings.setTheme(s.theme as 'light' | 'dark' | 'system');
        if (s.quizMode) settings.setQuizMode(s.quizMode as 'tutor' | 'exam');
        if (typeof s.showTimer === 'boolean') settings.setShowTimer(s.showTimer);
        if (typeof s.requireConfidence === 'boolean') settings.setRequireConfidence(s.requireConfidence);
        if (typeof s.dailyTarget === 'number') settings.setDailyTarget(s.dailyTarget);
        if (typeof s.soundEnabled === 'boolean') settings.setSoundEnabled(s.soundEnabled);
        if (typeof s.animationsEnabled === 'boolean') settings.setAnimationsEnabled(s.animationsEnabled);
        if (s.sectionWeights) settings.setSectionWeights(s.sectionWeights as never);
      }

      setStatus('success');
      setMessage(`Imported: ${parsed.summary}.`);
    } catch (e) {
      setStatus('error');
      setMessage(e instanceof Error ? e.message : 'Import failed.');
    }
  };

  const clearAll = () => {
    [CUSTOM_Q_KEY, 'faq_mistakes', 'faq-mistakes', 'faq_srs_v1', 'faq_attempts_v1', 'faq-streak'].forEach((k) =>
      localStorage.removeItem(k)
    );
    loadMistakes({});
    restoreSRSCards({});
    loadCards({});
    loadAttempts([]);
    streak.loadStreak({ current: 0, longest: 0, lastDate: null, target: 20, todayCount: 0, updatedAt: new Date().toISOString() });
    setConfirm(null);
    setStatus('success');
    setMessage('All progress cleared. The question bank is untouched.');
    if (fileInputRef.current) fileInputRef.current.value = '';
    setSelectedFile(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Import / Export</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Back up and restore your progress and settings</p>
        </div>
        <Button variant="primary" onClick={handleExport}>
          <Download className="w-4 h-4" /> Export backup
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatTile icon={<FileText className="w-7 h-7 text-blue-500" />} value={questions.length} label="Questions" />
        <StatTile icon={<AlertCircle className="w-7 h-7 text-red-500" />} value={Object.keys(mistakes).length} label="Mistakes" />
        <StatTile icon={<Database className="w-7 h-7 text-purple-500" />} value={Object.keys(getAllSRSCards()).length} label="SRS cards" />
        <StatTile icon={<CheckCircle className="w-7 h-7 text-green-500" />} value={attempts.length} label="Quizzes taken" />
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Download className="w-5 h-5 text-blue-500" /> Export
        </h2>
        <p className="text-muted mb-4">
          Downloads one JSON file with your attempts, mistakes, SRS schedule, streak, settings, and any custom
          questions. Your AI API key is never included.
        </p>
        <Button variant="secondary" onClick={handleExport}>
          <Download className="w-4 h-4" /> Download backup JSON
        </Button>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-[color:rgb(var(--accent))]" /> Export for AI review
        </h2>
        <p className="text-muted mb-4">
          One JSON file with every question, your mistake history, and an analytics summary (weak sections and
          subtopics), plus ready-made prompts. Paste it into an AI to check questions for errors, generate new
          ones for your weak spots, or get a study plan. See <span className="font-mono text-xs">QUESTIONS_GUIDE.md</span>.
        </p>
        <Button
          variant="primary"
          onClick={() =>
            downloadJson(
              buildAiReviewExport({ questions, mistakes, attempts }),
              `acca-fa-ai-review-${new Date().toISOString().split('T')[0]}.json`
            )
          }
        >
          <Sparkles className="w-4 h-4" /> Download AI review JSON
        </Button>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Upload className="w-5 h-5 text-green-500" /> Import
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mb-4">
          Restore from a backup file. This overwrites your current progress.
        </p>

        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <label className="btn-secondary flex items-center gap-2 cursor-pointer">
              <Upload className="w-4 h-4" /> Choose file
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  setSelectedFile(f);
                  setStatus('idle');
                  setMessage('');
                }}
                className="hidden"
              />
            </label>
            {selectedFile && (
              <span className="text-sm text-gray-600 dark:text-gray-400 truncate">
                {selectedFile.name} ({Math.round(selectedFile.size / 1024)} KB)
              </span>
            )}
          </div>

          {selectedFile && (
            <Button variant="primary" onClick={() => setConfirm('import')} disabled={status === 'loading'}>
              <Upload className="w-4 h-4" /> Import this file
            </Button>
          )}

          {status !== 'idle' && (
            <div
              className={cn(
                'p-3 rounded-lg flex items-center gap-3 text-sm border',
                status === 'success'
                  ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-300'
                  : status === 'error'
                    ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300'
                    : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300'
              )}
            >
              {status === 'success' && <CheckCircle className="w-5 h-5 flex-shrink-0" />}
              {status === 'error' && <AlertCircle className="w-5 h-5 flex-shrink-0" />}
              {status === 'loading' && (
                <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin flex-shrink-0" />
              )}
              <p>{message}</p>
            </div>
          )}
        </div>
      </div>

      {/* AI report import */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <BrainCircuit className="w-5 h-5 text-[color:rgb(var(--accent))]" /> Apply an AI report
        </h2>
        <p className="text-muted mb-3">
          Paste back the JSON an AI gave you after reviewing a mock exam or the &ldquo;AI review&rdquo; export.
          It can grade questions you did on paper, add new questions, correct existing ones, and save a written
          insight. Expected shape:{' '}
          <span className="font-mono text-xs">{'{ "type": "faq_ai_report_v1", "results": [...], "questionFixes": [...], "insight": {...} }'}</span>
        </p>
        <textarea
          value={aiText}
          onChange={(e) => setAiText(e.target.value)}
          rows={5}
          placeholder='{ "type": "faq_ai_report_v1", "sourceLabel": "Mock 2", "results": [ { "qId": "DE05", "correct": false } ] }'
          className="input font-mono text-xs"
        />
        <div className="flex gap-2 mt-3">
          <Button variant="primary" onClick={applyReport} disabled={!aiText.trim()}>
            <Sparkles className="w-4 h-4" /> Apply report
          </Button>
          <label className="btn-secondary cursor-pointer">
            <BookPlus className="w-4 h-4" /> Import a questions.json
            <input
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importBankFile(f);
                e.target.value = '';
              }}
            />
          </label>
        </div>
        {aiMsg && (
          <p className={cn('text-sm mt-3', aiMsg.ok ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400')}>
            {aiMsg.text}
          </p>
        )}
      </div>

      <div className="card border-red-200 dark:border-red-800">
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2 text-red-600 dark:text-red-400">
          <AlertCircle className="w-5 h-5" /> Danger zone
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mb-4">
          Deletes your mistakes, SRS schedule, streak, attempt history, and custom questions. The bundled question
          bank stays. This cannot be undone.
        </p>
        <Button variant="destructive" onClick={() => setConfirm('clear')}>
          <AlertCircle className="w-4 h-4" /> Clear all progress
        </Button>
      </div>

      {confirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setConfirm(null)}
          onKeyDown={(e) => e.key === 'Escape' && setConfirm(null)}
          role="dialog"
          aria-modal="true"
          tabIndex={-1}
          ref={(el) => el?.focus()}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              {confirm === 'import' ? 'Confirm import' : 'Confirm clear'}
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              {confirm === 'import'
                ? 'This overwrites your current progress with the backup. Continue?'
                : 'This permanently deletes all local progress. Continue?'}
            </p>
            <div className="flex gap-3 justify-end">
              <Button variant="secondary" onClick={() => setConfirm(null)}>
                Cancel
              </Button>
              <Button
                variant={confirm === 'clear' ? 'destructive' : 'primary'}
                onClick={() => {
                  if (confirm === 'import' && selectedFile) runImport(selectedFile);
                  else if (confirm === 'clear') clearAll();
                  setConfirm(null);
                }}
              >
                {confirm === 'import' ? 'Import' : 'Delete everything'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatTile({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <div className="card p-4 text-center">
      <div className="mx-auto mb-2 w-fit">{icon}</div>
      <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</div>
      <div className="text-sm text-gray-500 dark:text-gray-400">{label}</div>
    </div>
  );
}

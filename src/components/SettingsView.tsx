/**
 * Settings View - App configuration and preferences
 */

"use client";

import { useState } from "react";
import { useSettingsStore } from "@/store/quizStore";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { useToaster } from "@/components/Toaster";
import { CloudSyncCard } from "@/components/CloudSyncCard";
import { Moon, Sun, Monitor, Target, Brain, Zap, RotateCcw, Save, Loader2, CheckCircle, Clock, Shield, Key, Link, Check, AlertCircle, BookOpen } from "lucide-react";
import type { SectionCode } from "@/types";
import { getAIConfig, setAIConfig, checkAIHealth } from "@/lib/ai-client";

const SECTIONS: SectionCode[] = ["DE", "INV", "NCA", "INT", "TAX", "ACC", "RPP", "CAP"];
const SECTION_LABELS: Record<string, string> = {
  DE: "Double Entry",
  INV: "Inventory",
  NCA: "Non-Current Assets",
  INT: "Intangible Assets",
  TAX: "Taxation",
  ACC: "Accruals & Prepayments",
  RPP: "Reporting & Performance",
  CAP: "Capital & Financing",
};

function Toggle({
  checked, onChange, title, subtitle, icon,
}: {
  checked: boolean; onChange: (v: boolean) => void; title: string; subtitle: string; icon: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-start gap-3">
        {icon && <span className="mt-1">{icon}</span>}
        <div>
          <p className="font-medium text-gray-900 dark:text-gray-100">{title}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>
        </div>
      </div>
      <label className="relative inline-flex items-center cursor-pointer">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only peer"
        />
        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
      </label>
    </div>
  );
}

export function SettingsView() {
  const {
    theme, quizMode, showTimer, requireConfidence, dailyTarget,
    soundEnabled, animationsEnabled, sectionWeights,
    setTheme, setQuizMode, setShowTimer, setRequireConfidence,
    setDailyTarget, setSoundEnabled, setAnimationsEnabled, setSectionWeights,
  } = useSettingsStore();

  const toast = useToaster();
  const [localWeights, setLocalWeights] = useState<Record<SectionCode, number>>({ ...sectionWeights });
  const [saving, setSaving] = useState(false);

  // AI Config state — loaded from storage once (client-only component).
  const [aiConfig, setAiConfigState] = useState(() => getAIConfig());
  const [aiSaving, setAiSaving] = useState(false);
  const [aiTesting, setAiTesting] = useState(false);
  const [aiTestResult, setAiTestResult] = useState<"success" | "error" | null>(null);

  const handleSave = async () => {
    setSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 300));
    setSectionWeights(localWeights);
    setSaving(false);
    toast.success("Section weights saved");
  };

  const handleResetWeights = () => {
    const equalWeight = 100 / SECTIONS.length;
    const newWeights = SECTIONS.reduce((acc, section) => {
      acc[section] = equalWeight;
      return acc;
    }, {} as Record<SectionCode, number>);
    setLocalWeights(newWeights);
  };

  const handleExamWeights = () => {
    // ACCA FA syllabus approximate weights
    const examWeights: Record<SectionCode, number> = {
      DE: 20, INV: 15, NCA: 15, INT: 10,
      TAX: 10, ACC: 10, RPP: 10, CAP: 10,
    };
    setLocalWeights(examWeights);
  };

  const handleAiSave = async () => {
    setAiSaving(true);
    setAiTestResult(null);
    await new Promise((resolve) => setTimeout(resolve, 300));
    setAIConfig(aiConfig);
    setAiSaving(false);
    toast.success("AI configuration saved", aiConfig.enabled ? undefined : "AI is currently disabled — local templates will be used");
  };

  const handleAiTest = async () => {
    if (!aiConfig.enabled || !aiConfig.apiKey || !aiConfig.baseUrl) {
      setAiTestResult("error");
      return;
    }
    setAiTesting(true);
    setAiTestResult(null);
    try {
      const healthy = await checkAIHealth();
      setAiTestResult(healthy ? "success" : "error");
    } catch {
      setAiTestResult("error");
    } finally {
      setAiTesting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Settings</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Configure your quiz experience and preferences</p>
        </div>
        <div className="flex gap-2">
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            {saving
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Save className="w-4 h-4" />}
            {saving ? "Saving..." : "Save Weights"}
          </Button>
          <Button variant="primary" onClick={handleAiSave} disabled={aiSaving}>
            {aiSaving
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Save className="w-4 h-4" />}
            {aiSaving ? "Saving..." : "Save AI Config"}
          </Button>
        </div>
      </div>

      {/* Appearance */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Monitor className="w-5 h-5 text-blue-500" />
          Appearance
        </h2>
        <div className="grid grid-cols-3 gap-3">
          {(["light", "dark", "system"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTheme(t)}
              className={cn(
                "p-4 rounded-lg border-2 transition-all text-center",
                theme === t
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                  : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
              )}
              aria-pressed={theme === t}
            >
              {t === "light" && <Sun className="w-8 h-8 mx-auto mb-2 text-yellow-500" />}
              {t === "dark" && <Moon className="w-8 h-8 mx-auto mb-2 text-blue-500" />}
              {t === "system" && <Monitor className="w-8 h-8 mx-auto mb-2 text-gray-500" />}
              <div className="font-medium capitalize">{t}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {t === "light" ? "Always light" : t === "dark" ? "Always dark" : "Follow system"}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Quiz Behavior */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Brain className="w-5 h-5 text-green-500" />
          Quiz Behavior
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-4">
            <Toggle
              checked={quizMode === "tutor"}
              onChange={(v) => setQuizMode(v ? "tutor" : "exam")}
              title="Tutor Mode"
              subtitle="Show explanations after each answer"
              icon={<BookOpen className="w-5 h-5 text-green-500" />}
            />
            <Toggle
              checked={showTimer}
              onChange={setShowTimer}
              title="Show Timer"
              subtitle="Display time spent per question"
              icon={<Clock className="w-5 h-5 text-blue-500" />}
            />
            <Toggle
              checked={requireConfidence}
              onChange={setRequireConfidence}
              title="Require Confidence"
              subtitle="Ask confidence level before next question"
              icon={<Brain className="w-5 h-5 text-purple-500" />}
            />
            <Toggle
              checked={soundEnabled}
              onChange={setSoundEnabled}
              title="Sound Effects"
              subtitle="Play sounds for correct/incorrect answers"
              icon={<Zap className="w-5 h-5 text-yellow-500" />}
            />
            <Toggle
              checked={animationsEnabled}
              onChange={setAnimationsEnabled}
              title="Animations"
              subtitle="Enable transitions and micro-animations"
              icon={<RotateCcw className="w-5 h-5 text-blue-500" />}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Daily Target <span className="text-gray-500 dark:text-gray-400">({dailyTarget})</span>
            </label>
            <input
              type="range"
              min="5"
              max="100"
              step="5"
              value={dailyTarget}
              onChange={(e) => setDailyTarget(parseInt(e.target.value))}
              className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Questions per day to maintain streak</p>
          </div>
        </div>
      </div>

      {/* AI Configuration */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5 text-purple-500" />
          AI Assistant (OmniRoute)
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mb-4">
          Configure AI-powered explanations, hints, and mistake analysis. Requires OmniRoute endpoint.
        </p>
        
        <div className="space-y-4">
          <Toggle
            checked={aiConfig.enabled}
            onChange={(v) => setAiConfigState(prev => ({ ...prev, enabled: v }))}
            title="Enable AI Assistant"
            subtitle="Use OmniRoute for explanations, hints, and why-wrong analysis"
            icon={<Brain className="w-5 h-5 text-purple-500" />}
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
              <Link className="w-4 h-4 text-gray-400" />
              OmniRoute Base URL
            </label>
            <input
              type="url"
              value={aiConfig.baseUrl}
              onChange={(e) => setAiConfigState(prev => ({ ...prev, baseUrl: e.target.value }))}
              placeholder="https://your-omniroute-endpoint.com/api"
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Your OmniRoute API endpoint (e.g., https://api.example.com/v1)</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
              <Key className="w-4 h-4 text-gray-400" />
              API Key
            </label>
            <input
              type="password"
              value={aiConfig.apiKey}
              onChange={(e) => setAiConfigState(prev => ({ ...prev, apiKey: e.target.value }))}
              placeholder="sk-..."
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Stored only in this browser&apos;s local storage. It is never sent anywhere except your
              configured endpoint, and is excluded from exported backups.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-400" />
              Request Timeout (ms)
            </label>
            <input
              type="number"
              value={aiConfig.timeout}
              onChange={(e) => setAiConfigState(prev => ({ ...prev, timeout: parseInt(e.target.value) }))}
              min="1000"
              max="60000"
              step="1000"
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          <div className="flex gap-2">
            <Button variant="primary" onClick={handleAiTest} disabled={aiTesting}>
              {aiTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {aiTesting ? "Testing..." : "Test Connection"}
            </Button>
            {aiTestResult === "success" && (
              <span className="flex items-center text-green-600 dark:text-green-400 text-sm">
                <CheckCircle className="w-4 h-4 mr-1" /> Connected successfully
              </span>
            )}
            {aiTestResult === "error" && (
              <span className="flex items-center text-red-600 dark:text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 mr-1" /> Connection failed
              </span>
            )}
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400">
            When disabled or unavailable, the app uses local fallback templates
            for common ACCA topics (DEAD CLIC, R&D, Pro-rata depreciation, etc.). Configure your VPS endpoint
            for full AI-powered adaptive explanations.
          </p>
        </div>
      </div>

      {/* Section Weights */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">
          <Target className="w-5 h-5 text-purple-500" />
          Section Weights (Mixed Quiz)
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mb-4">
          Adjust how often questions from each section appear in Mixed Quiz mode.
          Higher weight = more questions from that section.
        </p>

        <div className="space-y-3">
          {SECTIONS.map(section => {
            const weight = localWeights[section] || 0;
            return (
              <div key={section} className="flex items-center gap-4">
                <span className={"badge badge-" + section + " w-16 text-center"}>{section}</span>
                <span className="text-sm text-gray-500 dark:text-gray-400 w-44 truncate hidden sm:block">{SECTION_LABELS[section]}</span>
                <input
                  type="range"
                  min="0"
                  max="50"
                  step="1"
                  value={weight}
                  onChange={(e) => setLocalWeights(w => ({ ...w, [section]: parseInt(e.target.value) }))}
                  className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-600"
                />
                <span className="w-12 text-right font-mono text-sm text-gray-900 dark:text-gray-100">
                  {weight.toFixed(0)}%
                </span>
              </div>
            );
          })}

          <div className="flex items-center gap-4 pt-2 border-t border-gray-200 dark:border-gray-700">
            <span className="w-16"></span>
            <span className="text-sm text-gray-500 dark:text-gray-400 w-44 hidden sm:block">Total</span>
            <div className="flex-1"></div>
            <span className={cn(
              "w-12 text-right font-mono text-sm font-semibold",
              Math.abs(Object.values(localWeights).reduce((a, b) => a + b, 0) - 100) < 0.5
                ? "text-gray-900 dark:text-gray-100"
                : "text-red-600 dark:text-red-400"
            )}>
              {Object.values(localWeights).reduce((a, b) => a + b, 0).toFixed(0)}%
            </span>
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <Button variant="secondary" onClick={handleResetWeights} size="sm">
            <RotateCcw className="w-4 h-4" /> Equal Weights
          </Button>
          <Button variant="secondary" onClick={handleExamWeights} size="sm">
            <Target className="w-4 h-4" /> Exam Weights
          </Button>
        </div>
      </div>

      {/* Cloud Sync */}
      <CloudSyncCard />

      {/* About */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Zap className="w-5 h-5 text-yellow-500" />
          About
        </h2>
        <div className="space-y-3 text-sm text-gray-500 dark:text-gray-400">
          <p>ACCA FA QuizApp v2 — intelligent exam preparation</p>
          <p>Spaced repetition (SM-2), mistake analytics, flashcards, adaptive explanations</p>
          <p>341 questions across 8 syllabus sections</p>
          <p>Data is stored locally in your browser, with optional Firebase cloud sync</p>
        </div>
      </div>
    </div>
  );
}

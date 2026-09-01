/**
 * OmniRoute AI Client - Hybrid AI integration with local fallbacks
 * Provides adaptive explanations, hints, "why wrong" analysis, and variant generation
 */

import type {
  Question,
  AIExplanationRequest,
  AIExplanationResponse,
  AIHintRequest,
  AIHintResponse,
  AIWhyWrongRequest,
  AIWhyWrongResponse,
  AIVariantRequest,
  AIVariantResponse,
} from '@/types';

const LS_AI_CONFIG = 'faq_ai_config';
const DEFAULT_OMNIRoute_URL = 'https://omniroute.example.com/api';

interface AIConfig {
  enabled: boolean;
  baseUrl: string;
  apiKey: string;
  timeout: number;
}

function loadAIConfig(): AIConfig {
  if (typeof window === 'undefined') {
    return { enabled: false, baseUrl: DEFAULT_OMNIRoute_URL, apiKey: '', timeout: 10000 };
  }
  try {
    const raw = localStorage.getItem(LS_AI_CONFIG);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { enabled: false, baseUrl: DEFAULT_OMNIRoute_URL, apiKey: '', timeout: 10000, ...parsed };
    }
  } catch {}
  return { enabled: false, baseUrl: DEFAULT_OMNIRoute_URL, apiKey: '', timeout: 10000 };
}

function saveAIConfig(config: AIConfig): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LS_AI_CONFIG, JSON.stringify(config));
  } catch (e) {
    console.error('Failed to save AI config:', e);
  }
}

export function setAIConfig(config: Partial<AIConfig>): AIConfig {
  const current = loadAIConfig();
  const updated = { ...current, ...config };
  saveAIConfig(updated);
  return updated;
}

export function getAIConfig(): AIConfig {
  return loadAIConfig();
}

// ============================= Local Fallback Templates =============================

const EXPLANATION_TEMPLATES: Record<string, AIExplanationResponse> = {
  'DEAD CLIC': {
    explanation:
      '<strong>DEAD CLIC</strong> is a mnemonic for double-entry rules:<br>' +
      '<strong>DEAD</strong> = Debit: Expenses, Assets, Drawings (increase with debit)<br>' +
      '<strong>CLIC</strong> = Credit: Liabilities, Income, Capital (increase with credit)<br><br>' +
      'To apply: Identify the account type, then apply the rule. Example: "Purchased inventory for cash" → Inventory (Asset) debited, Cash (Asset) credited.',
    keyPoints: [
      'Assets & Expenses increase on DEBIT side',
      'Liabilities, Income & Capital increase on CREDIT side',
      'Every transaction affects at least 2 accounts',
      'Total debits must equal total credits',
    ],
    commonMistakes: [
      'Reversing DEAD/CLIC (debiting income, crediting expenses)',
      'Forgetting Drawings are a debit (not a liability)',
      'Confusing "drawings" with "dividends"',
    ],
    relatedConcepts: ['T-accounts', 'Trial balance', 'Accounting equation'],
  },
  'R&D': {
    explanation:
      '<strong>Research & Development (IAS 38)</strong> has two phases:<br>' +
      '<strong>1. Research Phase</strong> — <em>Always expense</em> to P&L as incurred. No capitalization allowed.<br>' +
      '<strong>2. Development Phase</strong> — Capitalize <strong>only if ALL 6 criteria met</strong> (PIRATE mnemonic):<br>' +
      '<ul><li><strong>P</strong>robable future economic benefit</li><li><strong>I</strong>ntention to complete</li><li><strong>R</strong>esources available</li><li><strong>A</strong>bility to measure expenditure reliably</li><li><strong>T</strong>echnical feasibility</li><li><strong>E</strong>xpenditure attributable</li></ul>',
    keyPoints: [
      'Research = always expense',
      'Development = capitalize ONLY if 6 criteria met',
      'PIRATE mnemonic for development criteria',
      'Amortize over useful life once commercial production starts',
    ],
    commonMistakes: [
      'Capitalizing research costs',
      'Missing one PIRATE criterion → must expense all',
      'Confusing "technical feasibility" with "commercial viability"',
    ],
    relatedConcepts: ['IAS 38', 'Intangible assets', 'Amortization', 'Impairment'],
  },
  'Pro-rata depreciation': {
    explanation:
      '<strong>Pro-rata depreciation</strong> allocates depreciation based on actual months of ownership in the year of acquisition/disposal.<br><br>' +
      '<strong>Formula:</strong> (Cost - Residual) / Useful Life × (Months Owned / 12)<br><br>' +
      '<strong>Key rule:</strong> Count months from the <strong>month of acquisition</strong> (if purchased 15th March, count March as 1 month). For disposal, count months up to (but not including) disposal month.',
    keyPoints: [
      'Monthly rate = Annual depreciation / 12',
      'Acquisition month: count full month',
      'Disposal month: do NOT count',
      'Full year in middle years',
    ],
    commonMistakes: [
      'Counting disposal month (should exclude)',
      'Not counting acquisition month (should include)',
      'Using 365-day calculation instead of monthly',
    ],
    relatedConcepts: ['Depreciation methods', 'Asset disposal', 'IAS 16'],
  },
  'Control Accounts': {
    explanation:
      '<strong>Control Accounts</strong> are summary accounts in the General Ledger that must equal the sum of their subsidiary ledger balances.<br><br>' +
      '<strong>Receivables Control Account (Debtors)</strong> = Sum of all individual customer balances in Sales Ledger<br>' +
      '<strong>Payables Control Account (Creditors)</strong> = Sum of all individual supplier balances in Purchase Ledger<br><br>' +
      '<strong>Reconciliation process:</strong> Compare control account balance → subsidiary ledger total → investigate differences (timing, errors, omissions).',
    keyPoints: [
      'Control account = summary in GL',
      'Subsidiary ledger = detail per customer/supplier',
      'Must reconcile monthly',
      'Differences = errors, timing, or fraud',
    ],
    commonMistakes: [
      'Forgetting to include opening balances',
      'Not reconciling discounts allowed/received',
      'Missing contra entries (set-offs)',
    ],
    relatedConcepts: ['Sales ledger', 'Purchase ledger', 'Reconciliation', 'Contra entries'],
  },
  '5-term taxonomy': {
    explanation:
      '<strong>5-Term Taxonomy (IAS 1 Presentation)</strong> classifies expenses by nature AND function:<br><br>' +
      '<strong>By Nature:</strong> What the expense IS (depreciation, salaries, rent, materials)<br>' +
      '<strong>By Function:</strong> What the expense is FOR (cost of sales, distribution, admin, finance)<br><br>' +
      'The 5 terms: <strong>Revenue, Cost of Sales, Gross Profit, Operating Expenses, Profit Before Tax</strong>',
    keyPoints: [
      'Nature = type of expense',
      'Function = purpose of expense',
      'Both presentations allowed under IAS 1',
      'Gross profit = Revenue - Cost of Sales',
    ],
    commonMistakes: [
      'Mixing nature and function in one statement',
      'Putting finance costs in operating expenses',
      'Confusing "distribution" with "admin" costs',
    ],
    relatedConcepts: ['IAS 1', 'Statement of P&L', 'Gross profit margin'],
  },
};

function findMatchingTemplate(question: Question): AIExplanationResponse | null {
  const text = (question.q + ' ' + question.ex + ' ' + (question.topic || '') + ' ' + (question.subtopic || '')).toLowerCase();

  if (text.includes('dead clic') || text.includes('debit credit') || text.includes('double entry')) {
    return EXPLANATION_TEMPLATES['DEAD CLIC'];
  }
  if (text.includes('research') && text.includes('development') || text.includes('ias 38') || text.includes('pirate')) {
    return EXPLANATION_TEMPLATES['R&D'];
  }
  if (text.includes('pro-rata') || text.includes('pro rata') || (text.includes('depreciation') && text.includes('month'))) {
    return EXPLANATION_TEMPLATES['Pro-rata depreciation'];
  }
  if (text.includes('control account') || text.includes('receivables control') || text.includes('payables control') || text.includes('reconciliation')) {
    return EXPLANATION_TEMPLATES['Control Accounts'];
  }
  if (text.includes('5 term') || text.includes('five term') || text.includes('nature') && text.includes('function') || text.includes('taxonomy')) {
    return EXPLANATION_TEMPLATES['5-term taxonomy'];
  }

  return null;
}

// ============================= OmniRoute API Calls =============================

async function callOmniRoute<T>(endpoint: string, body: unknown): Promise<T | null> {
  const config = getAIConfig();
  if (!config.enabled || !config.apiKey) return null;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.timeout);

    const response = await fetch(`${config.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`OmniRoute API error: ${response.status}`);
      return null;
    }

    return await response.json();
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      console.warn('OmniRoute request timeout');
    } else {
      console.warn('OmniRoute request failed:', e);
    }
    return null;
  }
}

// ============================= Public API =============================

export async function getAIExplanation(request: AIExplanationRequest): Promise<AIExplanationResponse> {
  // Try API first
  const apiResult = await callOmniRoute<AIExplanationResponse>('/explain', request);
  if (apiResult) return apiResult;

  // Fallback to local template
  const template = findMatchingTemplate(request.question);
  if (template) return template;

  // Generic fallback
  return {
    explanation: request.question.ex || 'No explanation available.',
    keyPoints: ['Review the concept in your study materials'],
    commonMistakes: ['Read the question carefully'],
    relatedConcepts: [request.question.section, request.question.topic || request.question.subtopic || ''].filter(Boolean),
  };
}

export async function getAIHint(request: AIHintRequest): Promise<AIHintResponse> {
  const apiResult = await callOmniRoute<AIHintResponse>('/hint', request);
  if (apiResult) return apiResult;

  // Local fallback: extract first logical step from explanation
  const template = findMatchingTemplate(request.question);
  if (template) {
    const firstPoint = template.keyPoints[0] || 'Identify the key concept being tested.';
    return {
      hint: request.step === 1 ? `Start by: ${firstPoint}` : `Next: ${template.keyPoints[1] || 'Apply the relevant rule or formula.'}`,
      revealsAnswer: request.step >= 2,
    };
  }

  return {
    hint: request.step === 1 ? 'Identify the accounting standard or rule being tested.' : 'Apply the rule to the specific numbers given.',
    revealsAnswer: request.step >= 2,
  };
}

export async function getAIWhyWrong(request: AIWhyWrongRequest): Promise<AIWhyWrongResponse> {
  const apiResult = await callOmniRoute<AIWhyWrongResponse>('/why-wrong', request);
  if (apiResult) return apiResult;

  // Local fallback using template
  const template = findMatchingTemplate(request.question as Question);
  if (template && template.commonMistakes.length > 0) {
    const misconception = template.commonMistakes[0];
    return {
      analysis: `Your answer suggests: ${misconception}`,
      misconception,
      correctReasoning: template.keyPoints[0] || 'Review the correct approach.',
    };
  }

  return {
    analysis: 'The selected answer does not match the correct application of the rule.',
    misconception: 'Misapplication of the accounting principle.',
    correctReasoning:
      String(request.question.ex || '').replace(/<[^>]*>/g, '').trim() ||
      'Refer to the explanation for the correct reasoning.',
  };
}

export async function getAIVariant(request: AIVariantRequest): Promise<AIVariantResponse> {
  const apiResult = await callOmniRoute<AIVariantResponse>('/variant', request);
  if (apiResult) return apiResult;

  // Local fallback: parameterize numeric questions
  const question = request.question;
  if (question.t === 'numeric' && typeof question.a === 'number') {
    const multiplier = 0.5 + Math.random(); // 0.5x to 1.5x
    const newAnswer = Math.round(question.a * multiplier * 100) / 100;
    const newQuestion = {
      ...question,
      id: `${question.id}-var-${Date.now()}`,
      q: question.q.replace(/\d+/g, (match) => {
        const num = parseFloat(match);
        return Math.round(num * multiplier * 100) / 100 + '';
      }),
      a: newAnswer,
      source: 'ai-generated' as const,
    };
    return {
      question: newQuestion,
      changedElements: ['Numeric values scaled'],
    };
  }

  // For non-numeric, return a similar question from the same subtopic
  return {
    question: { ...question, id: `${question.id}-var-${Date.now()}`, source: 'ai-generated' as const },
    changedElements: ['Question ID regenerated'],
  };
}

// ============================= Health Check =============================

export async function checkAIHealth(): Promise<boolean> {
  const config = getAIConfig();
  if (!config.enabled || !config.apiKey) return false;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${config.baseUrl}/health`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${config.apiKey}` },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    return false;
  }
}
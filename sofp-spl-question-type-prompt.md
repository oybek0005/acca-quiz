# Prompt: "Full Financial Statements" Question Type (SOFP + SPL) for an ACCA FA Quiz App

> **How to use this file:** Paste this entire document to your coder AI (Cursor, Claude Code, Copilot, ChatGPT, etc.) together with a short description of your app's current stack and how your existing question types are modeled. Ask it to implement this as a new question type consistent with your existing architecture.

## 1. Background / why this question type

This is for an ACCA **FA (Financial Accounting)** exam-prep quiz app. Add a new question type where the learner is given a trial balance plus year-end adjustment notes and must **construct the full Statement of Profit or Loss (SPL) and the full Statement of Financial Position (SOFP) from scratch**, entering every figure themselves.

Ground truth about the real exam (so the feature stays faithful to what the learner will actually sit), taken from the learner's own 2025/26 Kaplan Study Text and Exam Kit:

- The FA CBE = **35 objective test questions × 2 marks (70 marks) + 2 multi-task questions × 15 marks (30 marks)**, 2 hours total, **pass mark 50%**.
- One CBE answer format is **"Number entry"** — the candidate types a number into a field on screen. No free text is ever required.
- Kaplan explicitly tells students: *"Make sure that you practise preparing full financial statements. There are lots of questions to practise in this text."* — so a full-construction drill (this feature) is a core, recommended practice format even though the live exam usually slices the 15-mark multi-task question into several smaller sub-tasks.
- The SPL in the current study text is presented using **IFRS 18** categories (Operating / Investing / Financing / Income tax) — this replaced the older IAS 1-style "operating expenses" layout. Use the IFRS 18 structure below so the app matches what the learner is actually taught.

## 2. Scope for this feature (v1)

In scope:
- One combined question per item: **one trial balance + adjustment notes → learner fills in both the full SPL and the full SOFP** (this mirrors the real exam, where both statements come from one connected scenario, and was the learner's explicit choice over separate SPL-only/SOFP-only drills).
- Two entity templates: **limited company** (share capital, share premium, revaluation surplus, retained earnings) and **sole trader** (single capital account: capital b/f + profit for the year − drawings = capital c/f).
- Answer entry = **type a number into a blank next to a fixed, pre-printed line label** — i.e. the exact real-CBE "number entry" style, not drag-and-drop, not multiple choice.
- Automated grading, line by line, with clear feedback and full model workings on review.

Out of scope for v1 (mention as future phases, don't build now): statement of cash flows construction, consolidated (group) accounts, randomly-generated trial balances. Design the data model so these can be added later without a rewrite.

## 3. Data model

Model a question as one JSON object. Represent both statements as a single flat, **ordered** list of "lines" — ordered so that every line a subtotal depends on appears *before* that subtotal. This ordering is what makes the grading algorithm in Section 6 simple (no dependency graph / topological sort needed).

```jsonc
{
  "id": "fs-001",
  "type": "financial_statements_construction",   // add alongside your existing question-type enum
  "entityType": "company",                        // "company" | "soleTrader"
  "topicTags": ["accruals", "prepayments", "depreciation", "irrecoverable-debts", "inventory", "loan-interest", "tax"],
  "difficulty": "medium",
  "yearEndDate": "31 December 20X5",
  "scenario": "Free text: company name, year end, any narrative context.",

  "trialBalance": [
    { "account": "Purchases", "debit": 150000, "credit": null },
    { "account": "Revenue", "debit": null, "credit": 260000 }
    // ...one row per trial balance line, exactly as given to the learner
  ],

  "adjustmentNotes": [
    { "ref": 1, "text": "Closing inventory at the year end was valued at cost of $15,000." }
    // ...one entry per numbered note
  ],

  "lines": [
    {
      "id": "spl_revenue",
      "statement": "SPL",
      "section": "operating",
      "label": "Revenue",
      "kind": "input",
      "correctValue": 260000,
      "marks": 1
    },
    {
      "id": "spl_cost_of_sales",
      "statement": "SPL",
      "section": "operating",
      "label": "Cost of sales",
      "kind": "input",
      "correctValue": 147000,
      "marks": 2,
      "workingHint": "Opening inventory + Purchases − Closing inventory"
    },
    {
      "id": "spl_gross_profit",
      "statement": "SPL",
      "section": "operating",
      "label": "Gross profit",
      "kind": "subtotal",
      "correctValue": 113000,
      "marks": 1,
      "formula": [
        { "lineId": "spl_revenue", "op": "+" },
        { "lineId": "spl_cost_of_sales", "op": "-" }
      ]
    }
    // ...continue for every remaining SPL and SOFP line (full example in Section 7)
  ]
}
```

Field notes:

- `kind: "input"` = a figure the learner calculates themselves from the TB + notes (may combine several adjustments into one cell — see `marks`).
- `kind: "subtotal"` = a figure that is *purely* the sum/difference of other lines already on the page (Gross profit, Operating profit, Profit for the year, Total assets, Total equity, Total current liabilities, Total equity and liabilities, etc.). Give it a `formula` array — this is what powers the optional own-figure grading in Section 6.
- `marks`: default 1 per line; use 2 on lines that fold together several adjustments (cost of sales, a compound expense line, net receivables, PPE carrying amount) so mark weighting reflects how much work the line actually tests.
- Keep every line's `id` stable — the grading engine and your analytics/weak-topic tracking both key off it.
- For `entityType: "soleTrader"`, replace the equity lines with: `Capital b/f`, `Profit for the year` (formula, references the SPL total), `Drawings` (input), `Capital c/f` (subtotal formula = b/f + profit − drawings).

## 4. Reference proformas (hardcode as the on-screen template)

**Statement of Profit or Loss** (IFRS 18 categories, per the learner's current study text):

```
Revenue                                          X
Cost of sales                                   (X)
                                              ------
Gross profit                                     X
Distribution costs                              (X)
Administrative expenses                         (X)
                                              ------
Operating profit                                 X
Investing income (interest/dividends received)   X
                                              ------
Profit before financing and income tax           X
Finance costs                                   (X)
                                              ------
Profit before income tax                         X
Income tax expense                              (X)
                                              ------
Profit for the year                              X
```

**Statement of Financial Position:**

```
ASSETS
Non-current assets
  Property, plant and equipment                  X
  Intangible assets                               X
  Investments                                     X
                                              ------
                                                   X
Current assets
  Inventories                                     X
  Trade and other receivables                     X
  Prepayments                                     X
  Cash and cash equivalents                       X
                                              ------
                                                   X
                                              ------
TOTAL ASSETS                                      X
                                              ======
EQUITY AND LIABILITIES
Equity
  Share capital                                   X
  Share premium                                   X
  Revaluation surplus                             X
  Retained earnings                                X
                                              ------
Total equity                                      X
Non-current liabilities
  Loan notes / borrowings                         X
Current liabilities
  Trade and other payables                        X
  Accruals                                        X
  Tax payable                                     X
  Bank overdraft                                  X
                                              ------
Total current liabilities                         X
                                              ------
TOTAL EQUITY AND LIABILITIES                      X
                                              ======
```

Only render an input box for a line that is actually used in a given question (omit e.g. "Investments" or "Bank overdraft" if the question has nothing for it) — don't force learners to type 0 into every unused line of a generic template.

## 5. UI / UX requirements

1. **Layout**: scenario + trial balance + numbered adjustment notes on one side (read-only reference, always visible/scrollable), the SPL proforma above the SOFP proforma on the other side, each pre-printed with fixed labels and one numeric input box per line (including subtotal/total lines — the learner must calculate and enter those too, exactly as in the real exam).
2. **Input constraints**: numeric only, no minus signs (the proforma already shows `(X)` for deductions — the learner enters the magnitude, the app applies the sign); allow the field to be left blank (graded as "blank", not "wrong"); format with thousands separators on blur but store as a plain number.
3. **Live balance indicator** (UX only, not a scored mark): as the learner types, show whether their own "Total assets" equals their own "Total equity and liabilities" yet — a green check or a "doesn't balance yet" hint. This mirrors how accountants self-check their own work and helps the learner catch mistakes before submitting.
4. **Suggested timer**: default to the Kaplan-recommended 1.2 minutes per mark (e.g. a 29-mark question → ~35 minutes), shown as guidance, not enforced.
5. **On submit**: lock inputs, run the grading engine (Section 6), then show a **full worked solution** — not just the correct numbers but the mini-workings behind every adjustment (e.g. "Allowance for receivables: 5% × $38,000 = $1,900; decrease from $2,000 b/f = $100 credited to admin expenses"). ACCA-style answers are never just a number — they always show the working, and that's the part that actually teaches the learner.
6. Support both `entityType` templates (Section 3) and switch the equity block automatically based on the question's `entityType`.

## 6. Grading engine

### 6.1 Default mode: exact match (use this — it matches how the real CBE auto-marks number entry)

Each line is graded independently against its `correctValue`, within a small configurable rounding `tolerance` (default `0`; allow authors to set e.g. `1` for a question where a rounding split is unavoidable). Blank = 0 marks, never an error/crash.

### 6.2 Optional mode: "own figure" (OFR) coaching mode — off by default

The real ACCA FA CBE is machine-marked and very likely does **not** apply own-figure/follow-through credit to number-entry cells — so exact match (6.1) should be the default and the one used when the learner wants an authentic mock-exam experience.

However, as a **practice/coaching toggle**, OFR is valuable: it separates "I understood the *method*" from "I carried an earlier slip forward," which is exactly the distinction a learner needs while still studying. Implement it as an opt-in setting per attempt:

For any `kind: "subtotal"` line the learner got wrong against `correctValue`, recompute what that line *should* equal using the **learner's own entered values** for its `formula` dependencies (falling back to the model's `correctValue` for any dependency the learner left blank). If the learner's entered value matches that recomputed figure, award full marks with verdict `"ofr-credit"` and show it in feedback as *"Correct method — the number above it was wrong, but you used it correctly here."*

### 6.3 Reference implementation (JavaScript — adapt to your actual stack/language)

```javascript
function gradeFinancialStatementAnswer(question, candidateAnswers, options = { mode: "exact", tolerance: 0 }) {
  // question.lines must be pre-ordered: every line referenced in a `formula`
  // appears earlier in the array than the subtotal that references it.
  // candidateAnswers: { [lineId]: number | null | undefined }

  const byId = Object.fromEntries(question.lines.map(l => [l.id, l]));
  const ownValue = {};   // learner's own entered value per line, used for OFR recomputation
  const results = {};

  for (const line of question.lines) {
    const raw = candidateAnswers[line.id];
    const hasEntry = raw !== null && raw !== undefined && raw !== "";
    let verdict = "blank";
    let marksAwarded = 0;

    if (hasEntry) {
      const entered = Number(raw);
      const exactMatch = Math.abs(entered - line.correctValue) <= options.tolerance;

      if (exactMatch) {
        verdict = "correct";
        marksAwarded = line.marks;
      } else if (options.mode === "ofr" && line.kind === "subtotal" && line.formula) {
        const ofrExpected = line.formula.reduce((total, dep) => {
          const depValue = ownValue[dep.lineId] ?? byId[dep.lineId].correctValue;
          return dep.op === "+" ? total + depValue : total - depValue;
        }, 0);
        if (Math.abs(entered - ofrExpected) <= options.tolerance) {
          verdict = "ofr-credit";
          marksAwarded = line.marks;
        } else {
          verdict = "incorrect";
        }
      } else {
        verdict = "incorrect";
      }

      ownValue[line.id] = entered;
    }

    results[line.id] = {
      verdict,
      marksAwarded,
      marksAvailable: line.marks,
      entered: hasEntry ? Number(raw) : null,
      expected: line.correctValue,
    };
  }

  const totalMarks = question.lines.reduce((sum, l) => sum + l.marks, 0);
  const scoredMarks = Object.values(results).reduce((sum, r) => sum + r.marksAwarded, 0);

  return {
    lineResults: results,
    scoredMarks,
    totalMarks,
    percentage: Math.round((scoredMarks / totalMarks) * 100),
    passed: scoredMarks / totalMarks >= 0.5,   // ACCA's own pass mark for FA
    topicBreakdown: summarizeByTopic(question, results), // implement: aggregate marksAwarded/marksAvailable per question.topicTags for weak-area tracking
  };
}
```

### 6.4 Edge cases to handle explicitly

- Non-numeric input → reject client-side before it ever reaches grading.
- Blank line → `"blank"` verdict, 0 marks, never crashes the scorer.
- A line the question doesn't use (e.g. no overdraft) simply isn't included in `question.lines` for that question — don't force a 0 entry.
- Rounding: keep a per-question `tolerance` (default 0) rather than a single global constant, since some questions will involve unavoidable rounding (e.g. apportioning depreciation across categories) and others (most) should require an exact figure.
- Sign handling for the allowance-for-receivables movement: a *decrease* in the allowance reduces the expense (can make a compound `input` line's underlying calculation net negative internally even though the learner only ever types positive magnitudes) — this is arithmetic inside the model answer, not something the UI needs to expose.

## 7. Worked example (use as your test fixture)

An original example — not copied from any exam question — built and hand-verified so it fully balances. Use this to unit-test both the UI rendering and the grading function above before wiring up real question content.

**Silk Road Trading Co — Trial balance at 31 December 20X5**

| Account | Debit $ | Credit $ |
|---|---:|---:|
| Purchases | 150,000 | |
| Inventory at 1 January 20X5 | 12,000 | |
| Distribution costs | 18,000 | |
| Administrative expenses | 25,000 | |
| Trade receivables | 40,000 | |
| Property, plant and equipment — cost | 200,000 | |
| Bank and cash | 67,800 | |
| Loan interest paid | 1,200 | |
| Revenue | | 260,000 |
| Share capital ($1 ordinary shares) | | 100,000 |
| Retained earnings at 1 January 20X5 | | 30,000 |
| Trade payables | | 22,000 |
| Allowance for receivables at 1 January 20X5 | | 2,000 |
| PPE — accumulated depreciation at 1 January 20X5 | | 60,000 |
| 6% loan notes (repayable 20X9) | | 40,000 |
| **Total** | **514,000** | **514,000** |

**Adjustment notes:**

1. Closing inventory at 31 December 20X5 was valued at cost of $15,000.
2. Administrative expenses include a prepayment of $1,000 for insurance relating to 20X6.
3. Distribution costs do not yet include an accrual of $800 for December delivery costs, invoiced after the year end.
4. Property, plant and equipment is depreciated at 10% per annum on the reducing balance, charged to administrative expenses.
5. Trade receivables include $2,000 from a customer that has ceased trading; write this off as irrecoverable. The allowance for receivables is then to be adjusted to 5% of the remaining trade receivables. (Both the write-off and the allowance movement are charged/credited to administrative expenses.)
6. The loan notes have been in issue all year. Only the first half-year's interest ($1,200, in the trial balance) has been paid; the second half-year's interest is accrued but unpaid.
7. Income tax for the year is estimated at $9,000.

**Model answer — Statement of Profit or Loss for the year ended 31 December 20X5**

| Line | $ | Marks | Working |
|---|---:|---:|---|
| Revenue | 260,000 | 1 | Per TB |
| Cost of sales | (147,000) | 2 | 12,000 + 150,000 − 15,000 |
| **Gross profit** | **113,000** | 1 | subtotal |
| Distribution costs | (18,800) | 1 | 18,000 + 800 accrual |
| Administrative expenses | (39,900) | 2 | 25,000 − 1,000 prepaid + 14,000 depreciation + 2,000 write-off − 100 allowance decrease |
| **Operating profit** | **54,300** | 1 | subtotal |
| Finance costs | (2,400) | 1 | 6% × 40,000 |
| **Profit before income tax** | **51,900** | 1 | subtotal |
| Income tax expense | (9,000) | 1 | per note 7 |
| **Profit for the year** | **42,900** | 1 | subtotal |

SPL marks subtotal: **12**

**Model answer — Statement of Financial Position as at 31 December 20X5**

| Line | $ | Marks | Working |
|---|---:|---:|---|
| Property, plant and equipment | 126,000 | 2 | 200,000 cost − (60,000 + 14,000) acc. depreciation |
| Inventory | 15,000 | 1 | closing inventory |
| Trade receivables | 36,100 | 2 | (40,000 − 2,000 write-off) − 1,900 allowance |
| Prepayments | 1,000 | 1 | note 2 |
| Bank and cash | 67,800 | 1 | unchanged |
| **Total assets** | **245,900** | 1 | subtotal |
| Share capital | 100,000 | 1 | per TB |
| Retained earnings | 72,900 | 1 | 30,000 b/f + 42,900 profit for year |
| **Total equity** | **172,900** | 1 | subtotal |
| Loan notes (non-current) | 40,000 | 1 | per TB |
| Trade payables | 22,000 | 1 | per TB |
| Accruals | 2,000 | 1 | 800 delivery + 1,200 loan interest |
| Tax payable | 9,000 | 1 | note 7 |
| **Total current liabilities** | **33,000** | 1 | subtotal |
| **Total equity and liabilities** | **245,900** | 1 | subtotal — matches total assets ✓ |

SOFP marks subtotal: **17**. **Total question marks: 29.**

Full `lines` array for this fixture (drop straight into the schema from Section 3):

```json
[
  { "id": "spl_revenue", "statement": "SPL", "section": "operating", "label": "Revenue", "kind": "input", "correctValue": 260000, "marks": 1 },
  { "id": "spl_cos", "statement": "SPL", "section": "operating", "label": "Cost of sales", "kind": "input", "correctValue": 147000, "marks": 2, "workingHint": "12,000 + 150,000 − 15,000" },
  { "id": "spl_gross_profit", "statement": "SPL", "section": "operating", "label": "Gross profit", "kind": "subtotal", "correctValue": 113000, "marks": 1, "formula": [{ "lineId": "spl_revenue", "op": "+" }, { "lineId": "spl_cos", "op": "-" }] },
  { "id": "spl_distribution", "statement": "SPL", "section": "operating", "label": "Distribution costs", "kind": "input", "correctValue": 18800, "marks": 1, "workingHint": "18,000 + 800 accrual" },
  { "id": "spl_admin", "statement": "SPL", "section": "operating", "label": "Administrative expenses", "kind": "input", "correctValue": 39900, "marks": 2, "workingHint": "25,000 − 1,000 + 14,000 + 2,000 − 100" },
  { "id": "spl_operating_profit", "statement": "SPL", "section": "operating", "label": "Operating profit", "kind": "subtotal", "correctValue": 54300, "marks": 1, "formula": [{ "lineId": "spl_gross_profit", "op": "+" }, { "lineId": "spl_distribution", "op": "-" }, { "lineId": "spl_admin", "op": "-" }] },
  { "id": "spl_finance_costs", "statement": "SPL", "section": "financing", "label": "Finance costs", "kind": "input", "correctValue": 2400, "marks": 1, "workingHint": "6% × 40,000" },
  { "id": "spl_pbt", "statement": "SPL", "section": "financing", "label": "Profit before income tax", "kind": "subtotal", "correctValue": 51900, "marks": 1, "formula": [{ "lineId": "spl_operating_profit", "op": "+" }, { "lineId": "spl_finance_costs", "op": "-" }] },
  { "id": "spl_tax", "statement": "SPL", "section": "tax", "label": "Income tax expense", "kind": "input", "correctValue": 9000, "marks": 1 },
  { "id": "spl_profit_for_year", "statement": "SPL", "section": "tax", "label": "Profit for the year", "kind": "subtotal", "correctValue": 42900, "marks": 1, "formula": [{ "lineId": "spl_pbt", "op": "+" }, { "lineId": "spl_tax", "op": "-" }] },

  { "id": "sofp_ppe", "statement": "SOFP", "section": "non_current_assets", "label": "Property, plant and equipment", "kind": "input", "correctValue": 126000, "marks": 2, "workingHint": "200,000 − (60,000 + 14,000)" },
  { "id": "sofp_inventory", "statement": "SOFP", "section": "current_assets", "label": "Inventory", "kind": "input", "correctValue": 15000, "marks": 1 },
  { "id": "sofp_receivables", "statement": "SOFP", "section": "current_assets", "label": "Trade receivables", "kind": "input", "correctValue": 36100, "marks": 2, "workingHint": "(40,000 − 2,000) − 1,900" },
  { "id": "sofp_prepayments", "statement": "SOFP", "section": "current_assets", "label": "Prepayments", "kind": "input", "correctValue": 1000, "marks": 1 },
  { "id": "sofp_cash", "statement": "SOFP", "section": "current_assets", "label": "Bank and cash", "kind": "input", "correctValue": 67800, "marks": 1 },
  { "id": "sofp_total_assets", "statement": "SOFP", "section": "totals", "label": "Total assets", "kind": "subtotal", "correctValue": 245900, "marks": 1, "formula": [{ "lineId": "sofp_ppe", "op": "+" }, { "lineId": "sofp_inventory", "op": "+" }, { "lineId": "sofp_receivables", "op": "+" }, { "lineId": "sofp_prepayments", "op": "+" }, { "lineId": "sofp_cash", "op": "+" }] },

  { "id": "sofp_share_capital", "statement": "SOFP", "section": "equity", "label": "Share capital", "kind": "input", "correctValue": 100000, "marks": 1 },
  { "id": "sofp_retained_earnings", "statement": "SOFP", "section": "equity", "label": "Retained earnings", "kind": "input", "correctValue": 72900, "marks": 1, "workingHint": "30,000 + 42,900" },
  { "id": "sofp_total_equity", "statement": "SOFP", "section": "equity", "label": "Total equity", "kind": "subtotal", "correctValue": 172900, "marks": 1, "formula": [{ "lineId": "sofp_share_capital", "op": "+" }, { "lineId": "sofp_retained_earnings", "op": "+" }] },
  { "id": "sofp_loan_notes", "statement": "SOFP", "section": "non_current_liabilities", "label": "Loan notes", "kind": "input", "correctValue": 40000, "marks": 1 },
  { "id": "sofp_payables", "statement": "SOFP", "section": "current_liabilities", "label": "Trade payables", "kind": "input", "correctValue": 22000, "marks": 1 },
  { "id": "sofp_accruals", "statement": "SOFP", "section": "current_liabilities", "label": "Accruals", "kind": "input", "correctValue": 2000, "marks": 1, "workingHint": "800 + 1,200" },
  { "id": "sofp_tax_payable", "statement": "SOFP", "section": "current_liabilities", "label": "Tax payable", "kind": "input", "correctValue": 9000, "marks": 1 },
  { "id": "sofp_total_current_liabilities", "statement": "SOFP", "section": "current_liabilities", "label": "Total current liabilities", "kind": "subtotal", "correctValue": 33000, "marks": 1, "formula": [{ "lineId": "sofp_payables", "op": "+" }, { "lineId": "sofp_accruals", "op": "+" }, { "lineId": "sofp_tax_payable", "op": "+" }] },
  { "id": "sofp_total_equity_and_liabilities", "statement": "SOFP", "section": "totals", "label": "Total equity and liabilities", "kind": "subtotal", "correctValue": 245900, "marks": 1, "formula": [{ "lineId": "sofp_total_equity", "op": "+" }, { "lineId": "sofp_loan_notes", "op": "+" }, { "lineId": "sofp_total_current_liabilities", "op": "+" }] }
]
```

Use this fixture to test: (a) the UI renders both statements correctly with all inputs blank, (b) submitting the exact model values scores 29/29, (c) submitting a wrong `spl_admin` value but then correctly carrying it through `spl_operating_profit`, `spl_pbt`, `spl_profit_for_year`, `sofp_retained_earnings`, etc. scores those downstream lines as `"ofr-credit"` when `mode: "ofr"` and as `"incorrect"` when `mode: "exact"`.

## 8. Feedback / results output

After grading, show the learner, per line: their answer, the correct answer, verdict (correct / ofr-credit / incorrect / blank), and — for anything not fully correct — the worked calculation from Section 7's `workingHint` style content. Show overall score as marks and percentage, and pass/fail against **50%** (ACCA's actual pass mark) so the practice score means something. Aggregate results by `topicTags` across attempts (accruals, depreciation, inventory, etc.) so the learner can see which adjustment type keeps tripping them up — this is more useful for a 2-month exam-prep sprint than a single question score.

## 9. Suggested build order

1. **MVP**: one hardcoded question using the Section 7 fixture, fixed-label proforma UI, exact-match grading only, results screen with per-line correct/incorrect + full workings on review.
2. **V2**: question bank support (multiple authored questions via the Section 3 schema), sole-trader template, topic-tagged weak-area report.
3. **V3 (optional)**: the `mode: "ofr"` coaching toggle from Section 6.2; randomly-varied trial balance numbers within an authored template.

## 10. Questions for the coder AI to confirm with the developer before starting

- What language/framework and state-management pattern does the existing quiz app already use for other question types (so this integrates the same way rather than introducing a new pattern)?
- How are existing questions currently authored/stored (hand-written JSON/DB rows, a CMS, a spreadsheet import)? Reuse that pipeline for this question type's `trialBalance` / `lines` content.
- Should scores on this question type feed into the same overall progress/analytics system as the existing question types, or does it need its own tracking view given it's worth far more marks than a single MCQ?

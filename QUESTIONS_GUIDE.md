# Savol qo'shish yo'riqnomasi

Savollar bitta faylda: **`src/data/questions.json`**.

Fayl tuzilishi:

```jsonc
{
  "meta": { "version": 1, "generated": "2026-08-27", "updated": "2026-09-01", "totalQuestions": 245 },
  "sections": {
    "DE":  { "code": "DE",  "name": "Double Entry & Theory", "uz": "...", "questions": [ /* ... */ ] },
    "INV": { "code": "INV", "name": "Inventory",              "uz": "...", "questions": [ /* ... */ ] }
    // ... boshqa bo'limlar
  }
}
```

Bo'lim kodlari: `DE, INV, NCA, INT, TAX, ACC, RPP, CAP`.
Ilova yuklaganda har bir savolga `section` avtomatik qo'shiladi (bo'lim kalitidan), agar `difficulty` yo'q bo'lsa taxminan hisoblanadi. Lekin **har doim to'liq yozing**.

---

## Bitta savol maydonlari

| Maydon | Turi | Izoh |
|---|---|---|
| `id` | string | Noyob. Odat: `BO'LIM + raqam`, masalan `DE36`, `TAX26` |
| `t` | string | `mcq` \| `multi` \| `tf` \| `numeric` \| `manual` |
| `q` | string | Savol matni. HTML mumkin: `<b>`, `<i>`, `<br>`, `<ul><li>`, `<code>` |
| `opt` | string[] \| null | `mcq`/`multi` uchun variantlar; boshqalarda `null` |
| `a` | — | Javob (turga qarab, pastga qarang) |
| `ex` | string | Izoh. HTML mumkin. To'liq yeching — auto-advance shu izohga tayanadi |
| `topic` | string | Umumiy mavzu, masalan `"Depreciation"` |
| `subtopic` | string | Aniqroq teg (heatmap/analitika uchun), masalan `"Pro-rata depreciation"` |
| `section` | string | Bo'lim kodi (bo'lim kalitiga mos) |
| `difficulty` | string | `easy` \| `medium` \| `hard` |
| `source` | string | `original` \| `mid1` \| `hard100` \| `custom` \| `ai-generated` |

`a` maydoni turga qarab:

| `t` | `a` | Misol |
|---|---|---|
| `mcq` | to'g'ri variant **indeksi** (0 dan) | `"a": 2` |
| `multi` | to'g'ri **indekslar massivi** | `"a": [0, 3]` |
| `tf` | boolean | `"a": true` |
| `numeric` | son (± 0.01 yoki 0.1% dogma qabul qilinadi) | `"a": 12000` |
| `manual` | `null` (avto-baholanmaydi — model javob `ex` da) | `"a": null` |

---

## Namunalar (har bir tur uchun)

### 1) MCQ — bitta to'g'ri javob

```json
{
  "id": "DE36",
  "t": "mcq",
  "q": "A business purchases inventory for cash. Which accounts are affected?",
  "opt": [
    "Dr Inventory, Cr Cash",
    "Dr Cash, Cr Inventory",
    "Dr Purchases, Cr Payables",
    "Dr Inventory, Cr Payables"
  ],
  "a": 0,
  "ex": "Inventory (an asset) increases so it is <b>debited</b>; cash (an asset) decreases so it is <b>credited</b>. Both are DEAD-side items.",
  "topic": "Double entry",
  "subtopic": "DEAD CLIC",
  "section": "DE",
  "difficulty": "easy",
  "source": "custom"
}
```

### 2) Multi — bir nechta to'g'ri javob

```json
{
  "id": "INV30",
  "t": "multi",
  "q": "Which TWO of the following are included in the cost of inventory under IAS 2?",
  "opt": [
    "Carriage inwards on raw materials",
    "Storage costs of finished goods",
    "Direct labour used in production",
    "Selling commission paid to sales staff"
  ],
  "a": [0, 2],
  "ex": "IAS 2 cost = purchase cost + conversion cost + costs of bringing inventory to its present location and condition. Carriage inwards and direct labour qualify. Storage of finished goods and selling costs are period expenses.",
  "topic": "Inventory valuation",
  "subtopic": "IAS 2 cost",
  "section": "INV",
  "difficulty": "medium",
  "source": "custom"
}
```

### 3) True / False

```json
{
  "id": "NCA30",
  "t": "tf",
  "q": "True or False: A revaluation surplus is recognised in profit or loss for the period.",
  "opt": null,
  "a": false,
  "ex": "False. A revaluation gain goes to <b>other comprehensive income</b> and is held in the revaluation surplus (equity), not profit or loss.",
  "topic": "Revaluation",
  "subtopic": "Revaluation model",
  "section": "NCA",
  "difficulty": "easy",
  "source": "custom"
}
```

### 4) Numeric — raqamli javob

```json
{
  "id": "ACC38",
  "t": "numeric",
  "q": "Rent of $18,000 was paid on 1 October for the 12 months to 30 September. The year end is 31 December. What is the prepayment at 31 December? $",
  "opt": null,
  "a": 13500,
  "ex": "9 months (Jan–Sep) relate to next year: $18,000 x 9/12 = <b>$13,500</b>.",
  "topic": "Prepayments",
  "subtopic": "Prepaid expenses",
  "section": "ACC",
  "difficulty": "medium",
  "source": "custom"
}
```

### 5) Manual — yozma javob (avto-baholanmaydi)

```json
{
  "id": "RPP36",
  "t": "manual",
  "q": "Explain the difference between a provision and a contingent liability under IAS 37.",
  "opt": null,
  "a": null,
  "ex": "<b>Provision:</b> a present obligation, probable outflow, reliably measurable → recognised as a liability. <br><b>Contingent liability:</b> a possible obligation, or a present obligation that is not probable / not measurable → disclosed in the notes only, not recognised.",
  "topic": "Provisions",
  "subtopic": "IAS 37",
  "section": "RPP",
  "difficulty": "hard",
  "source": "custom"
}
```

### 6) FS — to'liq moliyaviy hisobot qurish (SPL + SOFP)

O'quvchiga trial balance + tuzatish izohlari beriladi; u **to'liq Statement of Profit or
Loss va Statement of Financial Position** ni o'zi to'ldiradi (har bir raqamni, jumladan
oraliq va yakuniy jamlarni ham). Baholash — har qatorni alohida, `correctValue` bilan
solishtirib. ACCA o'tish balli **50%**.

Bu tur **`t: "fs"`**. Odatdagi savollardan farqli — o'z UI'si va baholash dvigateli bor.
"Mixed / section" quizlarga aralashmaydi; Dashboard'dagi **"Financial statements"** tugmasi
orqali alohida ishlanadi.

**Maydonlar:**

| Maydon | Turi | Izoh |
|---|---|---|
| `id`, `t`, `section`, `difficulty`, `topic`, `subtopic`, `source` | — | Odatdagidek. `t` = `"fs"`, `section` = mavjud kod (odatda `"DE"`), `difficulty` = `"hard"` |
| `q` | string | Qisqa topshiriq matni (HTML) |
| `a` | `null` | Har doim null — javob `lines` ichida |
| `ex` | string | Umumiy izoh — asosiy workinglar (natijada ko'rinadi) |
| `entityType` | string | `"company"` \| `"soleTrader"` |
| `yearEndDate` | string | masalan `"31 December 20X5"` |
| `scenario` | string | Kompaniya nomi / kontekst (HTML) |
| `trialBalance` | massiv | `{ account, debit, credit }` — biri `null` |
| `adjustmentNotes` | massiv | `{ ref: 1, text: "..." }` — raqamli izohlar |
| `lines` | massiv | Ikkala hisobotning barcha qatorlari, **tartiblangan** (har oraliq jam o'zidan oldingi qatorlarga tayanadi) |
| `tolerance` | number | Ixtiyoriy, standart `0` — yaxlitlash uchun (masalan `1`) |

**Bitta `lines` qatori:**

| Maydon | Izoh |
|---|---|
| `id` | Barqaror, noyob (masalan `spl_revenue`). Baholash va analitika shunga tayanadi |
| `statement` | `"SPL"` \| `"SOFP"` |
| `group` | Ekranda guruh sarlavhasi: `"Operating"`, `"Current assets"`, `"Equity"`, `"Totals"` va h.k. |
| `label` | Proformadagi tayyor yozuv (masalan `"Cost of sales"`) |
| `kind` | `"input"` (o'quvchi hisoblaydi) \| `"subtotal"` (faqat boshqa qatorlar jami) |
| `correctValue` | To'g'ri raqam (musbat) |
| `marks` | Ixtiyoriy, standart `1`; bir nechta tuzatish qo'shiladigan qatorga `2` bering |
| `deduction` | `true` — proforma `( )` ko'rsatadi, o'quvchi musbat kattalik kiritadi (COS, xarajatlar, soliq...) |
| `workingHint` | Natijada ko'rsatiladigan mini-working |
| `formula` | Faqat `kind: "subtotal"` — `[{ "lineId": "...", "op": "+" | "-" }]`. "Own-figure" baholash uchun |

`soleTrader` uchun equity qatorlari: `Capital b/f` (input), `Profit for the year`
(subtotal, SPL jamiga tayanadi), `Drawings` (input), `Capital c/f` (subtotal = b/f + profit − drawings).

**To'liq namuna** — ilovada `FS1` sifatida mavjud (`src/data/questions.json` → `sections.DE.questions`).
Undan nusxa oling. Qisqartirilgan ko'rinishi:

```jsonc
{
  "id": "FS2",
  "t": "fs",
  "section": "DE",
  "difficulty": "hard",
  "topic": "Financial statements",
  "subtopic": "Full financial statements (company)",
  "source": "custom",
  "q": "<b>Acme Co</b> — prepare the full SPL and SOFP from the trial balance and notes below.",
  "a": null,
  "ex": "Key workings: depreciation …; allowance for receivables …; accrued interest ….",
  "entityType": "company",
  "yearEndDate": "31 December 20X6",
  "scenario": "Acme Co is a limited company. Prepare its financial statements for the year ended 31 December 20X6.",
  "tolerance": 0,
  "trialBalance": [
    { "account": "Purchases",  "debit": 200000, "credit": null },
    { "account": "Revenue",    "debit": null,   "credit": 340000 }
    // …one row per TB line
  ],
  "adjustmentNotes": [
    { "ref": 1, "text": "Closing inventory was valued at cost of $18,000." }
    // …one entry per numbered note
  ],
  "lines": [
    { "id": "spl_revenue", "statement": "SPL", "group": "Operating", "label": "Revenue",
      "kind": "input", "correctValue": 340000, "marks": 1, "workingHint": "Per trial balance" },
    { "id": "spl_cos", "statement": "SPL", "group": "Operating", "label": "Cost of sales",
      "kind": "input", "correctValue": 190000, "marks": 2, "deduction": true,
      "workingHint": "Opening + purchases − closing" },
    { "id": "spl_gross_profit", "statement": "SPL", "group": "Operating", "label": "Gross profit",
      "kind": "subtotal", "correctValue": 150000, "marks": 1,
      "formula": [ { "lineId": "spl_revenue", "op": "+" }, { "lineId": "spl_cos", "op": "-" } ] }
    // …continue for EVERY SPL then EVERY SOFP line, in order.
    // The last SOFP line "Total equity and liabilities" must equal "Total assets".
  ]
}
```

**Reference proformalar** — `label` va tartib aynan shunday bo'lsin (kerak bo'lmagan
qatorni tashlab keting; o'quvchini ishlatilmagan qatorlarga 0 yozishga majburlamang).

**SPL (Statement of Profit or Loss)** — IFRS 18 kategoriyalari, joriy study text bo'yicha:

| `label` | `group` | `kind` | `deduction` |
|---|---|---|---|
| Revenue | Operating | input | — |
| Cost of sales | Operating | input | ✔ |
| **Gross profit** | Operating | subtotal | — |
| Distribution costs | Operating | input | ✔ |
| Administrative expenses | Operating | input | ✔ |
| **Operating profit** | Operating | subtotal | — |
| Investment income | Investing & financing | input | — |
| Finance costs | Investing & financing | input | ✔ |
| **Profit before income tax** | Investing & financing | subtotal | — |
| Income tax expense | Tax | input | ✔ |
| **Profit for the year** | Tax | subtotal | — |

**SOFP (Statement of Financial Position):**

| `label` | `group` | `kind` |
|---|---|---|
| Property, plant and equipment | Non-current assets | input |
| Intangible assets | Non-current assets | input |
| Investments | Non-current assets | input |
| Inventories | Current assets | input |
| Trade receivables | Current assets | input |
| Prepayments | Current assets | input |
| Cash and cash equivalents | Current assets | input |
| **Total assets** | Totals | subtotal |
| Share capital | Equity | input |
| Share premium | Equity | input |
| Revaluation surplus | Equity | input |
| Retained earnings | Equity | input |
| **Total equity** | Equity | subtotal |
| Loan notes / borrowings | Non-current liabilities | input |
| Trade payables | Current liabilities | input |
| Accruals | Current liabilities | input |
| Tax payable | Current liabilities | input |
| Bank overdraft | Current liabilities | input |
| **Total current liabilities** | Current liabilities | subtotal |
| **Total equity and liabilities** | Totals | subtotal |

**Sole trader** — SOFP equity blokini quyidagiga almashtiring:

| `label` | `group` | `kind` | Izoh |
|---|---|---|---|
| Capital b/f | Equity | input | Yil boshidagi kapital |
| Profit for the year | Equity | subtotal | `formula` = SPL `Profit for the year` qatoriga `+` |
| Drawings | Equity | input | `deduction: true` |
| **Capital c/f** | Equity | subtotal | b/f + profit − drawings |

**Tekshirish ro'yxati (yuklashdan oldin):**

1. Har bir `subtotal` qatorining `formula` si `correctValue` ga to'g'ri keladimi.
2. `Total assets` == `Total equity and liabilities` (hisobot balanslashadi).
3. `lines` tartibi: har oraliq jam o'zidan oldingi qatorlarga tayanadi.
4. `id` lar noyob va barqaror (keyin o'zgartirmang).
5. Xarajat/kamaytiruvchi qatorlarda `deduction: true`.

> **v1 eslatma:** natijadagi umumiy foizda bu savol bitta savol sifatida sanaladi (50%+ = "to'g'ri").
> Batafsil `X/29 marks` ballari savol ichida va "Question Review" da ko'rinadi. `subtopic`
> bo'yicha analitika odatdagidek ishlaydi.

---

## Yangi bo'lim (mavzu) qo'shish

1. **Bo'lim kodini** tanlang (2–4 harf, masalan `CFS` — Cash Flow Statements).
2. `src/data/questions.json` → `sections` ga yangi kalit qo'shing:

```json
"CFS": { "code": "CFS", "name": "Cash Flow Statements", "uz": "Pul oqimi hisoboti", "questions": [ /* savollar */ ] }
```

3. `src/types/index.ts` da 3 joyni yangilang:
   - `SectionCode` tipiga `| 'CFS'` qo'shing
   - `SECTIONS` obyektiga yozuv qo'shing: `CFS: { code: 'CFS', name: '...', uz: '...', weight: 10 }`
   - `SECTION_ORDER` massiviga `'CFS'` qo'shing
4. `src/app/globals.css` da badge rangi qo'shing (ixtiyoriy):
   ```css
   .badge-CFS { background-color: #e0f2fe; color: #075985; }
   .dark .badge-CFS { background-color: #075985; color: #bae6fd; }
   ```
5. `npm run build` — xato bo'lmasligi kerak.

> `weight` — ACCA syllabus foizi; "Exam weights" aralashmasida ishlatiladi. Yig'indi ~100 bo'lsin.

---

## Import orqali qo'shish (kod tegmasdan)

Ilovada **Import / Export** sahifasi bor. Backup JSON ichida `questions` massivi bo'lsa,
ular `faq_custom_questions` ga saqlanadi va keyingi yuklashda bank bilan birlashadi.
Custom savol format — yuqoridagi bilan bir xil, faqat `"source": "custom"`.

---

## AI bilan tekshirish / kengaytirish

Ilovadagi **Import / Export → "Export for AI review"** tugmasi joriy holatni bitta JSON
faylga oladi: barcha savollar + xatolar tarixi + analitika (zaif bo'limlar, subtopic xato
foizlari). Uni AI ga bering va so'rang:

**Xatolarni tekshirish uchun prompt namunasi:**

> Quyida ACCA FA quiz ilovamdan JSON. `questions` massividagi har bir savolni ACCA FA
> (FFA) syllabusi bo'yicha tekshir: (1) `a` javob to'g'rimi, (2) `ex` izoh aniqmi,
> (3) `difficulty` mos kelmi. Faqat xato yoki shubhali savollarni ro'yxatla, har biri
> uchun `id`, muammo, va tuzatilgan variantni ber.

**Yangi savollar so'rash uchun prompt namunasi:**

> Bu JSON — mavjud savollar banki. `analytics.weakSubtopics` bo'yicha eng zaif 3 ta
> mavzuga 10 tadan yangi savol yoz. Format aynan yuqoridagi savollar kabi bo'lsin
> (`id` yangi, `source: "ai-generated"`). Faqat JSON massiv qaytar.

AI qaytargan massivni Import / Export orqali yuklang yoki `questions.json` ga qo'shing.

### AI hisobotini qaytarib yuklash — `faq_ai_report_v1`

**Import / Export → "Apply an AI report"** oynasiga AI qaytargan JSON ni joylashtiring.
Bu format bitta faylda hammasini qamrab oladi:

```jsonc
{
  "type": "faq_ai_report_v1",
  "sourceLabel": "Mock exam 3",
  "generatedAt": "2026-09-01T...",

  // Qog'ozda/mock'da ishlagan savollaringiz — ilova xato bankiga qo'shadi
  "results": [
    { "qId": "DE05", "correct": false },
    { "qId": "TAX12", "correct": true },

    // Yangi savol ham keltirish mumkin (o'sha paytda qo'shiladi)
    { "qId": "PAPER-1", "correct": false, "newQuestion": {
        "t": "mcq", "q": "...", "opt": ["...","..."], "a": 1, "ex": "...",
        "section": "DE", "topic": "Concepts", "difficulty": "medium" } }
  ],

  // Bankdagi noto'g'ri savollarni tuzatish (kod tegmasdan, keyingi yuklashda qo'llanadi)
  "questionFixes": [
    { "qId": "INV15", "issue": "answer index wrong", "fix": { "a": 2, "ex": "Corrected: ..." } }
  ],

  // Yozma tahlil — Dashboard'da ko'rinadi
  "insight": {
    "summary": "Double-entry asoslari zaif.",
    "recommendations": ["DEAD CLIC ni takrorlang", "Control accounts bo'limini qayta ishlang"],
    "weakSections": ["DE", "RPP"]
  }
}
```

**Prompt namunasi (mock/PDF tahlili uchun):**

> Men ACCA FA mock imtihonini qog'ozda ishladim. Quyida savollar va mening javoblarim.
> Har birini baholab, `faq_ai_report_v1` formatida JSON qaytar: `results` (qId + correct),
> bank'da bo'lmagan savollar uchun `newQuestion`, va `insight` (zaif tomonlarim + reja).
> Bank qaysi qId larni bilishini bilish uchun avval "AI review JSON" faylini beraman.

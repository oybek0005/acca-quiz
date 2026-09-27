# ACCA Quiz App v3 — Reja (F3 FA + F7 FR)

> Tuzilgan: 2026-09-27. Manba: `quizapp-v2` source + `acca/` papka tahlili + brainstorm javoblari.

## 0. Qarorlar (brainstorm natijasi)

| Mavzu | Qaror |
|---|---|
| Ustuvorlik | **F3 birinchi** (imtihon okt oxiri/noyabr, sana hali yo'q), F7 parallel — imtihon **2026-12-10** |
| Kontent tili | Notelar: o'zbekcha + inglizcha atamalar. Savollar: inglizcha (imtihon formati), izohlar o'zbekcha |
| UI tili | O'zbekcha (standart) + EN almashtirgich |
| Interaktiv notelar | Inline mini-quiz, yashirin javobli worked example, T-account/provodka trenajyor + kalkulyatorlar, "o'qildi" progress + AI "tushuntir" |
| Tutorial | **Learning path** — reja sanalari bo'yicha: Note → mini-quiz → savollar → kit havolasi → keyingi dars |
| Foydalanuvchi | Faqat men (kontent repoda, Firebase = auth + progress sinxron) |
| AI | Gemini, kalit brauzerda (localStorage, sinxron qilinmaydi). Vazifalar: xatoni tushuntirish, zaif tomon tahlili + reja, savol generatsiya, note chat |
| Hajm | Har mavzuga **60+ savol** (~32 mavzu → ~2000 savol) |
| Manba | Kit/Study Text uslubida **original** savollar (raqamlar/ssenariy o'zgartirilgan) + kit raqamiga havola. Kit matni so'zma-so'z ko'chirilmaydi |
| Sifat | Ikki bosqich: generator → mustaqil tekshiruvchi (numeric javoblar Python bilan qayta hisoblanadi) |
| Ishlab chiqish | Kontent — multi-agent workflow; bosqichma-bosqich ko'rsatiladi |
| Tartib | Avval to'liq app, keyin kontent (quyida eslatma) |
| Firebase | Mavjud `acca-fa-quiz` loyihasi (progress saqlanadi) |
| Deploy | GitHub private repo → Netlify auto-deploy (bepul) |
| Dizayn | Iloji boricha yaxshilash (redesign) |

**Eslatma — tartib:** kontent formati (1.2) birinchi kuni qotiriladi, shunda kontent workflow'ini app bilan **parallel** yurgizish mumkin. Bu F3 30-sentabr testi va F7 29-sentabr darsiga ulgurish uchun muhim. Buni tasdiqlash kerak.

## 1. Arxitektura

### 1.1 Stack (0 xarajat)
- Next.js 16 static export (`output: 'export'`) → **Netlify** free (100GB/oy).
- **Firebase Spark**: Auth (email) + Firestore (progress). Hosting ishlatilmaydi.
- **Gemini API** — to'g'ridan-to'g'ri brauzerdan (`@google/genai`), foydalanuvchi kaliti, bepul tier. Server/funksiya yo'q.
- Qo'shiladi: `react-markdown` + `remark-gfm` + `remark-directive` (interaktiv bloklar), `katex` (formulalar, ixtiyoriy).

### 1.2 Kontent tuzilmasi (repoda)
```
content/
  f3/
    plan.json                  # dars sanalari, mavzu, kit raqamlari (xlsx'dan)
    notes/<lesson-id>.md       # interaktiv markdown
    questions/<topic>.json     # har mavzu savollari
  f7/ ... (xuddi shunday)
```
- Mavjud `src/data/questions.json` (446 ta F3) → `content/f3/questions/*.json` ga bo'linadi, `exam: "F3"` maydoni qo'shiladi.
- Savol sxemasi mavjud `types/index.ts` bilan mos. Qo'shiladi: `exam`, `lessonId`, `kitRef` (masalan `"FR Kit Q16-22"`), `verified: true`, `explanation_uz`.
- Interaktiv bloklar markdownda directive sifatida:
  - `:::quiz{ids="f7-int-001,f7-int-002"}` — inline mini-quiz
  - `:::example` … `:::solution` … `:::` — yashirin yechim, bosqichma-bosqich
  - `:::taccount{scenario="..."}` — T-account/provodka trenajyor
  - `:::calc{type="depreciation|goodwill|eps|lease|deferred-tax"}` — kalkulyator
- **MD yuklab olish**: har note sahifasida "⬇ .md" (xom fayl) va "⬇ barcha notelar (.zip)".

### 1.3 Firestore
- Hozir: `users/{uid}` bitta hujjat (1MB limit). 2000+ savol bilan urinishlar tarixi o'sadi, shuning uchun bo'linadi:
  - `users/{uid}` — sozlamalar, streak
  - `users/{uid}/srs/{exam}`, `users/{uid}/attempts/{yyyy-mm}`, `users/{uid}/notesProgress/{exam}`
- `firestore.rules`: faqat `request.auth.uid == uid`. CLI bilan deploy qilinadi (`acca-fa-quiz` akkauntiga kirish kerak).
- Gemini kaliti Firestore'ga **yozilmaydi**.

## 2. App ishlari (Faza A)

| # | Ish | Tafsilot |
|---|---|---|
| A0 | Tozalash va deploy | Commit qilinmagan o'zgarishlarni commit qilish; `oybek0005/acca-quiz` private repo; `netlify.toml` (build + `_headers` ga CSP ko'chirish, Gemini domenini ruxsat etish); VPS/nginx deploy o'chiriladi |
| A1 | Ko'p imtihon | F3/F7 almashtirgich (sidebar), barcha store/analitika/SRS `exam` bo'yicha filtrlanadi |
| A2 | i18n | `uz`/`en` lug'at fayllari (kutubxonasiz), barcha UI matnlari ko'chiriladi |
| A3 | Redesign | Yangi dizayn tizimi (ranglar, tipografiya, kartalar, mobil birinchi), dashboard qayta ishlanadi, dark mode sayqallanadi |
| A4 | Notes viewer | Markdown render, mundarija (TOC), qidiruv, "o'qildi" belgisi, MD/ZIP yuklab olish |
| A5 | Interaktiv bloklar | quiz / example-solution / taccount / calc komponentlari |
| A6 | Learning path | `plan.json` asosida vaqt chizig'i: bugungi dars, o'tganlar, keyingilar; har dars: note → mini-quiz → 20 savol → kit havolasi; tugatish % |
| A7 | Gemini | OmniRoute `ai-client.ts` o'rniga Gemini: (1) xatoni tushuntirish, (2) zaif tomon tahlili + imtihongacha reja, (3) savol generatsiya → "tekshirilmagan" tegi bilan custom bankka, (4) note chat (matnni belgilash → "tushuntir") |
| A8 | Imtihon sanalari | Sozlamalarda F3/F7 sanasi → countdown, AI reja shunga moslashadi |
| A9 | Firestore bo'linishi | 1.3 dagi sxema + migratsiya (eski `users/{uid}.state` → yangi) |
| A10 | QA | typecheck, lint, Playwright smoke (har view), mobil tekshiruv |

## 3. Kontent ishlari (Faza B) — workflow

Har mavzu uchun pipeline: **Note yozish** (Study Text asosida, o'zbekcha, interaktiv bloklar bilan) → **60+ savol** (mcq/multi/numeric/tf, 3 qiyinlik, kit uslubida original) → **tekshiruvchi agent** (mustaqil yechadi, numeric Python bilan) → nomuvofiqlar tuzatiladi yoki o'chiriladi → JSON/MD qo'shiladi. Har 3–4 mavzudan keyin ko'rib chiqish.

### F3 (birinchi)
1. **Consolidated SOFP** (30-sen test)
2. Consolidated SPL + Associates (2-okt)
3. Revenue (IFRS 15)
4. Events after reporting period (IAS 10)
5. Incomplete records
6. SOCIE va disclosure notes
7. Interpretation / ratios
8. Control account reconciliations
9. Adjustments to profit (errors)
10. Business documents (Ch 1–2)
11. CFS kengaytirish (10 → 60+)
12. Big questions (fs turi): Willow, Clerc, Carbon, Firework, Cracker va boshqalar — original raqamlar bilan
13. Mavjud 15 ta note → interaktiv formatga (mini-quiz/example bloklari qo'shiladi)
14. Notelardagi mavjud quizlarni import qilish (~137 savol: Hard 100Q EN, 25 Qiyin Test va h.k.), dublikatlarsiz

### F7 (reja sanalari bo'yicha)
1. Catch-up: IAS 16, IAS 23, IAS 40, IAS 20, IAS 36 (o'tgan darslar)
2. IAS 38 (29-sen) → IFRS 5 (1-okt) → Frameworks (3-okt)
3. Financial instruments (8–10 okt) → Foreign currency (13-okt) → Leases (15-okt) → Tax (17-okt)
4. Revenue (22–24 okt) → Other standards / Published FS (27-okt) → EPS (29-okt) → IAS 37/10 (31-okt)
5. Cash flows (3-noy) → Consolidation SOFP/SPL (7–10 noy) → Associates / disposals (14-noy) → Interpretation (17-noy)
6. Section C uslubidagi uzun savollar (fs turi) — mocklar uchun

Midlar: 6-okt, 20-okt, 5-noy. Har biridan oldin shu paytgacha o'tilgan mavzulardan "Mid mock" to'plami.

## 4. Ma'lum muammolar
- F3 rejadagi Kaplan kit raqamlari 25-26 kitdan farq qiladi. `kitRef` 25-26 kit indeksidan olinadi.
- F3 BPP Kit skaner (OCR kerak) — manba sifatida ishlatilmaydi.
- `BACKUP_SUMMARY.md` va `firebase.txt` da parollar ochiq turibdi: almashtirish tavsiya etiladi, repoga kirmaydi.
- `acca-fa-quiz` Firebase loyihasi hozirgi `firebase` CLI akkauntida ko'rinmaydi, rules deploy uchun o'sha akkauntga kirish kerak.

## 5. Ochiq savollar
- Kontent workflow'ini app bilan parallel boshlashga ruxsatmi? (tavsiya: ha)
- `acca-fa-quiz` qaysi Google akkauntda? (`firebase login:add` kerak)

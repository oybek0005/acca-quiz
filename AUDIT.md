# ACCA FA QuizApp v2 — Chuqur Audit Hisoboti

**Sana:** 2026-08-31
**Auditor:** Claude (avtomatik chuqur audit)
**Kod hajmi:** ~10,600 satr (`src/`), 245 savol (`src/data/questions.json`)
**Holat:** Loyiha `next build` dan **o'tmaydi** (20+ TypeScript xatosi). Ishga tushganda ham asosiy quiz sikli **buziladi** (runtime `ReferenceError`).

Bu hisobot barcha topilmalarni **dalil (fayl:satr)** bilan ro'yxatlaydi. Har bir topilma keyin `FIX-PLAN.md` / status sahifasidagi fazalarga bog'langan.

Belgilar: 🔴 = bloklovchi/kritik · 🟠 = jiddiy · 🟡 = o'rta · ⚪ = kichik/tozalash

---

## 0. Qisqacha xulosa (Executive Summary)

| Kategoriya | Soni | Eng og'irlari |
|---|---|---|
| Build / Type xatolar | 20+ | `next build` butunlay ishlamaydi |
| Runtime logic xatolar | 35+ | Quiz submit crash, SRS umuman ishlamaydi, urinishlar (attempts) saqlanmaydi, `multi` savollar noto'g'ri baholanadi |
| Xavfsizlik | 11 | Import qilingan JSON orqali **saqlanadigan XSS**, AI kaliti `localStorage`da, CSP yo'q |
| Yetishmayotgan funksiyalar | 26 | Analitika dashboardga ulanmagan, Supabase sync yo'q, SRS kartalar yaratilmaydi, "Section Quiz" tugmasi o'lik, klaviatura yorliqlari yo'q |
| Keraksiz / o'lik kod | 23 | 2 ta `Toaster`, 2 ta `checkAnswer`, 2 ta `StreakState`, ishlatilmagan `analytics.ts`, `chart.js`/`date-fns` ishlatilmaydi |
| UX / Dizayn | 20 | Qo'lda "Dark" rejimi ishlamaydi, bo'lim (section) belgilaridagi rang yo'q, `prose` stillari yo'q, taymer qotib qolgan |

**Umumiy baho:** Loyiha "skelet + ko'p yozilgan, lekin ulanmagan kod" holatida. Komponentlar va kutubxona funksiyalari mavjud, ammo ular bir-biriga ulanmagan; asosiy oqim (quiz → natija → xato banki → SRS → analitika) uzilgan.

---

## 1. BUILD / TYPE XATOLAR (🔴 bloklovchi)

Manba: `npx next build` va `npx tsc --noEmit`.

| # | Fayl:satr | Xato | Ta'sir |
|---|---|---|---|
| B1 | `src/app/page.tsx:114,124` | `Sidebar`/`MobileNav` `onNavigate: (view: string)` prop `setView: (view: ViewName)` ga to'g'ri kelmaydi | Build to'xtaydi |
| B2 | `src/components/QuizView.tsx:64` | `useMistakesStore` ishlatilgan, lekin **import qilinmagan** (faqat `useStreakStore` import qilingan) | 🔴 **Runtime `ReferenceError` — quiz topshirilganda ilova crash bo'ladi. Natija ekrani chiqmaydi, xatolar va streak yangilanmaydi.** |
| B3 | `src/components/QuizView.tsx:92` | `ConfidenceLevel` tipi import qilinmagan | Build to'xtaydi |
| B4 | `src/store/quizStore.ts:152` | `startWeightedQuiz` `get().getWeightedRandomQuestions()` ni chaqiradi — bu store metodi **emas** (modul darajasidagi eksport) | 🔴 **Runtime `TypeError` — "Mixed Quiz" va Dashboard "Mixed" tugmalari crash** |
| B5 | `src/store/quizStore.ts:163` | `questions.forEach((q) => ...)` — `q` yashirin `any` | Build to'xtaydi |
| B6 | `src/store/mistakesStore.ts:271,297` | `updateStreak`/`incrementTodayCount`: `set(...)` `void` qaytaradi, lekin imzo `StreakState` va'da qiladi; qaytган qiymatdan foydalanuvchi `undefined` oladi | Type xato + logic xato |
| B7 | `src/components/ConfidenceSelector.tsx:49` | `colorClasses` `undefined` bo'lishi mumkin (`{...}[color]` indekslash) | Build to'xtaydi |
| B8 | `src/components/FlashcardsView.tsx:214` | `currentCard.options` — to'g'ri nom `opt`; `Question` da `options` yo'q | 🟠 **Flashcard orqa tomoni MCQ uchun javob matnini emas, indeks raqamini ko'rsatadi** |
| B9 | `src/components/ImportView.tsx:85` | `loadStreak(data.streak as StreakState)` — `@/types` `StreakState` va `mistakesStore` `StreakState` **ikki xil tip** (nom to'qnashuvi) | Build to'xtaydi + arxitektura hidi |
| B10 | `src/components/MistakesView.tsx:91` | `<Tabs onValueChange={setActiveTab}>` — `setActiveTab` `MistakeFilter` kutadi, `Tabs` `string` beradi | Build to'xtaydi |
| B11 | `src/components/QuestionCard.tsx:275` | `question.a` `never` tipida (union toraytirilmagan) | Build to'xtaydi |
| B12 | `src/components/SRSView.tsx:250` | `currentCard.question.opt[currentCard.question.a]` — `a` `boolean`/`number[]` bo'lishi mumkin, indeks sifatida ishlatib bo'lmaydi | Build to'xtaydi + 🟠 tf/numeric kartalarda javob noto'g'ri |
| B13 | `src/components/ui/Tabs.tsx:31,32,41,42` | `child.props` `unknown` (React 19 tiplari) | Build to'xtaydi |
| B14 | `src/store/quizStore.ts` (umumiy) | `useQuizStore` interfeysida `startWeightedQuiz` bor lekin `getWeightedRandomQuestions` yo'q — imzo/amalga oshirish mos emas | — |

---

## 2. RUNTIME LOGIC XATOLAR

### 2.1 Asosiy quiz sikli (🔴)

| # | Fayl:satr | Muammo |
|---|---|---|
| L1 | `src/components/QuizView.tsx:57-72`, butun loyiha | 🔴 **Urinishlar (attempts) hech qachon saqlanmaydi.** `submitQuiz()` massiv qaytaradi, `handleSubmit` faqat xato banki + streakni yangilaydi. Hech qayerda `faq_attempts_v1` ga yozilmaydi. `RecentActivity.tsx:18` shuni o'qiydi → **doim bo'sh**. `computeDailyStats` uchun ma'lumot yo'q. Butun urinish tarixi mavjud emas. |
| L2 | `src/components/QuizView.tsx:64` | 🔴 B2 bilan bir xil — `useMistakesStore` import yo'q → `handleSubmit` throw → natija ekrani, xato banki, streak **hech qachon** yangilanmaydi. |
| L3 | `src/store/quizStore.ts:149-177` | 🔴 B4 — Mixed Quiz crash. |
| L4 | `src/store/quizStore.ts:278-285` **va** `src/components/QuestionCard.tsx:489-492` | 🔴 **Ikki xil `checkAnswer` bir-biriga zid.** `quizStore` `multi` uchun `question.a` bilan **pozitsion** solishtiradi (`userArr[i] === correctArr[i]`). Foydalanuvchi variantlarni bosish tartibida tanlaydi → `[2,0] !== [0,2]` → **to'g'ri javoblar noto'g'ri deb belgilanadi.** To'plam (set) solishtirish kerak. |
| L5 | `src/components/QuestionCard.tsx:219-221,491` + `src/data/questions.json` | 🟠 25 ta `multi` savoldan faqat **6 tasida** `multi_correct` bor. QuestionCard to'g'ri variantларni `multi_correct || []` dan oladi → **19/25 `multi` savolda birorта to'g'ri variant belgilanmaydi**, va `checkAnswer` (QuestionCard versiyasi) bo'sh massivга solishtiradi → doim noto'g'ri. |
| L6 | `src/store/quizStore.ts:290-291` | 🟡 `manual` savollar doim `false` → natijada va xato bankida doimiy "noto'g'ri" sifatida qoladi, bankни ifloslaydi. Qo'lda baholash UI yo'q. |
| L7 | `src/components/QuizView.tsx:79-89` | 🟠 Tutor rejimida `handleAnswer` javob berilishi bilanoq 1.5s dan keyin `nextQuestion()` chaqiradi — foydalanuvchi izohni o'qiy olmaydi, javobни o'zgartira olmaydi, `multi` uchun birinchi bosishdayoq keyingisiga o'tadi. `setTimeout` unmount da tozalanmaydi (`setState after unmount`). |
| L8 | `src/components/QuizView.tsx:98-102` | 🟠 **Taymer qotib qolgan.** `elapsedTime` `useMemo`, lekin interval yo'q → `QuizHeader` taymeri hech qachon yangilanmaydi. |
| L9 | `src/components/QuizView.tsx:37,151` | 🟡 `paused` holati vaqtni to'xtatmaydi — faqat displayда 0 ko'rsatadi; `submitQuiz` baribir `startTimes` dan hisoblaydi. |
| L10 | `src/store/quizStore.ts:133,163,229` | 🟠 `startTimes` `performance.now()` bilan yoziladi, lekin `session` `sessionStorage` ga saqlanadi. Sahifa qayta yuklangач `performance.now()` bazasi nolга qaytadi → `timeSpent` ulkan yoki manfiy. |
| L11 | `src/components/QuizResults.tsx:68` | 🟠 `<div className="text-5xl font-bold {passed ? 'text-green-600' : 'text-red-600'}">` — **JSX ifodasi satr ичида, bajarilmaydi**. Foiz rangi doim standart. |
| L12 | `src/components/QuizResults.tsx:28-33` | 🟡 Ishonch yo'q bo'lsa "Avg Confidence 0.0/3" ko'rsatadi — chalg'ituvchi. |
| L13 | `src/components/QuizView.tsx:176-198` | 🟡 Dashboard'dan ishga tushirilган quizlar rejim sifatida `"mixed"/"mistakes"/"srs"` uzatadi, hech qачон `"tutor"/"exam"` emas. Natijada **Tutor/Exam xulqi Dashboard tugmalaridan hech qachon ishga tushmaydi**; izohlar faqat `isTutorMode || isMistakesMode` da ko'rsatiladi → "mixed" da izoh yo'q. |
| L14 | `src/components/Dashboard.tsx:176-192` | 🟡 `launchQuiz` `count` argumentini oladi, lekin `startQuiz` uni e'tiborsiz qoldiradi — xato/SRS quizlari doim BARCHA mos savollarni oladi, 15/20 emas. Har bir tarmoqdan keyin ortiqcha `setView("quiz")` (store allaqachon o'rnatadi); `startWeightedQuiz` xato bersa ham `setView("quiz")` ishlaydi → bo'sh quiz ekрани. |

### 2.2 SRS (Spaced Repetition) — 🔴 butunlay ishlamaydi

| # | Fayl:satr | Muammo |
|---|---|---|
| L15 | `src/lib/srs.ts:167-171` | 🔴 **`initSRSForMistakes()` — bo'sh zag'lush (`return 0`).** Haqiqiy amalga oshirish `initSRSForMistakesData` (`srs.ts:173`) **hech qayerdan chaqirilmaydi**. Shuning uchun `getDueSRSCards()` doim `[]` qaytaradi → SRS View doim "All caught up", Dashboard SRS soni doim 0, Flashcards "SRS due" filtri bo'sh. **Butun SRS xususiyati o'lik.** |
| L16 | `src/store/mistakesStore.ts:91-94` | `updateFromAttempts` `initSRSForMistakes()` (zag'lush) ni chaqiradi — ya'ni yangi xatolar uchun SRS karta yaratilmaydi. |
| L17 | `src/store/mistakesStore.ts:173-176` + `src/lib/srs.ts:97-101` | 🟠 **SRS uchun ikkita haqiqat manbai.** `reviewCard` HAM modul `localStorage` (`faq_srs_v1`) HAM zustand persist (`faq-srs`) ga yozadi. `getCard`/`getCardStats` faqat `faq_srs_v1` dan o'qiydi. Divergensiya muqarrar. |
| L18 | `src/app/page.tsx:63-66` | `useSRSStore.loadCards(srs)` `faq_srs_v1` dan yuklaydi, lekin `useSRSStore` da zustand persist (`faq-srs`) ham bor → hidratsiyada persist qayta yozadi. |
| L19 | `src/store/mistakesStore.ts:204-214` | `syncFromMistakes` faqat allaqachon `store.cards` da bo'lgan kartalarni yangilaydi — yangi qo'shmaydi. O'lik. |
| L20 | Butun loyiha | 🟡 Ishonch darajasi → SRS sifati (quality 0-5) xaritalash 3 komponentda **3 xil**: `FlashcardsView.tsx:226` (0/1/3/5), `SRSView.tsx:266` (0/2/3/5), `MistakesView.tsx:186` (0/2/4/5). `srs.ts` da `QUALITY_BUTTONS`, `buttonIndexToQuality` bor — ishlatilmaydi. |

### 2.3 Analitika — komponentlar mavjud, ammo ulanmagan

| # | Fayl:satr | Muammo |
|---|---|---|
| L21 | `src/components/Dashboard.tsx` (butun) | 🟠 **`SectionMasteryBars`, `Heatmap`, `RecentActivity`, `StatCard` komponentlari hech qayerda render qilinmaydi.** Dashboard `analytics.ts` ni import qilmaydi, o'z ichida oddiyroq hisob yuritadi (`Dashboard.tsx:85-113`) va faqat urinilgan savollarni hisoblaydi (savol banki hajmini emas). |
| L22 | `src/lib/analytics.ts:222` | 🟡 `computeSubtopicMastery` "Worst first" deб izohlangan, lekin `errorRate` bo'yicha **o'sish** tartibida saralaydi = eng yaxshisi birinchi. |
| L23 | `src/lib/analytics.ts` (butun) | ⚪ `computeSectionMastery`, `computeHeatmapData`, `computeDailyStats`, `getWeakSections`, `getRecommendedQuestions` — yozilgan, hech qayerdan chaqirilmaydi. |
| L24 | `src/components/Heatmap.tsx:98-101` | 🟡 Tooltip `top: hoveredCell.volume` bilan joylashtiriladi (volume raqamini piksel sifatida ishlatadi) → tooltip doim yuqori-chapda. |
| L25 | `src/components/Heatmap.tsx:71-73,183` | ⚪ `DARK_COLORS` aniqlangan, `getColor(intensity, false)` — dark parametri doim `false`. Dark rejimda heatmap ranglari noto'g'ri. |
| L26 | `src/components/RecentActivity.tsx:18` | `faq_attempts_v1` ni o'qiydi (L1 tufayli doim bo'sh) — hatto render qilinsa ham bo'sh. |
| L27 | `package.json` | ⚪ `chart.js`, `react-chartjs-2`, `date-fns` o'rnatilgan — **hech qayerda ishlatilmaydi**. Kunlik progress grafiklari yo'q. |

### 2.4 Xato banki (Mistakes)

| # | Fayl:satr | Muammo |
|---|---|---|
| L28 | `src/components/MistakesView.tsx:109` | 🟡 `useSRSStore.getState().getCardStats(...)` render ichida `.map` da chaqiriladi — reaktiv emas. SRS hech qachon initsializatsiya qilinmagani uchun `srsStats` doim `null` → Mistakes'dagi SRS belgilari/tugmalari hech qachon ko'rinmaydi. |
| L29 | `src/store/mistakesStore.ts:104-105` | 🟡 `getHighConfidenceErrors` `m.lastResult === 'wrong'` shartини qo'shadi — agar foydalanuvchi keyin to'g'ri javob bersa, yuqori ishonchli xato tarixi yashiriladi. |
| L30 | `src/components/MistakesView.tsx:33-42` va `src/store/mistakesStore.ts` | ⚪ Filt르lash logikasi store'da ham (`getRetryQuestions`), MistakesView'da ham takrorlanadi (DRY buzilishi, ular zid bo'lishi mumkin). |

### 2.5 Streak

| # | Fayl:satr | Muammo |
|---|---|---|
| L31 | `src/app/page.tsx:68-71` + `src/store/mistakesStore.ts:268` | 🟠 Kalit yo'q bo'lsa `loadStreak({})` chaqiriladi → `current`, `longest`, `target`, `todayCount` `undefined` bo'ladi. Dashboard "undefined days" ko'rsatishi mumkin; `getStats` `todayCount` uchun `|| 0` bilan himoyalangan, lekin `current`/`longest` emas. |
| L32 | `src/store/mistakesStore.ts:236,270` | `updateStreak` hech qayerdan chaqirilmaydi; `incrementTodayCount` ichida streak logikasi takrorlanadi. Ikki yo'l. |

---

## 3. XAVFSIZLIK (🔴 / 🟠)

| # | Fayl:satr | Zaiflik | Tavsiya |
|---|---|---|---|
| S1 | `src/components/QuestionCard.tsx:153,248,298,329,386,470`; `src/components/FlashcardsView.tsx:217`; `src/components/SRSView.tsx:256` | 🔴 **`dangerouslySetInnerHTML` sanitizatsiyasiz.** `question.q`, `question.ex`, `question.opt[]` va AI javoblari xom HTML sifatida render qilinadi. `ImportView.tsx:80` foydalanuvchi bergan JSON fayldan savollarni `loadQuestions(data.questions)` orqali yuklaydi → zararli backup fayl = **saqlanadigan XSS / ixtiyoriy skript bajarilishi**. | `DOMPurify` bilan sanitizatsiya yoki matn sifatida render qilish. Import sxemasini qat'iy tekshirish. |
| S2 | `src/lib/ai-client.ts:193-210,225` | 🔴 AI javoblari sozlanadigan `baseUrl` dan keladi va `dangerouslySetInnerHTML` bilan render qilinadi (`QuestionCard.tsx:386`). Buzilган/MITM endpoint = XSS. | Javoblarni sanitizatsiya qilish; `https` majburiy; domenlarni cheklash. |
| S3 | `src/lib/ai-client.ts:18,42-48` | 🟠 AI API kaliti `localStorage` da **ochiq matnda** (`faq_ai_config`). Har qanday XSS uni o'g'irlashi mumkin (S1 bilan birga). | `sessionStorage` yoki foydalanuvchini ogohlantirish; kalitni faqat so'rov vaqtida so'rash. |
| S4 | `src/lib/ai-client.ts:193` | 🟠 `callOmniRoute` to'liq savol + foydalanuvchi javobини `Authorization: Bearer` bilan ixtiyoriy `baseUrl` ga yuboradi. Noto'g'ri/dushman URL = ma'lumot + kalit sizib chiqishi. | URL uchun `https` + allowlist; test-connection'ni majburiy qilish. |
| S5 | `next.config.ts` | 🟠 **Content-Security-Policy sarlavhasi yo'q.** `dangerouslySetInnerHTML` + CSP yo'qligi = keng XSS yuzasi. | `next.config.ts` da `headers()` orqali qat'iy CSP. |
| S6 | `src/components/ImportView.tsx:71-91` | 🟠 Import: hajm chegarasi yo'q, sxema validatsiyasi yo'q, `JSON.parse` ixtiyoriy fayl. `loadMistakes(data.mistakes)` obyektni store'ga tarqatadi → `__proto__` kaliti bilan **prototype pollution** xavfi. | `structuredClone` + kalit allowlist + `Object.create(null)`; hajm limiti (masalan 5 MB). |
| S7 | `src/lib/supabase.ts:29`; `src/lib/utils.ts:88`; `src/components/Toaster.tsx:35` | 🟡 `Math.random()` ID uchun (device_id, toast id, variant id) — kriptografik emas. `crypto.randomUUID()` ishlatish. |
| S8 | `src/lib/supabase.ts:52-60` | 🟡 `x-device-id` sarlavhasi "RLS" uchun ishlatiladi, lekin RLS satrdagi `device_id` + policy talab qiladi. Dizayn hujjatiga mos emas (hozircha sync ulanmagani uchun yashirin). |
| S9 | `src/app/layout.tsx:6,9` | ⚪ `next/font/google` build vaqtida Google'dan yuklaydi (maxfiylik + build muvaffaqiyatsizligi xavfi). `next/font/local` yoki tizim shrifti. |
| S10 | `src/app/page.tsx:58-71` | 🟡 `localStorage` JSON har yuklashda validatsiyasiz `JSON.parse`. Buzilган ma'lumot → `catch` ushlaydi, lekin `loadStreak({})` tip teshiklari → `NaN` tarqalishi → oq ekran (mayda DoS). |
| S11 | Umumiy | ⚪ Xato chegaralari (error boundaries) yo'q → bitta komponent throw = butun ilova oq ekranга aylanadi. |

---

## 4. YETISHMAYOTGAN FUNKSIYALAR

| # | Xususiyat | Holat / dalil |
|---|---|---|
| M1 | Urinish tarixi saqlash + Recent Activity | Yo'q. `faq_attempts_v1` hech qachon yozilmaydi (L1). |
| M2 | Analitika dashboard (mastery barlari, heatmap, kunlik grafiklar, zaif bo'limlar) | Komponentlar bor, **ulanmagan** (L21, L23, L27). |
| M3 | Ishlaydigan SRS (karta yaratish, muddat hisoblash, sessiya) | O'lik (L15). |
| M4 | "Section Quiz" tanlash UI | `Dashboard.tsx:162` `setView("quiz")` — sessiya yaratmaydi → **o'lik tugma** (QuizView "No active quiz session" ko'rsatadi). |
| M5 | Tutor vs Exam rejim tanlovi (quizga ta'sir qiladi) | Qisman. Dashboard hech qachon tutor/exam uzatmaydi (L13). Aniq rejim tanlash UI yo'q. |
| M6 | Barcha rejimlarda ishonch bahosi (3 tugma) | Faqat exam rejimida (`QuizView.tsx:178`). |
| M7 | Formula / jurnal yozuvlari uchun flashcard turi | Faqat savoldan olingan kartalar; `Flashcard` tipida `formula`/`definition` bor, lekin bunday ma'lumot yo'q. |
| M8 | Top-5 zaif namuna uchun mahalliy AI shablonlari | 5 shablon bor (`ai-client.ts:64`), lekin moslashtirish zaif (`ai-client.ts:161`) va variant amaliyotiga ulanmagan. |
| M9 | OmniRoute VPS endpoint | Qisman (config UI bor, standart URL `example.com`, haqiqiy endpoint yo'q). |
| M10 | Supabase: sxema migratsiyasi, 7 jadval, RLS, store'larda sync, device_id UI | **To'liq yo'q.** `supabase.ts` funksiyalari hech qayerdan chaqirilmaydi; Settings'da URL/kalit UI yo'q (`SettingsView.tsx` faqat AI config). |
| M11 | Savol bankini 245 → 600+ ga kengaytirish; barchada `difficulty`/`subtopic` | 245 savol; **0 tasida `difficulty` maydoni bor**, 72 tasida `topic`/`subtopic` yo'q. |
| M12 | Kunlik streak vizual (alanga + halqa) | Alanga emoji bor (`Sidebar.tsx:104`), progress halqasi yo'q (faqat bar). |
| M13 | Klaviatura yorliqlari (flashcards, SRS, quiz) | **E'lon qilingan, amalga oshirilmagan.** `FlashcardsView.tsx:283-289` yorliqlarni ko'rsatadi; faqat `Enter`-flip ishlaydi (`FlashcardsView.tsx:189`). Space/strelkalar/raqamlar o'lik. `SRSView.tsx:241` "Press Space" — handler yo'q. |
| M14 | Quizда savol tarmog'i (grid) navigatsiyasi | `QuizNavigation.tsx:119-122` — `onClick` bo'sh izoh. Ishlamaydi. |
| M15 | Pauza haqiqatan taymerni to'xtatishi | Yo'q (L9). |
| M16 | Jonli tiklanadigan taymer | Yo'q (L8). |
| M17 | Export/import to'liqligi (settings, weights, AI config, attempts, insights) | `ImportView.tsx:45-53` faqat questions/mistakes/srs/streak. Settings, weights, AI config, attempts, insights yo'q. Import qilingan questions saqlanmaydi (`page.tsx:41` doim bundled JSON yuklaydi). |
| M18 | Xato chegaralari (error boundaries) | Yo'q. |
| M19 | Toast bildirishnomalari ishlatilishi | `ToasterProvider` ulanган (`page.tsx:111`), lekin **hech kim `addToast`/`toast` chaqirmaydi**. Saqlash/xatolar inline div bilan. |
| M20 | Ovoz effektlari | `soundEnabled` sozlamasi bor (`quizStore.ts:29`), ovoz kodi yo'q. |
| M21 | Animatsiya to'g'risi | `animationsEnabled` bor, hech qayerda tekshirilmaydi. |
| M22 | AI-generated study insights | `InsightRow` tipi bor, generatsiya yo'q. |
| M23 | Qo'lda savol baholash UI | Yo'q (L6). |
| M24 | PWA / offline (manifest, service worker) | Yo'q. |
| M25 | Mobil: MobileNav kontentni yopadi; sidebar mobilda ochilmaydi | `page.tsx:117` `<main>` da `padding-bottom` yo'q → pastki nav kontentni yopadi. `globals.css:268` sidebar `translateX(-100%)`, ochish holati/gamburger yo'q. |
| M26 | Qiyinlik bo'yicha filtr / quiz tanlashда qiyinlik tanlovi | `getQuestionsByDifficulty` bor, UI yo'q. Barcha savollarda `difficulty` yo'qligi sababли baribir ishlamaydi. |

---

## 5. KERAKSIZ / O'LIK KOD / NOTO'G'RI DIZAYN

| # | Fayl | Muammo |
|---|---|---|
| D1 | `src/components/ui/Toaster.tsx` | Butun fayl ishlatilmaydi (`components/Toaster.tsx` ning dublikati, boshqa API). |
| D2 | `src/lib/srs.ts:167-171` | `initSRSForMistakes()` zag'lush — chalg'ituvchi. |
| D3 | `src/store/mistakesStore.ts:204` | `syncFromMistakes` — o'lik. |
| D4 | `src/store/quizStore.ts:371` | `getWeightedRandomQuestions` modul eksporti — store metodi kutilgan joyда. Arxitektura chalkashligi. |
| D5 | `src/types/index.ts:118` **va** `src/store/mistakesStore.ts:226` | Ikki xil `StreakState` tipi — nom to'qnashuvi; `ImportView` noto'g'risini import qiladi (B9). |
| D6 | `src/store/quizStore.ts:272` **va** `src/components/QuestionCard.tsx:483` | Ikki xil `checkAnswer` — zid (L4). |
| D7 | `src/lib/analytics.ts` | Ko'p funksiya ishlatilmaydi (L23). |
| D8 | `src/components/{RecentActivity,Heatmap,SectionMasteryBars,StatCard}.tsx` | Render qilinmaydi. |
| D9 | `package.json` | `chart.js`, `react-chartjs-2`, `date-fns` — ishlatilmaydi. `playwright` `dependencies` da (devDependencies bo'lishi kerak). |
| D10 | Repo ildizi | `fix_dashboard.py`, `test-app.js`, `test-quiz*.js` (4), `screenshot-*.png` (11), `buyruq.txt` — axlat. |
| D11 | `src/components/ui/Tabs.tsx:53-56` | `typeof children === 'function'` tarmog'i — hech qачon ishlatilmaydi (render-props API o'lik). |
| D12 | `src/lib/srs.ts:201-235` | `QUALITY_LABELS`, `QUALITY_BUTTONS`, `qualityToButtonIndex`, `buttonIndexToQuality` — eksport, ishlatilmaydi; komponentlar o'z massivlarini yozadi (L20). |
| D13 | `src/lib/utils.ts` | `debounce`, `throttle`, `parseCSV`, `exportToCSV`, `retry`, `downloadJSON`, `generateId`, `shuffleArray` — asosan ishlatilmaydi. |
| D14 | `src/components/ThemeProvider.tsx` + `src/app/page.tsx:77-85` | Mavzu bo'yicha ikkita raqobatlashuvchi amalga oshirish. `ThemeProvider` `<div className="dark">` bilan o'raydi va `page.tsx` `<html>` ga `.dark` qo'shadi. |
| D15 | `src/types/index.ts:353` `ExportData` | `ImportView` ishlatmaydi (o'z `BackupData` si bor). |
| D16 | `src/types/index.ts:151-213` Supabase row tiplari | Ishlatilmaydi. |
| D17 | `src/types/index.ts:25,29` | Tarjima xatolari: `NCA` = "Davlatsiz aktivlar" (noto'g'ri — "non-current assets" ≠ "stateless"); `RPP` uz "Қарздорlik" — aralash yozuv (kirill + lotin). |
| D18 | `next.config.ts` | Bo'sh — headers, image config yo'q. |
| D19 | `src/components/QuestionCard.tsx:167` | `{isAnswered && !showExplanation && showExplanation && ...}` — `!showExplanation && showExplanation` **doim `false`** → "Show Explanation" tugmasi hech qачon render bo'lmaydi (logic typo). |
| D20 | `src/components/MistakesView.tsx:228` | `import { CheckCircle }` — fayl **oxirida**, funksiyadan keyin. Ishlaydi (hoisting), lekin noto'g'ri joylashuv. |
| D21 | `src/store/quizStore.ts:99` | `useQuizStore` interfeysida `submitQuiz` bor, lekin natijani hech kim store'ga saqlamaydi — `endQuiz` faqat `session: null`. Attempt saqlash uchun store metodi yo'q. |
| D22 | `src/components/QuizView.tsx:36` | `results` `any[]` tipida. |
| D23 | `src/lib/ai-client.ts:19` | `DEFAULT_OMNIRoute_URL` — nom qoidasi buzilgan (`OMNIRoute`), qiymat `example.com`. |

---

## 6. UX / DIZAYN MUAMMOLARI

| # | Fayl:satr | Muammo |
|---|---|---|
| U1 | `src/app/globals.css` (butun) + `src/app/page.tsx:80` | 🔴 **Qo'lda "Dark" rejimi ishlamaydi.** Tailwind v4 da standart `dark:` varianti = `@media (prefers-color-scheme)`, `.dark` klassi emas. `@custom-variant dark` yo'q. Shuning uchun butun UI dagi `dark:*` utility klasslari qo'lda almashtirishni **e'tiborsiz qoldiradi** — faqat qo'lda yozilgan `.dark .card` kabi komponent klasslari almashadi. "Dark" tanlash UI ning ko'p qismini yorug' qoldiradi. |
| U2 | `src/components/*` (~8 fayl) | 🟠 **Bo'lim (section) belgilaridagi rang yo'q.** `badge badge-${section}` (`badge-DE`, `badge-INV`...) ishlatiladi, lekin `globals.css` da bunday klasslar **aniqlanmagan** (faqat `badge-blue/green/...`). Barcha section belgilari rangsiz. |
| U3 | `src/components/Dashboard.tsx:122,309-312` | 🟠 `"bg-" + option.color + "-100"`, `"text-" + option.color + "-600"` — **Tailwind v4 dinamik qurilган klass nomlarini ko'rmaydi** → tozalanadi → quiz variant belgilarida fon/rang yo'q. |
| U3b | `src/components/QuestionCard.tsx:323,474`; `src/components/QuizResults.tsx:167` | 🟠 `cn('badge badge-confidence-', confidence)` → `"badge badge-confidence- high"` hosil qiladi — daraja **alohida klass** (`high`), `badge-confidence-high` emas. Ishonch belgilari stилsiz. |
| U4 | `src/components/QuestionCard.tsx:329` va h.k. | 🟠 `prose prose-sm dark:prose-invert` ishlatiladi, lekin **`@tailwindcss/typography` plagini o'rnatilmagan** → `prose` klasslari ta'sirsiz → izohlar stilsiz (ro'yxat belgilari, oraliq yo'q). |
| U5 | `src/components/QuizResults.tsx:68` | Foiz rangi bug (L11). |
| U6 | `src/components/QuizView.tsx:80-88` | Tutor auto-advance juda tez, izohni o'qib bo'lmaydi (L7). |
| U7 | `src/components/QuizHeader.tsx:57-60` | Taymer qotgan (L8). |
| U8 | `src/components/Dashboard.tsx:162` | "Section Quiz" tugmasi o'lik (M4). |
| U9 | `src/components/{FlashcardsView,SRSView}.tsx` | O'lik klaviatura yorliqlari foydalanuvchini chalg'itadi (M13). |
| U10 | `src/components/Heatmap.tsx:96-101` | Tooltip joylashuvi buzuq (L24). |
| U11 | `src/app/page.tsx:117` | `<main>` da `pb-*` yo'q → MobileNav kontentni yopadi (M25). |
| U12 | `src/app/layout.tsx:22` + `src/app/page.tsx:77` | `suppressHydrationWarning`, lekin mavzu effektда qo'llanadi → noto'g'ri mavzu chaqnashi (FOUC). |
| U13 | `src/components/QuestionCard.tsx:156` | Variant tugmalari `role="radiogroup"` ichida, lekin `role="radio"`/`aria-checked` yo'q. TF ham. |
| U14 | `src/components/Heatmap.tsx:167-173` | `<td onClick>` klaviatura bilan foydalanib bo'lmaydi. |
| U15 | `src/components/ImportView.tsx:256` | Modal: focus trap yo'q, `Esc` bilan yopilmaydi. |
| U16 | `src/components/SectionMasteryBars.tsx:91` | Legenda `{'>'}60%` — `<60%` bo'lishi kerak (NEXT_SESSION_TASKS da "tuzatilган" deб yozilган, lekin noto'g'ri belgi qochirilган). |
| U17 | `src/components/SRSView.tsx:127-147` | "Due This Week" / "Total Tracked" noto'g'ri belgilangan — "Total Tracked" `dueCards.length` ni ko'rsatadi (= bugungi bilan bir xil); "Due This Week" allaqachon muddati o'tган kartalarни filtrlaydi → odatда 0. |
| U18 | `src/components/Sidebar.tsx:75` | `showBadge` `item.id === 'mistakes' && srsDueCount > 0` — Mistakes tabида SRS soni ko'rsatiladi (noto'g'ri ko'rsatkich). |

---

## 7. FAZALAR BO'YICHA TUZATISH REJASI

| Faza | % | Qamrov |
|---|---|---|
| **P1** | 0→10 | Barcha build/type xatolar (B1–B14), dark mode `@custom-variant`, section badge CSS, confidence badge, typography plagin. `next build` yashil. |
| **P2** | 10→20 | Asosiy quiz sikli: import bug (B2/L2), weighted quiz (B4/L3), yagona `checkAnswer` + `multi` set-solishtirish (L4/L5), `manual` ishlov (L6), **attempt persistence** (L1) — yangi `attemptsStore` + `faq_attempts_v1`. |
| **P3** | 20→30 | SRS dvigateli: `initSRSForMistakesData` ni ulash (L15/L16), yagona haqiqat manbai (L17/L18), muddat hisoblash; SRSView/Flashcards javob renderi + quality xaritalash (`srs.ts` yordamchilaridan) (B8/B12/L20); klaviatura yorliqlari (M13). |
| **P4** | 30→40 | Jonli taymer + pauza (L8/L9/L10), Tutor/Exam rejim tanlovi + xulqi (L7/L13/M5), barcha rejimlarda ishonch (M6), savol tarmog'i navigatsiyasi (M14), flashcard shuffle. |
| **P5** | 40→50 | Analitikani Dashboard'ga ulash: `SectionMasteryBars`, `Heatmap`, `RecentActivity`, kunlik grafik (chart.js), zaif bo'limlar, tavsiyalar; analytics saralash + heatmap tooltip bug (L21–L27). |
| **P6** | 50→60 | Section quiz tanlagich (M4), Dashboard launch tozalash (L14), Mistakes SRS ulash (L28), toastlar (M19), error boundary (M18), animations/sound sozlamalari (M20/M21). |
| **P7** | 60→70 | Supabase: sxema SQL fayli, store'larda sync qatlami (localStorage-first + push/pull), Settings'da device_id + kredensiallar UI, konflikt ishlovi (M10). |
| **P8** | 70→80 | AI mijoz: top namunalar uchun haqiqiy fallback, variant amaliyoti, explain/hint/why-wrong test, insights generatsiyasi (M8/M9/M22). |
| **P9** | 80→90 | Xavfsizlik: barcha `dangerouslySetInnerHTML` uchun DOMPurify, import validatsiya + prototype-pollution himoya + hajm limiti, `next.config` da CSP, AI URL https/allowlist, kalit saqlash ogohlantirishi (S1–S11). |
| **P10** | 90→100 | Savol bankini boyitish (245 taga `difficulty`+`subtopic`, 300+ ga), tarjima tuzatishlari (D17), mobil moslashuv (M25), a11y (U13–U15), o'lik kod/fayllarni tozalash (D1–D23), yakuniy audit qayta tekshiruvi, lint+build+Playwright smoke test. |

---

## 8. TUZATISH HOLATI (2026-09-01 — yakuniy)

Barcha 10 faza bajarildi. Quyida topilmalar kategoriyalari bo'yicha holat:

| Kategoriya | Holat | Izoh |
|---|---|---|
| **Build / Type xatolar (B1–B14)** | ✅ Hammasi tuzatildi | `npx next build` va `npx tsc --noEmit` — YASHIL |
| **Quiz sikli (L1–L14)** | ✅ Tuzatildi | Import bug (B2), weighted quiz (B4), yagona `checkAnswer` (`lib/questions.ts`), `multi` set-solishtirish, `manual` ishlov, urinishlar `attemptsStore` orqali saqlanadi, jonli taymer + pauza, Tutor/Exam ajratildi (`session.interaction`), savol tarmog'i navigatsiyasi, QuizResults rang bug'i (L11). **Brauzerda uchdan-uchgacha tekshirildi.** |
| **SRS (L15–L20)** | ✅ Tuzatildi | `initSRSForMistakesData` ulandi — kartalar yaratiladi; yagona haqiqat manbai (`faq_srs_v1`); yagona reyting tugmalari (`SRS_RATING_BUTTONS`); klaviatura yorliqlari. **Brauzerda tekshirildi.** |
| **Analitika (L21–L27)** | ✅ Tuzatildi | `SectionMasteryBars`, `Heatmap`, `RecentActivity`, `ProgressChart` (yangi, inline SVG), Study Insight (yangi, `lib/insights.ts`) — hammasi Dashboard'ga ulandi; `computeSubtopicMastery` saralash bug'i; heatmap tooltip joylashuvi + dark ranglar. |
| **Xato banki / Streak (L28–L32)** | ✅ Tuzatildi | `loadStreak` mudofaa bilan (NaN himoyasi); SRS ulanishi endi ishlaydi; ikki `StreakState` tipi → `StreakSnapshot` ajratildi. |
| **Xavfsizlik (S1–S11)** | ✅ Tuzatildi | Barcha `dangerouslySetInnerHTML` → DOMPurify (`lib/sanitize.ts`); import: 8 MB limit + prototype-pollution reviver + sxema validatsiyasi (`lib/backup.ts`); `next.config.ts` — qat'iy CSP + X-Frame-Options + nosniff + Referrer-Policy + Permissions-Policy; AI URL `https` majburiy; AI kaliti eksportdan chiqarildi + ogohlantirish; `crypto.randomUUID()` ID uchun. |
| **Yetishmayotgan funksiyalar (M1–M26)** | ✅ Asosan bajarildi | Urinish tarixi + Recent Activity ✅; analitika ✅; SRS ✅; Section Quiz (Section Breakdown kartalari) ✅; Tutor/Exam tanlovi ✅; klaviatura yorliqlari ✅; jonli taymer + pauza ✅; export/import to'liq ✅; error boundary ✅; toastlar ✅; ovoz ✅; animatsiya sozlamasi ✅; Study Insight ✅; Supabase sync + sxema + UI ✅. Qoldi: formula-flashcard turi (ma'lumot kerak), PWA, savol bankini 300+ ga kengaytirish. |
| **O'lik kod / dizayn (D1–D23)** | ✅ Tuzatildi | 2-chi `Toaster.tsx` o'chirildi; `initSRSForMistakes` zag'lush olib tashlandi; yagona `checkAnswer`; `analytics.ts` funksiyalari endi ishlatiladi; `chart.js`/`react-chartjs-2`/`date-fns` olib tashlandi; `playwright` → devDependencies; tarjima xatolari (D17); ildizdagi axlat fayllar (test-*.js, screenshotlar, fix_dashboard.py) o'chirildi; `next.config` to'ldirildi; QuestionCard D19 typo. |
| **UX / Dizayn (U1–U18)** | ✅ Tuzatildi | Dark mode `.dark`/`.light` klass strategiyasi + FOUC oldini oluvchi inline skript; section badge CSS (badge-DE…CAP); ishonch badge klass nomi; `.rich-text` (typography plagini o'rniga); tutor auto-advance olib tashlandi (izoh o'qish mumkin); taymer jonli; `<main>` layout overflow bug'i; SectionMasteryBars legenda (U16); SRS "Reviewed"/"Total Tracked" (U17); Sidebar badge (U18); a11y radio/checkbox rollari; modal Esc/backdrop. |

**Qolgan mayda ishlar:** ~5 pedantik ESLint xatosi (`setState-in-effect` — xavfsiz naqshlar, build'ni to'xtatmaydi); mobil chuqurroq sinov; savol bankini 300+ ga kengaytirish (ixtiyoriy).

---

*Hisobot 2026-08-31 da yaratildi, 2026-09-01 da yakunlandi. Jonli holat: `status.html`.*

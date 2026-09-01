# Firebase Cloud Sync — sozlash

Ilova **local-first**: hech narsa talab qilinmaydi, hamma ma'lumot brauzeringizning
`localStorage`'ida ishlaydi. Lekin brauzer tozalansa yoki boshqa qurilmaga o'tsangiz
ma'lumot yo'qoladi. Buni hal qilish uchun **o'zingizning Firebase loyihangizga**
ulanib, butun progressni bitta Firestore hujjatiga (faqat sizga ko'rinadigan)
sinxronlashingiz mumkin.

Firebase'ning bepul (Spark) rejasi bu ilova uchun yetarlidan ortiq.

---

## 1. Firebase loyihasi yaratish

1. <https://console.firebase.google.com> ga kiring (Google akkount bilan).
2. **Add project** → nom bering (masalan `acca-fa-quiz`) → **Continue**.
3. Google Analytics'ni **o'chirib qo'ying** (kerak emas) → **Create project**.

## 2. Web ilova qo'shish

1. Loyiha bosh sahifasida **`</>`** (Web) belgisini bosing.
2. Nom bering (masalan `quiz-web`), **Firebase Hosting**'ni belgilamang → **Register app**.
3. Ko'rsatilgan **`firebaseConfig`** obyektini nusxa oling. U shunday ko'rinadi:

   ```js
   const firebaseConfig = {
     apiKey: "AIzaSy........................",
     authDomain: "acca-fa-quiz.firebaseapp.com",
     projectId: "acca-fa-quiz",
     storageBucket: "acca-fa-quiz.appspot.com",
     messagingSenderId: "123456789012",
     appId: "1:123456789012:web:abcdef1234567890"
   };
   ```

   > Bu qiymatlar **maxfiy emas** — web ilova uchun ular baribir brauzerda
   > ko'rinadi. Xavfsizlik quyidagi qoidalar (rules) bilan ta'minlanadi.

## 3. Email/Password kirishni yoqish

1. Chap menyu → **Build → Authentication → Get started**.
2. **Sign-in method** tabida **Email/Password** ni tanlang → **Enable** → **Save**.
   (Faqat birinchi ("Email/Password") kalitini yoqing; "Email link" shart emas.)

## 4. Firestore bazasini yaratish

1. Chap menyu → **Build → Firestore Database → Create database**.
2. **Production mode** ni tanlang → hudud (masalan `eur3`) → **Enable**.
3. **Rules** tabiga o'ting, hammasini quyidagiga almashtiring va **Publish**:

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       // Har bir foydalanuvchi faqat o'z hujjatini o'qiydi/yozadi
       match /users/{uid} {
         allow read, write: if request.auth != null && request.auth.uid == uid;
       }
     }
   }
   ```

   Bu — butun himoya. Kimdir `apiKey` ni bilsa ham, sizning `uid`ingiz ostidagi
   ma'lumotga kira olmaydi.

## 5. Ilovaga ulash

1. Quiz ilovada **Settings → Cloud Sync**.
2. **Firebase web config** maydoniga 2-bosqichdagi obyektni joylashtiring
   (`const firebaseConfig = { ... }` ko'rinishida yoki toza JSON — ikkalasi ham
   ishlaydi) → **Save config**.
3. **Email** va **parol** (kamida 6 belgi) kiriting → **Create account**
   (birinchi marta) yoki **Sign in** (keyingi safar / boshqa qurilmada).
4. **Auto-sync** ni yoqing — endi har quizdan keyin avtomatik saqlanadi va ilova
   ochilганда bulutdan yuklab oladi.

### Boshqa qurilmada

O'sha `firebaseConfig` ni joylashtiring, **o'sha email/parol bilan Sign in** qiling —
progress avtomatik tortib olinadi.

---

## Qanday ishlaydi

| Narsa | Joyi |
|---|---|
| Attempts, mistakes, SRS, streak, custom savollar, sozlamalar | `users/{uid}` hujjatida bitta `state` maydoni sifatida |
| Nizolar (conflict) | **last-write-wins** — oxirgi yozgan qurilma yutadi. Ilova ochilганда avval **pull** qiladi, keyin o'zgarishlarni **push** qiladi |
| Qo'lda boshqarish | Settings → Cloud Sync → **Push to cloud** / **Pull from cloud** |
| Maxfiy kalitlar | AI API key va Firebase config alohida `localStorage` kalitlarida — backup JSON'ga **kirmaydi** |

## Xatoliklar

| Xabar | Sabab / yechim |
|---|---|
| `Enable Email/Password sign-in…` | 3-bosqich bajarilmagan |
| `Missing or insufficient permissions` | Firestore rules (4-bosqich) noto'g'ri yoki Publish qilinmagan |
| `Wrong email or password` | Parol noto'g'ri, yoki hali `Create account` qilinmagan |
| `Network error reaching Firebase` | Internet yo'q, yoki `apiKey`/`projectId` noto'g'ri |

## O'chirish

Settings → Cloud Sync → **Disconnect Firebase**. Local progress tegilmaydi.
Bulutdagi nusxani butunlay o'chirish uchun Firebase console → Firestore → `users`
kolleksiyasidan hujjatingizni o'chiring.

# AI Form Solver — حلّ نماذج Google Forms بالذكاء الاصطناعي

موقع Next.js 16 (App Router + TypeScript + Tailwind v4) لقراءة نماذج Google Forms التدريبية وحلّ أسئلتها بنماذج AI مجانية ثم تعبئتها في النموذج الحقيقي — **دون قاعدة بيانات، ودون أن يلمس النظام زر Submit نيابةً عنك**.

> أُعيد بناء الفكرة الأصلية (Flask + Playwright) على مكدّس Next.js حديث مع فصل كامل للوحدات: قارئ Forms · AI Engine · مُعبّئ المتصفح · الجلسات.

---

## ✨ ما الذي يفعله فعليًا

1. **تسجيل دخول Google OAuth 2.0** رسمي (نفس جلسة الهوية في Google — لا كلمة مرور تُرى ولا تُخزَّن أبدًا). بدون مفاتيح Google يُنشأ **وضع تجريبي** واضح للتقييم.
2. **التحقق من رابط النموذج** (مقص `docs.google.com` / `forms.gle` فقط) ثم **جلب صفحة `viewform` وتحليل `FB_PUBLIC_LOAD_DATA_`** لاستخراج: الأسئلة بالترتيب، الأنواع، الخيارات، الأقسام/الصفحات.
3. **AI Engine مستقل** بسلسلة توافر مرتبة: `APInex GPT-6 Luna (الأساسي — APINEX_API_KEY)` ← `Gemini 2.5 Flash (اختياري)` ← `OpenRouter :free (اختياري)` ← `Pollinations (مجاني بلا مفتاح)` ← `محلل محلي احتياطي` — مع درجة ثقة لكل إجابة، ومطابقة ضبابية (عربي/لاتيني + تشكيل) للخيارات، وتخطي ما لا نجزم به.
4. **تعبئة النموذج الحقيقي** بمسارين — كلاهما **لا يضغط Submit**:
   - **على الخادم عبر Playwright (playwright-core + Chromium):** يعمل للنماذج العامة (لا يملك جلستك — ولن يملكها). يرصد إشارات Autosave من Google (`saveDraft` / مؤشر Saved).
   - **سكربت التعبئة المحلي (المسار الأفضل):** `.mjs` يُنزَّل من اللوحة — يعمل بـ Chrome بجلسة Google **الحقيقية** لجهازك، فيُفعِّل **Autosave/مسودة Google فعليًا** وتُكمل النموذج لاحقًا من نفس الرابط.
5. **لا قاعدة بيانات إطلاقًا** — الجلسات cookie موقّعة بـ HMAC (httpOnly · SameSite=Lax)، والمهام في ذاكرة الخادم وتنتهي بعد 30 دقيقة، وروابطك الحديثة وإعداداتك في `localStorage` فقط.
6. **إيقاف فوري** لكل مرحلة (تحليل/حل/تعبئة) مع بث حي للسجلات عبر **SSE** وشريط تقدم متدرج.

## 🧭 خريطة الوحدات (مقابل الهيكل التقليدي الذي طلبته)

```
src/
├── app/
│   ├── page.tsx                    → الواجهة الرئيسية (Landing)
│   ├── login/page.tsx              → تسجيل الدخول (Google / تجريبي)
│   ├── dashboard/page.tsx          → لوحة التحكم الكاملة (Client)
│   └── api/
│       ├── auth/google             → بدء OAuth (أو تجريبي)
│       ├── auth/callback/google    → استبدال code + جلسة (الرموز لا تغادر الخادم)
│       ├── auth/session · logout   → كتابة/قراءة/مسح تذكرة الجلسة
│       ├── status · analyze        → قدرات البيئة · تحليل النموذج
│       ├── solve                   → مهمة خلفية: تحليل → AI → نتائج
│       ├── jobs/[id]               → Snapshot + إلغاء (عمل Stop)
│       ├── jobs/[id]/stream        → بث SSE حي للتقدم والسجلات
│       ├── fill                    → تعبئة Playwright على الخادم
│       └── fill-script             → توليد سكربت التعبئة المحلي للتنزيل
├── lib/
│   ├── session.ts                  → HMAC session + Google OAuth (raw, بلا مكتبات)
│   ├── jobs.ts                     → مدير مهام في الذاكرة (EventSource-ready)
│   ├── forms/parser.ts             → تحقق الرابط + FB_PUBLIC_LOAD_DATA_ + المطابقة الضبابية
│   ├── ai/engine.ts                → AI Engine + السلسلة + toAiAnswer (confidence/needsReview)
│   └── automation/
│       ├── playwright-filler.ts    → تعبئة على الخادم (pages عبر Next فقط، بلا Submit)
│       └── local-script.ts         → مولّد سكربت Chrome بجلسة المستخدم (Autosave حقيقي)
└── components/                     → Logo · FAQ
```

## 🚀 التشغيل محليًا

```bash
npm install
cp .env.example .env     # اختياري — كل شيء يعمل بدونه
npm run build && npm start
# أو للتطوير: npm run dev
```

افتح http://localhost:3000 — ثم «ابدأ مجانًا». بدون أي مفاتيح: وضع تجريبي + حلول عبر Pollinations المجاني.

### تفعيل تسجيل الدخول الحقيقي عبر Google (يدوي — في Google Cloud Console)
1. https://console.cloud.google.com → أنشئ مشروعًا → **APIs & Services → OAuth consent screen** (External، أضف بريدك كـ test user).
2. **Credentials → Create Credentials → OAuth client ID** → Web application.
3. **Authorized redirect URIs**: `http://localhost:3000/api/auth/callback/google` (ورابط الإنتاج لاحقًا `https://<domain>/api/auth/callback/google`).
4. انسخ **Client ID / Secret** إلى `.env`. الصلاحيات المطلوبة فقط: `openid email profile`. لا حاجة لتفعيل أي API خاص بـ Forms.
5. **المزود الأساسي — APInex (GPT-6 Luna):**
   - احصل على `APINEX_API_KEY` من لوحة تحكم APInex (https://api.apinex.bond).
   - محلّيًا: أضفه إلى `.env` (`APINEX_API_KEY=sk-...`) — الخادم فقط، ولا تضف بادئة `NEXT_PUBLIC_`.
   - **على Vercel:** Project → Settings → Environment Variables → أضف `APINEX_API_KEY` (Production + Preview) → ثم **Redeploy**. بدون إعادة النشر لن تُقرأ القيمة.
   - الموديل الافتراضي `free/gpt-6-luna` (يمكن تغييره عبر `APINEX_MODEL` لكن لا تفعل في الإنتاج).
   - الاختبار السريع بعد النشر: `curl https://<domain>/api/status` — يجب أن يظهر `"apinexConfigured": true`. بدون مفتاح تُخطى APInex تلقائيًا ويعمل الاحتياطي.
6. مفتاح Gemini المجاني (اختياري): https://aistudio.google.com/apikey → `GEMINI_API_KEY`.

### تفعيل التعبئة على الخادم (اختياري)
```bash
npx playwright-core install chromium
```
تعمل للنماذج العامة فقط. **للاستكمال والمسوّدات استخدم دائمًا «سكربت التعبئة المحلي»** بعد تنزيله:
```bash
npm install playwright-core
node ai-form-solver-fill.mjs
```

## 🔒 نموذج الأمان (بلا مجاملات)

- Google OAuth بنطاقات `openid email profile` — لا `forms` ولا أي صلاحيات إضافية.
- `access_token` يُستهلك لحظيًا لجلب الملف الشخصي ثم يُرمى — لا يُخزَّن ولا يظهر للواجهة.
- تذكرة الجلسة: `base64url(payload).hmac_sha256` في cookie **httpOnly + SameSite=Lax + Secure (prod)**.
- مقص URL صارم — أي نطاق خارج Google يُرفض قبل أي طلب شبكة.
- **Submit محرّم آليًا**: لا توجد دالة في الكود تضغطه؛ التعبئة تتوقف عند آخر إجابة.
- الأسئلة/الإجابات/الروابط لا تُلمس القرص — ذاكرة الجلسة فقط، والحديثة في localStorage بعلمك وتحكمك (امسحها من اللوحة).

## ⚠️ حدود تقنية صادقة

| الحد | الحقيقة |
|---|---|
| Autosave ليس عالميًا | Google تحفظ المسودة فقط إن فعّلها مالك النموذج؛ ومدتها يحددها — وقد تُفقد. لا نعدك بما لا نملكه. |
| النماذج المقيّدة | الخادم لا يرى جلستك — سيعطيك جدار دخول ولا يتجاوزه. الحل: السكربت المحلي. |
| النماذج المغلقة | أسئلتها غير موجودة في الـ HTML لأي قارئ — مرفوضة بأمان مع رسالة واضحة. |
| الإجابات الشبكية والصور | تُعلَّم "تحتاج قلبًا يدويًا" بدل ملئها بثقة زائفة. |
| حصص المزودين | حدود APInex/Gemini المجانية محدودة؛ نفاد 429 = ترحيل تلقائي للمزود التالي مع توثيقه في السجل — وإلا توقف الموقع. |
| الـ Heuristic | إن انقطعت كل الشبكات يعمل محلل محلي بثقة ≤ 0.45 — معلنة، ليست خدعة يقين. |
| الدقة | AI خبير لكنه ليس معصومًا — خاصة في التخصصات الدقيقة: راجع دائمًا قبل Submit. |

## 📜 الاستخدام المقبول
الأداة للنماذج التدريبية والاستباقات التعليمية المصرّح بأتمتتها. استخدامها للاحتيال على نماذج لا تملك الحق في الرد عليها — أو لتجاوز حماية Google — مرفوض صراحة في الكود وفي العقد المصاحب.

## 🧪 التحقق
```bash
npx next typegen && npx tsc --noEmit && npm run build
curl localhost:3000/api/health
```

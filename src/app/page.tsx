import Link from "next/link";
import {
  Sparkles, ShieldCheck, Zap, Lock, ArrowLeft, CheckCircle2, BrainCircuit,
  Save, Globe, ListChecks, History, FileText, MousePointerClick,
  KeyRound, Database, Satellite, CircleDot, BadgeCheck, ServerCrash,
  Chrome, Wand2,
} from "lucide-react";
import Logo from "@/components/Logo";
import Faq from "@/components/Faq";

export default function Home() {
  return (
    <main className="relative overflow-x-clip">
      {/* ═══════ Navbar ═══════ */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/5 bg-[#05070d]/80 backdrop-blur-xl">
        <div className="wrap flex h-16 items-center justify-between">
          <Link href="/" aria-label="AI Form Solver"><Logo size={36} /></Link>
          <nav className="hidden items-center gap-7 md:flex">
            <a href="#how" className="nav-link">كيف يعمل</a>
            <a href="#features" className="nav-link">المميزات</a>
            <a href="#providers" className="nav-link">محركات AI</a>
            <a href="#security" className="nav-link">الأمان</a>
            <a href="#faq" className="nav-link">الأسئلة الشائعة</a>
          </nav>
          <Link href="/login" className="btn-primary !px-5 !py-2 text-sm">
            لوحة التحكم
            <ArrowLeft size={16} />
          </Link>
        </div>
      </header>

      {/* ═══════ Hero ═══════ */}
      <section className="relative min-h-[110svh] pt-16">
        {/* خلفية */}
        <div className="absolute inset-0 -z-10">
          <img
            src="/images/hero-bg.jpg"
            alt=""
            aria-hidden
            className="h-full w-full object-cover opacity-55"
            style={{ maskImage: "radial-gradient(ellipse 90% 75% at 50% 35%, black 45%, transparent 100%)", WebkitMaskImage: "radial-gradient(ellipse 90% 75% at 50% 35%, black 45%, transparent 100%)" }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#05070d]/40 via-[#05070d]/35 to-[#05070d]" />
          <div className="absolute inset-0 bg-grid" style={{ maskImage: "radial-gradient(ellipse 80% 60% at 50% 40%, black 30%, transparent 75%)" }} />
        </div>
        <div className="glow-orb right-[-8rem] top-40 -z-10 h-96 w-96 bg-cyan-500/25" />
        <div className="glow-orb left-[-10rem] top-72 -z-10 h-[28rem] w-[28rem] bg-violet-600/25" />

        <div className="wrap grid items-center gap-12 pb-20 pt-14 lg:grid-cols-12 lg:gap-8 lg:pt-20">
          {/* النص */}
          <div className="lg:col-span-6">
            <div className="fade-up chip mb-6 !border-violet-400/30 !bg-violet-500/10 !text-violet-200">
              <Sparkles size={13} className="text-violet-300" />
              المزود الأساسي: APInex GPT-6 Luna — مع سلسلة احتياطية مجانية
            </div>

            <h1 className="fade-up-d1 text-[2.6rem] font-extrabold leading-[1.18] tracking-tight text-white sm:text-6xl sm:leading-[1.14]">
              نماذج Google Forms
              <br />
              تُحلّ <span className="gradient-text">بذكاء اصطناعي</span>
              <br />
              وتُملأ في مكانها.
            </h1>

            <p className="fade-up-d2 mt-6 max-w-xl text-lg leading-8 text-slate-300">
              سجّل الدخول بحساب Google، الصق رابط النموذج التدريبي — يقرأ <b className="text-white">AI Core</b> الأسئلة والخيارات،
              يحلّها مجانًا، ثم يعبئها في النموذج الحقيقي عبر Playwright مع احترام ميزة <b className="text-cyan-300">Autosave</b> و
              <b className="text-violet-300"> دون أن يلمس زر Submit أبدًا</b>.
            </p>

            <div className="fade-up-d3 mt-8 flex flex-wrap items-center gap-3">
              <Link href="/login" className="btn-primary text-base">
                ابدأ مجانًا الآن
                <ArrowLeft size={18} />
              </Link>
              <a href="#how" className="btn-ghost text-sm">
                كيف يعمل؟
              </a>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-[12px] text-slate-400">
              <span className="inline-flex items-center gap-1.5"><ShieldCheck size={14} className="text-emerald-400" /> بدون كلمات مرور</span>
              <span className="inline-flex items-center gap-1.5"><Lock size={14} className="text-emerald-400" /> OAuth رسمي — openid email profile</span>
              <span className="inline-flex items-center gap-1.5"><Database size={14} className="text-emerald-400" /> صفر قاعدة بيانات</span>
              <span className="inline-flex items-center gap-1.5"><Zap size={14} className="text-emerald-400" /> حل خلال ثوانٍ</span>
            </div>
          </div>

          {/* النموذج التجريبي المتحرك */}
          <div className="lg:col-span-6">
            <div className="relative mx-auto max-w-md">
              {/* بطاقة عائمة: ثقة AI */}
              <div className="float-y absolute -right-3 top-6 z-10 hidden rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2.5 backdrop-blur-md sm:block">
                <div className="flex items-center gap-2 text-[11px] text-emerald-300">
                  <BrainCircuit size={14} />
                  <span>AI Core — ثقة 94٪</span>
                </div>
                <div className="mt-1.5 h-1.5 w-32 overflow-hidden rounded-full bg-emerald-950">
                  <div className="h-full w-[94%] rounded-full progress-shine" />
                </div>
              </div>

              {/* بطاقة عائمة: Autosave */}
              <div className="float-y-late absolute -left-4 bottom-24 z-10 hidden rounded-2xl border border-cyan-400/30 bg-cyan-500/10 px-4 py-2.5 backdrop-blur-md sm:block">
                <div className="flex items-center gap-2 text-[11px] text-cyan-300">
                  <Save size={14} />
                  <span>تم الحفظ كمسودة تلقائيًا</span>
                  <BadgeCheck size={14} />
                </div>
                <p className="mt-1 text-[10px] text-cyan-500">Google Forms Autosave مرصود (saveDraft)</p>
              </div>

              {/* نافذة النموذج */}
              <div className="glass-strong relative overflow-hidden">
                <div className="flex items-center gap-2 border-b border-white/5 bg-black/30 px-4 py-2.5" dir="ltr">
                  <span className="h-3 w-3 rounded-full bg-rose-500/80" />
                  <span className="h-3 w-3 rounded-full bg-amber-400/80" />
                  <span className="h-3 w-3 rounded-full bg-emerald-400/80" />
                  <span className="font-code mr-2 truncate text-[10px] text-slate-500">docs.google.com/forms/d/e/quiz…/viewform</span>
                </div>

                <div className="relative p-5">
                  <div className="pointer-events-none absolute inset-y-0 w-24 bg-gradient-to-l from-transparent via-cyan-400/10 to-transparent scanline" />
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-violet-300/80">نموذج تدريبي</p>
                      <h3 className="mt-0.5 text-base font-bold text-white">أساسيات الذكاء الاصطناعي — Quiz 3</h3>
                    </div>
                    <span className="chip !text-[10px]">5 أسئلة</span>
                  </div>

                  <div className="mt-4 space-y-3" dir="ltr">
                    {[
                      { n: "1", q: "ما التعريف الأدق للتعلم الآلي؟", a: "التعلم من البيانات دون برمجة صريحة", ok: true },
                      { n: "2", q: "أي مما يلي مثال على التعلم الخاضع للإشراف؟", a: "تصنيف رسائل البريد (Spam / Ham)", ok: true },
                      { n: "3", q: "اكتب تعريفًا موجزًا للـ Overfitting", a: "حفظ النموذج للتدريب دون تعميم…", ok: true },
                    ].map((r) => (
                      <div key={r.n} className="mock-row rounded-xl border border-white/10 bg-black/20 p-3">
                        <p className="text-[11px] font-semibold text-slate-300">{r.n}. {r.q}</p>
                        <div className="mt-2 flex items-center gap-2 rounded-lg border border-emerald-400/25 bg-emerald-500/5 px-2 py-1.5">
                          <CheckCircle2 size={13} className="shrink-0 text-emerald-400" />
                          <span className="truncate text-[11px] text-emerald-200">{r.a}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 flex items-center justify-between rounded-xl border border-white/5 bg-black/30 px-4 py-2.5">
                    <span className="text-[11px] text-slate-400">تقدم التعبئة</span>
                    <div className="flex items-center gap-3">
                      <div className="h-2 w-36 overflow-hidden rounded-full bg-slate-800">
                        <div className="h-full w-[100%] progress-shine rounded-full" />
                      </div>
                      <span className="font-code text-[10px] text-emerald-400">5/5</span>
                    </div>
                  </div>
                  <p className="mt-2 text-center text-[10px] text-slate-500">زر Submit ينتظر قرارك — لن يضغطه النظام.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* شريط ثقة سفلي */}
        <div className="relative border-y border-white/5 bg-black/40 backdrop-blur-sm">
          <div className="wrap grid grid-cols-2 divide-x divide-x-reverse divide-white/5 py-4 text-center sm:grid-cols-4">
            {[
              ["4+", "محركات AI مجانية بالتناوب"],
              ["0", "قاعدة بيانات — خصوصية قصوى"],
              ["100%", "تحكمك: لا Submit تلقائي"],
              ["RTL", "واجهة عربية احترافية كاملة"],
            ].map(([n, d]) => (
              <div key={d} className="px-3">
                <p className="text-xl font-extrabold text-white sm:text-2xl">{n}</p>
                <p className="mt-0.5 text-[10.5px] leading-4 text-slate-500">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ كيف يعمل ═══════ */}
      <section id="how" className="relative py-24">
        <div className="wrap">
          <div className="mb-14 text-center">
            <span className="chip mb-4 !text-cyan-300"><ListChecks size={13} /> رحلة المستخدم</span>
            <h2 className="text-3xl font-extrabold text-white sm:text-5xl">أربع خطوات — <span className="gradient-text">وصفر خطوات يدوية</span></h2>
            <p className="mx-auto mt-4 max-w-2xl text-slate-400">من تسجيل الدخول حتى مراجعة الإجابات، كل شيء مصمم حول سير عمل Google Forms الحقيقي — لا واجهة استعراضية.</p>
          </div>

          <div className="grid gap-5 md:grid-cols-4">
            {[
              { n: "٠١", icon: <Chrome size={22} />, title: "سجّل الدخول بحساب Google", desc: "OAuth 2.0 رسمي بنطاقات openid email profile — لا نرى كلمة مرورك، ولا نخزن أي رمز." },
              { n: "٠٢", icon: <Globe size={22} />, title: "الصق رابط النموذج", desc: "نتحقق من النطاق (docs.google.com فقط)، نفتح الصفحة، ونستخرج الأسئلة والخيارات والأقسام بالترتيب." },
              { n: "٠٣", icon: <Wand2 size={22} />, title: "AI Core يحل ويشرح", desc: "دفعة واحدة لكل ٦ أسئلة، مع درجة ثقة لكل إجابة — ونقل تلقائي للمزود التالي عند نفاد الحصة." },
              { n: "٠٤", icon: <MousePointerClick size={22} />, title: "تُعبأ، وتراجع أنت", desc: "Playwright يعبئ النموذج الحقيقي — وأنت من يقرر متى يضغط Submit. لا أحد ينوب عنك في الإرسال." },
            ].map((s) => (
              <div key={s.n} className="glass card-hover group relative overflow-hidden p-6">
                <span className="font-code absolute -left-2 top-2 text-5xl font-bold text-white/[0.04] transition-colors group-hover:text-violet-500/10">{s.n}</span>
                <div className="inline-flex rounded-xl border border-violet-400/25 bg-violet-500/10 p-3 text-violet-300">{s.icon}</div>
                <h3 className="mt-4 font-bold text-white">{s.title}</h3>
                <p className="mt-2 text-[13px] leading-6 text-slate-400">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ المميزات ═══════ */}
      <section id="features" className="relative border-t border-white/5 bg-[#070b14] py-24">
        <div className="glow-orb right-1/3 top-0 -z-0 h-72 w-72 bg-cyan-500/10" />
        <div className="wrap">
          <div className="mb-14 flex flex-wrap items-end justify-between gap-6">
            <div>
              <span className="chip mb-4 !text-violet-300"><Sparkles size={13} /> داخل المحرك</span>
              <h2 className="max-w-xl text-3xl font-extrabold text-white sm:text-5xl">ليس واجهة — <span className="gradient-text">منظومة تشغيل كاملة</span></h2>
            </div>
            <p className="max-w-sm text-sm leading-7 text-slate-400">كل وحدة مفصولة: قارئ Forms، محرك AI، مُعبئ Playwright، مدير جلسات — قابلة للفحص والاستبدال والصيانة كأي مشروع هندسي محترف.</p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: <BrainCircuit size={20} />, title: "AI Engine مستقل وقابل للتبديل", desc: "APInex (GPT-6 Luna) كمزود أساسي ثم Gemini أو OpenRouter إن وُجدا ثم Pollinations بلا مفتاح ثم محلل محلي احتياطي. المفتاح في الخادم فقط — التبديل بتغيير env.", tint: "from-violet-500/20 to-fuchsia-500/5 text-violet-300" },
              { icon: <Save size={20} />, title: "Autosave الحقيقي — لا وهمي", desc: "لا نعرض «تم الحفظ» إلا بعد التقاط إشارة saveDraft من Google أو مؤشر Saved في الصفحة. وما لا يقبله النموذج نُعلنه بصراحة.", tint: "from-cyan-500/20 to-sky-500/5 text-cyan-300" },
              { icon: <ShieldCheck size={20} />, title: "خصوصية بحدود Google نفسها", desc: "JWT بتوقيع HMAC في httpOnly cookie. رموز Google لا تغادر الخادم لحظة واحدة. مقص URL، مقص submit، صفر تخزين.", tint: "from-emerald-500/20 to-teal-500/5 text-emerald-300" },
              { icon: <MousePointerClick size={20} />, title: "تعبئة Playwright مدروسة", desc: "مطابقة مرنة عربي/لاتيني مع التشكيل، صفحات متعددة عبر Next فقط، تمهّل إنساني بين النقرات، وتخطي الشبكات والصور بأمان.", tint: "from-amber-500/20 to-orange-500/5 text-amber-300" },
              { icon: <ListChecks size={20} />, title: "أنواع الأسئلة المدعومة", desc: "اختيار من متعدد · مربعات اختيار · قائمة منسدلة · إجابة قصيرة · فقرة · مقياس خطي · تاريخ ووقت — والأسئلة الشبكية تُعلَّم للمراجعة.", tint: "from-rose-500/20 to-pink-500/5 text-rose-300" },
              { icon: <History size={20} />, title: "استكمال من حيث توقفت", desc: "المسودة تعيش داخل Google — أغلق الموقع وارجع لاحقًا بنفس الحساب والرابط، وستجد تقدّمك محفوظًا حيث تركته (حسب دعم النموذج).", tint: "from-indigo-500/20 to-blue-500/5 text-indigo-300" },
            ].map((f) => (
              <div key={f.title} className={`glass card-hover bg-gradient-to-br ${f.tint} border-white/10 p-6`}>
                <div className="inline-flex rounded-xl border border-white/10 bg-black/30 p-3">{f.icon}</div>
                <h3 className="mt-4 font-bold text-white">{f.title}</h3>
                <p className="mt-2 text-[13px] leading-7 text-slate-400">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ محركات AI ═══════ */}
      <section id="providers" className="border-t border-white/5 py-24">
        <div className="wrap grid items-center gap-12 lg:grid-cols-2">
          <div>
            <span className="chip mb-4 !text-emerald-300"><Satellite size={13} /> سلسلة التوافر</span>
            <h2 className="text-3xl font-extrabold text-white sm:text-5xl">لا مفتاح؟ <span className="gradient-text">لا مشكلة.</span></h2>
            <p className="mt-4 leading-8 text-slate-400">
              المزود الأساسي هو <b className="text-white">APInex — GPT-6 Luna</b> (متوافق مع OpenAI API، يجتاز الجدار السحابي للخدمة).
              وعند أي رفض أو مهلة أو بلوغ للحد، ينتقل التنفيذ تلقائيًا عبر <b className="text-white">Gemini / OpenRouter</b> إن كانا مهيأين،
              ثم <b className="text-white">Pollinations</b> المجاني بلا مفتاح، ثم المحلل المحلي — مع تسجيل واضح في كل خطوة لمن أجاب ولماذا، ودون توقف الموقع.
            </p>
            <ol className="mt-8 space-y-3">
              {[
                { name: "APInex — GPT-6 Luna", meta: "المزود الأساسي — APINEX_API_KEY — OpenAI-compatible — مجاني", pri: "١" },
                { name: "Gemini 2.5 Flash", meta: "مجاني — GEMINI_API_KEY (اختياري)", pri: "٢" },
                { name: "OpenRouter :free", meta: "مجاني — OPENROUTER_API_KEY (اختياري) — Llama 3.3 70B", pri: "٣" },
                { name: "Pollinations.ai", meta: "مجاني — بلا مفتاح إطلاقًا — الوضع الافتراضي عند غياب المفاتيح", pri: "٤" },
                { name: "Heuristic المحلي", meta: "محلي 100% — يعمل دون إنترنت — ثقة منخفضة معلنة", pri: "٥" },
              ].map((p) => (
                <li key={p.name} className="flex items-center gap-4 rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3">
                  <span className="font-code flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-violet-400/30 bg-violet-500/10 text-sm text-violet-300">{p.pri}</span>
                  <span>
                    <span className="block text-sm font-bold text-slate-100">{p.name}</span>
                    <span className="block text-[11px] text-slate-500">{p.meta}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>

          {/* لقطة سجل حي */}
          <div className="glass-strong overflow-hidden" dir="ltr">
            <div className="flex items-center justify-between border-b border-white/5 bg-black/40 px-5 py-3">
              <div className="flex items-center gap-2">
                <CircleDot size={12} className="text-emerald-400" />
                <span className="font-code text-[11px] text-slate-400">ai-core — provider chain</span>
              </div>
              <span className="chip !py-0.5 !text-[9px]">LIVE</span>
            </div>
            <div className="font-code space-y-2.5 px-5 py-5 text-[11px] leading-6">
              <p className="text-slate-500">{'> POST /api/solve { url: "docs.google.com/…" }'}</p>
              <p className="text-cyan-300">▸ تحليل الرابط… ✓ ٢١ سؤال عبر ٣ صفحات</p>
              <p className="text-slate-500">▸ provider[apinex] — gpt-6-luna → calling</p>
              <p className="text-amber-400">▸ apinex → HTTP 429 (rate limit) — failover</p>
              <p className="text-slate-500">▸ provider[pollinations] — emergency-free-fallback</p>
              <p className="text-emerald-400">▸ pollinations ✓ batch 2/4 — openai (1.9s)</p>
              <p className="text-emerald-400">▸ pollinations ✓ batch 4/4 — openai (2.3s)</p>
              <p className="text-violet-300">▸ النتيجة: 21/21 محلولة — متوسط ثقة 0.87 — 2 للمراجعة</p>
              <p className="text-slate-500">▸ Submit؟ لا. القرار لك. المسودة تُحفظ عبر Google نفسها.</p>
              <span className="inline-block h-4 w-2 animate-pulse bg-violet-400/80 align-middle" />
            </div>
          </div>
        </div>
      </section>

      {/* ═══════ الأمان ═══════ */}
      <section id="security" className="border-t border-white/5 bg-[#070b14] py-24">
        <div className="wrap grid gap-12 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <span className="chip mb-4 !text-rose-300"><ShieldCheck size={13} /> نموذج الأمان</span>
            <h2 className="text-3xl font-extrabold text-white sm:text-4xl">ثقة <span className="gradient-text">بلا تنازلات</span></h2>
            <p className="mt-4 leading-8 text-slate-400">نحن لا نطلب شيئًا لا نحتاجه، ولا نخزن شيئًا لا نملك حق الاحتفاظ به. هذا هو عقد الأمان بينك وبين المنصة:</p>
            <Link href="/login" className="btn-primary mt-8">ابدأ بأمان الآن<ArrowLeft size={17} /></Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:col-span-3">
            {[
              { icon: <KeyRound size={18} />, t: "صفر كلمات مرور", d: "Google يستقبل بيانات دخولك وحده. نحن لا نرى ولا نخزن أي كلمة مرور — لا الآن ولا أبدًا." },
              { icon: <Lock size={18} />, t: "رموز لا تغادر الخادم", d: "access_token يُستخدم لحظيًا لجلب اسمك وبريدك وصورتك ثم يُرمى. الواجهة تستقبل ملفًا شخصيًا فقط." },
              { icon: <Database size={18} />, t: "لا قاعدة بيانات", d: "لا أسئلة مخزنة، لا إجابات مخزنة، لا روابط مخزنة على القرص. ذاكرة الجلسة فقط، وتموت معها." },
              { icon: <Globe size={18} />, t: "روابط موثوقة فقط", d: "مقص URL يقبل docs.google.com وforms.gle حصريًا — أي نطاق آخر يُرفض قبل أي اتصال." },
              { icon: <MousePointerClick size={18} />, t: "Submit محرّم عليه آليًا", d: "لا توجد دالة في الكود تضغط Submit. التعبئة تتوقف عند آخر إجابة — حتى كلمة واحدة أكثر لا." },
              { icon: <ServerCrash size={18} />, t: "فشل واضح لا صامت", d: "حصة منتهية؟ شبكة مقطوعة؟ نموذج مغلق؟ كل فشل يظهر بسببه ولونه — ولا نجاح وهمي أبدًا." },
            ].map((s) => (
              <div key={s.t} className="rounded-2xl border border-white/8 bg-white/[0.03] p-5">
                <div className="inline-flex rounded-lg border border-emerald-400/20 bg-emerald-500/10 p-2 text-emerald-400">{s.icon}</div>
                <h3 className="mt-3 text-sm font-bold text-white">{s.t}</h3>
                <p className="mt-1.5 text-[12px] leading-6 text-slate-400">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ FAQ ═══════ */}
      <section id="faq" className="border-t border-white/5 py-24">
        <div className="wrap">
          <div className="mb-12 text-center">
            <span className="chip mb-4 !text-amber-300"><FileText size={13} /> بصراحة تامة</span>
            <h2 className="text-3xl font-extrabold text-white sm:text-5xl">أسئلة تسألها <span className="gradient-text">قبل أن تثق</span></h2>
          </div>
          <Faq />
        </div>
      </section>

      {/* ═══════ CTA ختامي ═══════ */}
      <section className="relative overflow-hidden border-t border-white/5 py-24">
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-cyan-600/15 via-violet-700/20 to-fuchsia-700/15" />
        <div className="bg-grid absolute inset-0 -z-10 opacity-60" />
        <div className="wrap text-center">
          <h2 className="mx-auto max-w-3xl text-4xl font-black leading-[1.2] text-white sm:text-6xl">جاهز توفر <span className="gradient-text">ساعات المذاكرة</span>؟</h2>
          <p className="mx-auto mt-5 max-w-xl text-lg text-slate-300">سجّل بدقيقة، الصق الرابط، واترك للذكاء الاصطناعي الباقي — ثم راجع واضغط Submit بنفسك.</p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link href="/login" className="btn-primary text-lg !px-8 !py-4">افتح لوحة التحكم<ArrowLeft size={20} /></Link>
            <a href="#how" className="btn-ghost">أعد قراءة آلية العمل</a>
          </div>
          <p className="mt-6 text-[11px] text-slate-500">مخصص للنماذج التدريبية. احترم سياسات مالك النموذج وشروط Google — المسؤولية قرارك.</p>
        </div>
      </section>

      {/* ═══════ Footer ═══════ */}
      <footer className="border-t border-white/5 bg-black/50 py-10">
        <div className="wrap flex flex-col items-center justify-between gap-6 sm:flex-row">
          <Logo size={32} />
          <nav className="flex flex-wrap items-center gap-5 text-[12px] text-slate-500">
            <a href="#how" className="hover:text-white">كيف يعمل</a>
            <a href="#features" className="hover:text-white">المميزات</a>
            <a href="#security" className="hover:text-white">الأمان</a>
            <a href="#faq" className="hover:text-white">FAQ</a>
            <Link href="/login" className="hover:text-white">تسجيل الدخول</Link>
          </nav>
          <p className="text-[11px] text-slate-600">© {new Date().getFullYear()} AI Form Solver — أداة تعليمية · بلا قاعدة بيانات</p>
        </div>
      </footer>
    </main>
  );
}

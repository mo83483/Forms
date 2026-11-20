"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

const QA = [
  {
    q: "هل يعمل مع أي نموذج Google Forms؟",
    a: "يعمل مع النماذج «العامة» (من يملك رابطها يمكنه الرد): يُقرأ عبر خادم آمن ويُعبأ عبر Playwright أو سكربتك المحلي. النماذج المقيّدة على حسابات محددة لا يمكن للخادم فتحها — لا نملك جلستك ولن نطلبها. في هذه الحالة افتح النموذج بحسابك من الزر، ثم استخدم «سكربت التعبئة المحلي» الذي يعمل بجلسة Chrome الخاصة بك. النماذج المغلقة (offline) لا تُدعم أصلًا لأن Google لا يعرض أسئلتها لأي قارئ.",
  },
  {
    q: "هل سيُرسل (Submit) النموذج نيابةً عني؟",
    a: "أبدًا. لا يوجد أي مسار ضغط تلقائي لزر Submit في كامل قاعدة الشيفرة — لا في الأتمتة على الخادم ولا في السكربت المحلي. التعبئة تنتهي عند آخر إجابة، وتبقى مراجعتها والضغط على Submit قرارك وحدك.",
  },
  {
    q: "كيف تحفظ إجابتي لو أغلقت المتصفح؟",
    a: "تعوّل المنصة على مسودات Google Forms نفسها. عند جلسة تعبئة حقيقية بحسابك (السكربت المحلي على جهازك)، تُسجّل Google تقدّمك كمسودة تلقائيًا لمعظم النماذج — افتح نفس الرابط لاحقًا بنفس الحساب وستجد «متابعة المسودة». مدة بقاء المسودة تحددها Google وفق إعدادات النموذج، وقد تُفقد إن أتمّ مالك النموذج إغلاقه. لن نعرض لك «تم الحفظ» إلا بعد التقاط إشارة حفظ فعلية (طلب saveDraft أو مؤشر Saved في الصفحة) — وإلا سنقولها بصراحة.",
  },
  {
    q: "هل أحتاج مفتاح API للذكاء الاصطناعي؟",
    a: "لا شيء إجباري. يعمل التطبيق فورًا عبر Pollinations (مجاني وبدون مفتاح) مع Gemini 2.5 Flash وOpenRouter كنماذج مجانية عندما تضيف مفاتيحهما من Google AI Studio. وعند نفاد أي حصة، ينتقل المحرك تلقائيًا للمزود التالي ثم إلى محلل محلي احتياطي — مع إعلان دائم للثقة المنخفضة بدل الادعاء باليقين.",
  },
  {
    q: "أين تُخزَّن بياناتي وإجاباتي؟",
    a: "لا توجد قاعدة بيانات في المشروع إطلاقًا — لا SQLite ولا PostgreSQL ولا Mongo ولا Firebase. الأسئلة والإجابات تعيش في ذاكرة الجلسة فقط وتختفي بعد 30 دقيقة. رموز Google لا تُكتب في أي ملف ولا تصل للمتصفح — تُستخدم لحظيًا للتحقق من هويتك ثم تُرمى. ما تحتفظ به الواجهة هو فقط روابطك الأخيرة وإعداداتك غير الحساسة في localStorage (قابل للمسح بزر واحد).",
  },
  {
    q: "ما هي حدود هذا المشروع بصراحة؟",
    a: "١) Google لا توفّر Autosave لكل النماذج — مسودة تُحفظ فقط عندما يدعمها النموذج وصاحبه، وقد تنتهي صلاحيتها. ٢) النماذج القصيرة متعددة الصفحات تُملأ بالترتيب عبر زر Next فقط. ٣) الأسئلة الشبكية (Grids) والصور كخيارات تُعلَّم للمراجعة ولا تُملأ آليًا بثقة. ٤) مفتاح Gemini المجاني له حصة يومية محدودة — بعدها ينتقل المحرك للمزود التالي. ٥) دقة AI في الأسئلة المتخصصة أقل؛ راجع دائمًا قبل الإرسال.",
  },
  {
    q: "لماذا لا يعتبر تسجيل الدخول هنا «فتح جلسة Google»؟",
    a: "Google تتعمد ألا تُصدِر جلسات Forms لجهات خارجية عبر OAuth — هذا تصميم أمني مقصود. لهذا يفصل المشروع بين هويتك على الموقع (OAuth رسمي: openid email profile فقط) وجلسة التعبئة الحقيقية (متصفح Chrome على جهازك أو متصفح الخادم للنماذج العامة). ولا نحاول أبدًا نسخ ملفات تعريف ارتباط Google أو انتحال جلستك — هذا مخالف صراحة لسياسات المشروع.",
  },
  {
    q: "هل أحتاج علمًا ببرمجة لاستخدام «سكربت التعبئة المحلي»؟",
    a: "تحتاج أمرين فقط ونحن نشرحهما في كل خطوة: تثبيت Node.js من nodejs.org، ثم تنفيذ أمرين في Terminal: npm install playwright-core ثم node ai-form-solver-fill.mjs. سيفتح نافذة Chrome حقيقية بملفك الشخصي، ويملأ الإجابات، ويترك زر Submit لك.",
  },
];

export default function Faq() {
  const [open, setOpen] = useState(0);
  return (
    <div className="mx-auto max-w-3xl divide-y divide-white/8 rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm">
      {QA.map((item, i) => {
        const isOpen = open === i;
        return (
          <div key={i}>
            <button
              onClick={() => setOpen(isOpen ? -1 : i)}
              className="flex w-full items-center justify-between gap-4 px-6 py-5 text-right transition-colors hover:bg-white/[0.03]"
              aria-expanded={isOpen}
            >
              <span className="text-[15px] font-semibold text-slate-100">{item.q}</span>
              <ChevronDown
                size={18}
                className={`shrink-0 text-violet-300 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}
              />
            </button>
            <div
              className={`grid transition-all duration-300 ease-out ${isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
            >
              <div className="overflow-hidden">
                <p className="border-t border-white/5 px-6 pb-5 pt-4 text-sm leading-7 text-slate-400">{item.a}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Logo from "@/components/Logo";
import { ShieldCheck, Lock, Zap, AlertCircle, ArrowLeft, Info, Chrome, CheckCircle2 } from "lucide-react";

function GoogleGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C33.9 5.7 29.2 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.2-.1-2.6-.4-3.9z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C33.9 5.7 29.2 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.8 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 38.6 44 33.9 44 24c0-1.2-.1-2.6-.4-3.9z" />
    </svg>
  );
}

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get("error");
    if (err) setError(err);
  }, []);

  const signOut = async () => {
    setSigningOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  };

  return (
    <main className="relative grid min-h-screen overflow-hidden lg:grid-cols-2">
      {/* خلفية الفن */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="glow-orb right-[-10rem] top-[-6rem] h-[30rem] w-[30rem] bg-cyan-600/20" />
        <div className="glow-orb bottom-[-8rem] left-[15%] h-[28rem] w-[28rem] bg-violet-700/20" />
      </div>

      {/* ── العمود البصري ── */}
      <div className="relative hidden flex-col justify-between overflow-hidden border-e border-white/5 p-10 lg:flex">
        <img
          src="/images/hero-bg.jpg"
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover opacity-45"
          style={{ maskImage: "linear-gradient(105deg, black 55%, transparent 100%)", WebkitMaskImage: "linear-gradient(105deg, black 55%, transparent 100%)" }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#05070d] via-transparent to-[#05070d]/60" />
        <Link href="/" className="relative"><Logo size={38} /></Link>

        <div className="relative">
          <h2 className="max-w-md text-4xl font-extrabold leading-[1.25] text-white">
            واصل رحلتك — <span className="gradient-text">إجاباتك بانتظارك داخل النموذج</span>
          </h2>
          <p className="mt-4 max-w-md leading-8 text-slate-300">
            دخولك بحساب Google يحدد هويتك على المنصة فقط — كل تعبئة حقيقية تتم بجلستك أنت، وتُحفظ مسودتك داخل Google نفسها.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-slate-300">
            {[
              "OAuth 2.0 رسمي — نطاقات openid · email · profile فقط",
              "لا نخزن رموزك ولا كلمات مرورك — أبدًا",
              "زر Submit ملكك وحدك — النظام لا يقترب منه",
              "مسوداتك تُحفظ عبر Google Autosave عند دعم النموذج",
            ].map((t) => (
              <li key={t} className="flex items-start gap-2.5">
                <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-400" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative font-code text-[10px] text-slate-600" dir="ltr">
          scope: openid email profile · response_type: code · state: HMAC · session: httpOnly<span className="text-violet-400"> ✶</span>
        </p>
      </div>

      {/* ── عمود النموذج ── */}
      <div className="relative flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">
          <Link href="/" className="mb-8 inline-flex items-center gap-2 text-sm text-slate-500 transition-colors hover:text-white lg:hidden">
            <ArrowLeft size={15} /> العودة للرئيسية
          </Link>

          <div className="glass-strong p-8">
            <div className="mb-6 flex items-center justify-between">
              <Logo size={44} />
              <span className="chip !border-emerald-400/25 !text-emerald-300"><span className="h-2 w-2 rounded-full bg-emerald-400 pulse-dot" />النظام يعمل</span>
            </div>

            <h1 className="text-2xl font-bold text-white">تسجيل الدخول</h1>
            <p className="mt-1.5 text-sm leading-7 text-slate-400">
              حساب Google واحد — نفس الحساب الذي تفتح به نماذجك. لا شيء يُطلب منك سوى موافقة Google نفسها.
            </p>

            {error && (
              <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-[12px] leading-6 text-rose-300">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* زر Google الرسمي */}
            <a
              href="/api/auth/google"
              className="mt-6 flex w-full items-center justify-center gap-3 rounded-xl border border-white/15 bg-white px-4 py-3.5 text-[15px] font-semibold text-slate-800 shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl hover:brightness-95"
            >
              <GoogleGlyph />
              تسجيل الدخول عبر Google
            </a>

            <div className="my-5 flex items-center gap-3 text-[11px] text-slate-600">
              <span className="h-px flex-1 bg-white/8" />
              بديل آمن
              <span className="h-px flex-1 bg-white/8" />
            </div>

            {/* وضع تجريبي */}
            <a
              href="/api/auth/google"
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-violet-400/30 bg-violet-500/10 px-4 py-3 text-sm font-semibold text-violet-200 transition-colors hover:bg-violet-500/15"
            >
              <Chrome size={17} />
              الدخول بالوضع التجريبي
            </a>
            <p className="mt-2 flex items-start gap-1.5 text-[10.5px] leading-5 text-slate-500">
              <Info size={12} className="mt-0.5 shrink-0" />
              يُستخدم تلقائيًا عندما لا تُضبط مفاتيح Google OAuth في .env — للتجربة والتقييم دون أي إعداد من Google Cloud Console.
            </p>

            <div className="mt-6 grid grid-cols-2 gap-3 border-t border-white/5 pt-5 text-[10.5px] text-slate-500">
              <span className="flex items-center gap-1.5"><ShieldCheck size={13} className="text-emerald-400" />لا كلمات مرور</span>
              <span className="flex items-center gap-1.5"><Lock size={13} className="text-emerald-400" />جلسة httpOnly موقعة</span>
              <span className="flex items-center gap-1.5"><Zap size={13} className="text-emerald-400" />OAuth في ثوانٍ</span>
              <button onClick={signOut} disabled={signingOut} className="flex items-center gap-1.5 text-start transition-colors hover:text-slate-300">
                <ArrowLeft size={13} className="text-rose-400" />{signingOut ? "جارٍ مسح الجلسة…" : "مسح جلسة محفوظة"}
              </button>
            </div>
          </div>

          <p className="mt-6 text-center text-[11px] leading-6 text-slate-600">
            بالمتابعة أنت تقرّ أن الأداة مخصصة للنماذج التدريبية باحترام شروط مالك النموذج وسياسات Google.
            <br />
            <Link href="/#faq" className="text-violet-400 hover:text-violet-300">اقرأ الأسئلة الشائعة عن الأمان ←</Link>
          </p>
        </div>
      </div>
    </main>
  );
}

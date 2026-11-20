"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Logo from "@/components/Logo";
import {
  Link2, ClipboardPaste, X, Play, Square, ExternalLink, CheckCircle2, AlertCircle,
  Info, Loader2, ArrowLeft, BrainCircuit, Chrome, KeyRound, Save, Settings2, Trash2,
  FileDown, Server, ShieldCheck, LogOut, Sparkles, ChevronDown,
  FlaskConical, CloudOff, Undo2, ClipboardCheck,
} from "lucide-react";

/* ═══════════ الأنواع ═══════════ */
type JobStatus = "running" | "done" | "error" | "cancelled";
interface JobLogLine { t: number; level: "info" | "success" | "warn" | "error"; msg: string }
interface JobSnapshot {
  id: string; type: "solve" | "fill"; status: JobStatus; step: string; progress: number;
  logs: JobLogLine[]; result?: unknown; error?: string; durationMs: number;
}
interface AIAnswer {
  index: number; question: string; type: string; answer: string; selectedOptions: string[];
  explanation: string; confidence: number; needsReview: boolean; provider: string;
  options?: string[];
}
interface FormMeta { id: string; title: string; viewUrl: string; answerableCount: number; sectionTitles: string[]; totalItems: number }
interface SolveResult {
  form: FormMeta; answers: AIAnswer[]; providerUsed: string; modelUsed?: string;
  chain: { name: string; ok: boolean; detail?: string }[];
  durationMs: number; quotaLimited: boolean; avgConfidence: number; needsReviewCount: number;
}
interface FillResult { filled: number; failed: number; skipped: number; failedIndexes: number[]; saveDetected: boolean; saveHint: string; signinRequired?: boolean }
interface SessionInfo { name: string; email: string; picture: string | null; demo: boolean }
interface EnvStatus { demoMode: boolean; googleOAuth: boolean; ai: { apinexConfigured: boolean; apinexModel: string; geminiConfigured: boolean; geminiModel: string; openrouterConfigured: boolean; order: string[] } }

const URL_RE = /^https?:\/\/(docs\.google\.com\/forms\/|forms\.gle\/)/i;
const TYPE_LABEL: Record<string, string> = {
  multiple_choice: "اختيار من متعدد", checkboxes: "مربعات اختيار", dropdown: "قائمة منسدلة",
  short_answer: "إجابة قصيرة", paragraph: "فقرة", linear_scale: "مقياس خطي", date: "تاريخ", time: "وقت",
  rating: "تقييم", mc_grid: "شبكة اختيار", checkbox_grid: "شبكة مربعات", unknown: "غير محدد",
};
const fmtTime = (t: number) => new Date(t).toLocaleTimeString("ar", { hour12: false });
const confColor = (c: number) => (c >= 0.75 ? "text-emerald-400" : c >= 0.55 ? "text-amber-400" : "text-rose-400");

interface Toast { id: number; kind: "success" | "error" | "info"; msg: string }

export default function DashboardPage() {
  /* ═══ الحالة ═══ */
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [env, setEnv] = useState<EnvStatus | null>(null);

  const [url, setUrl] = useState("");
  const [recents, setRecents] = useState<string[]>([]);
  const [answers, setAnswers] = useState<AIAnswer[]>([]);
  const [formMeta, setFormMeta] = useState<FormMeta | null>(null);
  const [solveMeta, setSolveMeta] = useState<Pick<SolveResult, "providerUsed" | "modelUsed" | "durationMs" | "avgConfidence" | "quotaLimited" | "needsReviewCount"> | null>(null);
  const [solveJob, setSolveJob] = useState<JobSnapshot | null>(null);
  const [fillJob, setFillJob] = useState<JobSnapshot | null>(null);
  const [fillResult, setFillResult] = useState<FillResult | null>(null);
  const [logs, setLogs] = useState<JobLogLine[]>([]);
  const [tab, setTab] = useState<"questions" | "logs">("questions");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [settings, setSettings] = useState({ fillLowConfidence: false, showExplanations: true });

  const solveSource = useRef<EventSource | null>(null);
  const fillSource = useRef<EventSource | null>(null);
  const logBoxRef = useRef<HTMLDivElement | null>(null);
  const toastId = useRef(0);

  const toast = useCallback((kind: Toast["kind"], msg: string) => {
    const id = ++toastId.current;
    setToasts((t) => [...t.slice(-2), { id, kind, msg }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5200);
  }, []);

  const urlValid = URL_RE.test(url.trim());
  const solving = solveJob?.status === "running";
  const filling = fillJob?.status === "running";
  const busy = solving || filling;
  const fillableAnswers = useMemo(
    () => answers.filter((a) => !a.needsReview || settings.fillLowConfidence),
    [answers, settings.fillLowConfidence]
  );

  /* ═══ التحميل الأولي ═══ */
  useEffect(() => {
    (async () => {
      try {
        const [s, e] = await Promise.all([fetch("/api/auth/session"), fetch("/api/status")]);
        if (s.ok) {
          const data = await s.json();
          if (data.authenticated) setSession(data.user);
        }
        if (e.ok) setEnv(await e.json());
      } finally {
        setSessionLoaded(true);
      }
    })();
    try {
      setRecents(JSON.parse(localStorage.getItem("afs.recents") ?? "[]"));
      const st = JSON.parse(localStorage.getItem("afs.settings") ?? "null");
      if (st) setSettings((p) => ({ ...p, ...st }));
    } catch { /* مفاتيح تالفة — نبدأ نظيفين */ }

    const params = new URLSearchParams(window.location.search);
    const welcome = params.get("welcome");
    if (welcome === "google") toast("success", "أهلًا بك — تم التحقق من حساب Google بنجاح.");
    if (welcome === "demo") toast("info", "وضع تجريبي — فعّل Google OAuth في .env لدخول حقيقي.");
    if (welcome) window.history.replaceState({}, "", "/dashboard");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* تمرير سجل العمليات للأسفل تلقائيًا */
  useEffect(() => {
    logBoxRef.current?.scrollTo({ top: logBoxRef.current.scrollHeight });
  }, [logs]);

  useEffect(() => () => { solveSource.current?.close(); fillSource.current?.close(); }, []);

  const persistSettings = (next: typeof settings) => {
    setSettings(next);
    try { localStorage.setItem("afs.settings", JSON.stringify(next)); } catch { /* noop */ }
  };
  const saveRecent = (u: string) => {
    setRecents((prev) => {
      const next = [u, ...prev.filter((x) => x !== u)].slice(0, 5);
      try { localStorage.setItem("afs.recents", JSON.stringify(next)); } catch { /* noop */ }
      return next;
    });
  };

  /* ═══ بث SSE للحالة الحية ═══ */
  const attachStream = useCallback((jobId: string, kind: "solve" | "fill") => {
    const src = new EventSource(`/api/jobs/${jobId}/stream`);

    const apply = (snap: JobSnapshot) => {
      setLogs(snap.logs);
      if (kind === "solve") setSolveJob(snap); else setFillJob(snap);

      if (snap.status !== "running") {
        src.close();
        if (kind === "solve") {
          if (snap.status === "done" && snap.result) {
            const r = snap.result as SolveResult;
            setAnswers(r.answers);
            setFormMeta(r.form);
            setSolveMeta({ providerUsed: r.providerUsed, modelUsed: r.modelUsed, durationMs: r.durationMs, avgConfidence: r.avgConfidence, quotaLimited: r.quotaLimited, needsReviewCount: r.needsReviewCount });
            setTab("questions");
            toast("success", `اكتمل الحل — ${r.answers.length} إجابة عبر ${r.providerUsed}. راجع ثم عبّئ.`);
          } else if (snap.status === "cancelled") toast("info", "أُوقفت مهمة الحل بناءً على طلبك.");
          else if (snap.status === "error") toast("error", snap.error ?? "تعذرت قراءة النموذج.");
        } else {
          if (snap.result && typeof snap.result === "object") setFillResult(snap.result as FillResult);
          if (snap.status === "done") toast("success", "اكتملت التعبئة — راجع النموذج ثم اضغط Submit بنفسك.");
          else if (snap.status === "cancelled") toast("info", "أُوقفت التعبئة — ما تمت تعبئته يبقى كمسودة إن دعمها النموذج.");
          else if (snap.status === "error") toast("error", snap.error ?? "تعذرت التعبئة — جرّب السكربت المحلي.");
        }
      }
    };

    src.addEventListener("snapshot", (e) => apply(JSON.parse((e as MessageEvent).data)));
    src.addEventListener("done", (e) => apply(JSON.parse((e as MessageEvent).data)));
    src.onerror = () => { /* المتصفح يعيد الاتصال تلقائيًا */ };
    if (kind === "solve") solveSource.current = src; else fillSource.current = src;
  }, [toast]);

  /* ═══ الأوامر ═══ */
  const startSolve = async () => {
    const u = url.trim();
    if (!urlValid) { toast("error", "رابط غير صالح — استخدم رابط Google Forms من docs.google.com أو forms.gle."); return; }
    setAnswers([]); setFormMeta(null); setSolveMeta(null); setFillResult(null); setFillJob(null);
    setLogs([]); setTab("questions");
    setSolveJob({ id: "pending", type: "solve", status: "running", step: "جارٍ الاتصال بالخادم…", progress: 1, logs: [], durationMs: 0 });
    try {
      const res = await fetch("/api/solve", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: u }) });
      const data = await res.json();
      if (!res.ok || !data.ok) { setSolveJob(null); toast("error", data?.error?.message ?? "تعذر بدء المهمة."); return; }
      saveRecent(u);
      attachStream(data.jobId, "solve");
    } catch {
      setSolveJob(null);
      toast("error", "انقطع الاتصال بالخادم — حاول مجددًا.");
    }
  };

  const stopAll = async () => {
    const ids = [solveJob?.id, fillJob?.id].filter((x): x is string => !!x && x !== "pending");
    await Promise.all(ids.map((id) => fetch(`/api/jobs/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "cancel" }) })));
    toast("info", "جارٍ الإيقاف عند أول نقطة آمنة…");
  };

  const startFillServer = async () => {
    const u = url.trim();
    if (!fillableAnswers.length) { toast("error", "لا توجد إجابات قابلة للتعبئة."); return; }
    setFillResult(null); setLogs([]);
    setFillJob({ id: "pending", type: "fill", status: "running", step: "جارٍ تشغيل Chromium على الخادم…", progress: 2, logs: [], durationMs: 0 });
    try {
      const res = await fetch("/api/fill", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: u, answers: fillableAnswers }) });
      const data = await res.json();
      if (!res.ok || !data.ok) { setFillJob(null); toast("error", data?.error ?? "تعذر بدء التعبئة."); return; }
      attachStream(data.jobId, "fill");
    } catch {
      setFillJob(null);
      toast("error", "انقطع الاتصال بالخادم.");
    }
  };

  const downloadLocalScript = async () => {
    const u = url.trim();
    if (!fillableAnswers.length) { toast("error", "لا توجد إجابات — حل النموذج أولًا."); return; }
    try {
      const res = await fetch("/api/fill-script", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: u, answers: fillableAnswers }) });
      if (!res.ok) { toast("error", "تعذر توليد السكربت."); return; }
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "ai-form-solver-fill.mjs";
      a.click();
      URL.revokeObjectURL(a.href);
      toast("success", "تم تنزيل السكربت — شغّله بجلسة Chrome الخاصة بك.");
    } catch {
      toast("error", "تعذر تنزيل السكربت.");
    }
  };

  const openForm = () => {
    const target = urlValid ? url.trim() : formMeta?.viewUrl;
    if (!target) { toast("error", "أدخل رابط النموذج أولًا."); return; }
    window.open(target, "_blank", "noopener,noreferrer");
  };

  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) { setUrl(text.trim()); toast("info", "تم اللصق من الحافظة."); }
    } catch {
      toast("error", "المتصفح منع قراءة الحافظة — الصق يدويًا.");
    }
  };

  const updateAnswer = (index: number, patch: Partial<AIAnswer>) =>
    setAnswers((prev) => prev.map((a) => (a.index === index ? { ...a, ...patch } : a)));

  const toggleCheckbox = (a: AIAnswer, option: string) =>
    setAnswers((prev) => prev.map((x) => {
      if (x.index !== a.index) return x;
      const has = x.selectedOptions.includes(option);
      const selectedOptions = has ? x.selectedOptions.filter((o) => o !== option) : [...x.selectedOptions, option];
      return { ...x, selectedOptions, answer: selectedOptions.join("، ") };
    }));

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  };

  const solved = answers.length > 0;
  const pipelineStep = solving ? (solveJob?.progress ?? 0) < 20 ? 0 : (solveJob?.progress ?? 0) < 88 ? 1 : 2 : solved ? 3 : -1;

  /* ═══════════════ الواجهة ═══════════════ */
  if (!sessionLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#05070d]">
        <Loader2 className="spinner text-violet-400" size={40} />
      </div>
    );
  }

  if (!session) {
    return (
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#05070d] p-6">
        <div className="glow-orb right-[10%] top-[15%] h-80 w-80 bg-cyan-600/20" />
        <div className="glow-orb bottom-[10%] left-[10%] h-96 w-96 bg-violet-700/20" />
        <div className="glass-strong relative max-w-lg p-10 text-center">
          <Logo size={54} withWord={false} />
          <h1 className="mt-5 text-2xl font-bold text-white">هذه اللوحة خاصة بالمستخدمين المسجّلين</h1>
          <p className="mt-2 text-sm leading-7 text-slate-400">سجّل الدخول بحساب Google (أو الوضع التجريبي) وستفتح لك لوحة التحكم فورًا — لا حاجة لأي إعداد.</p>
          <a href="/api/auth/google" className="btn-primary mt-6 w-full justify-center">تسجيل الدخول عبر Google</a>
          <Link href="/" className="mt-4 inline-flex items-center gap-2 text-xs text-slate-500 hover:text-white"><ArrowLeft size={13} /> العودة للرئيسية</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#05070d]">
      {/* ═══════ الشريط العلوي ═══════ */}
      <header className="fixed inset-x-0 top-0 z-40 border-b border-white/5 bg-[#05070d]/85 backdrop-blur-xl">
        <div className="wrap flex h-16 items-center justify-between gap-3">
          <Link href="/"><Logo size={33} /></Link>
          <div className="flex items-center gap-2 sm:gap-4">
            <button onClick={openForm} title="افتح النموذج بحسابك" className="btn-ghost !border-white/10 !px-3 !py-2 text-xs">
              <ExternalLink size={15} /><span className="hidden sm:inline">فتح النموذج</span>
            </button>
            <div className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.04] py-1.5 pe-3 ps-1.5">
              {session.picture ? (
                <img src={session.picture} alt="" referrerPolicy="no-referrer" className="h-8 w-8 rounded-lg object-cover" />
              ) : (
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-violet-600 text-xs font-bold text-white">{session.name?.charAt(0) ?? "S"}</span>
              )}
              <span className="hidden leading-tight md:block">
                <span className="block max-w-[130px] truncate text-[11px] font-bold text-slate-100">{session.name}</span>
                <span className="block max-w-[130px] truncate text-[9px] text-slate-500" dir="ltr">{session.email}</span>
              </span>
              {session.demo && <span className="chip !border-amber-400/30 !py-0 !text-[9px] !text-amber-300">تجريبي</span>}
              <button onClick={logout} title="تسجيل الخروج" className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-white/5 hover:text-rose-300">
                <LogOut size={15} />
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="wrap grid gap-6 pb-16 pt-24 lg:grid-cols-3">
        {/* ═══════════ العمود الرئيسي ═══════════ */}
        <div className="space-y-6 lg:col-span-2">

          {/* ── بطاقة إدخال الرابط ── */}
          <section className="glass-strong p-6">
            <div className="flex items-center justify-between gap-3">
              <h1 className="flex items-center gap-2 text-lg font-bold text-white"><Link2 size={18} className="text-cyan-400" />رابط Google Form</h1>
              <span className={`chip ${urlValid ? "!border-emerald-400/30 !text-emerald-300" : "!text-slate-500"}`}>
                {urlValid ? <><CheckCircle2 size={12} />رابط صالح</> : "بانتظار رابط"}
              </span>
            </div>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Link2 size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !busy && startSolve()}
                  placeholder="https://docs.google.com/forms/d/e/…/viewform"
                  dir="ltr"
                  spellCheck={false}
                  className="input-dark !pe-10 text-left font-code text-[13px]"
                  aria-label="رابط النموذج"
                />
                {url && (
                  <button onClick={() => setUrl("")} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white" aria-label="مسح">
                    <X size={15} />
                  </button>
                )}
              </div>
              <button onClick={pasteFromClipboard} className="btn-ghost shrink-0 !px-4 text-xs" title="لصق من الحافظة">
                <ClipboardPaste size={15} />لصق
              </button>
            </div>

            {recents.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] text-slate-500">حديثة:</span>
                {recents.map((r) => (
                  <button key={r} onClick={() => setUrl(r)} title={r} className="max-w-[190px] truncate rounded-md border border-white/8 bg-white/[0.04] px-2 py-1 text-[10px] text-slate-400 transition-colors hover:border-violet-400/40 hover:text-violet-200" dir="ltr">
                    {r.replace(/^https?:\/\//, "").slice(0, 44)}
                  </button>
                ))}
                <button onClick={() => { setRecents([]); try { localStorage.removeItem("afs.recents"); } catch {} }} className="text-slate-600 hover:text-rose-300" title="مسح الحديثة"><Trash2 size={13} /></button>
              </div>
            )}

            {/* أزرار العمل */}
            <div className="mt-5 flex flex-wrap items-center gap-2.5">
              {!busy ? (
                <button onClick={startSolve} disabled={!urlValid} className="btn-primary">
                  <Play size={17} fill="currentColor" />Start Solving
                </button>
              ) : (
                <button onClick={stopAll} className="inline-flex items-center gap-2 rounded-xl border border-rose-400/40 bg-rose-500/15 px-5 py-3 font-bold text-rose-300 transition-colors hover:bg-rose-500/25">
                  <Square size={15} fill="currentColor" />Stop
                </button>
              )}
              <button onClick={openForm} className="btn-ghost text-xs" title="Resume Form — يفتح النموذج بنفس حسابك">
                <ExternalLink size={15} />Resume Form
              </button>
              <p className="w-full text-[10px] leading-5 text-slate-600">
                لا تُرسل أي بيانات إلى طرف ثالث — الأسئلة تُحل على خوادمنا للمعالجة فقط ولا تُخزن. النموذج يُملأ في نافذة Google نفسها، وزر Submit ملكك دائمًا.
              </p>
            </div>
          </section>

          {/* ── مسار المعالجة ── */}
          {(solveJob || solved) && (
            <section className="glass p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-300">مسار المعالجة</h2>
                <span className="font-code text-[11px] text-slate-500" dir="ltr">{solving ? solveJob?.step : "مكتمل"}</span>
              </div>
              <div className="mt-4 flex items-center gap-2">
                {["القراءة والتحليل", "حل AI Core", "مطابقة الخيارات", "التعبئة والحفظ"].map((label, i) => {
                  const done = pipelineStep > i || (solved && i <= 2);
                  const active = pipelineStep === i && solving;
                  return (
                    <div key={label} className="flex flex-1 items-center gap-2">
                      <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold transition-all duration-500 ${done ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-400" : active ? "border-cyan-400/50 bg-cyan-500/15 text-cyan-300" : "border-white/10 text-slate-600"}`}>
                        {done ? <CheckCircle2 size={13} /> : active ? <Loader2 size={13} className="spinner" /> : i + 1}
                      </div>
                      <span className={`hidden text-[10px] leading-4 md:block ${done ? "text-emerald-300/90" : active ? "text-cyan-200" : "text-slate-600"}`}>{label}</span>
                      {i < 3 && <div className={`h-px flex-1 ${done ? "bg-emerald-500/40" : "bg-white/8"}`} />}
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 flex items-center gap-3">
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-800/80">
                  <div className="progress-shine h-full rounded-full transition-all duration-700" style={{ width: `${solved && !solving ? 100 : solveJob?.progress ?? 0}%` }} />
                </div>
                <span className="font-code text-[11px] text-cyan-300" dir="ltr">{Math.round(solved && !solving ? 100 : solveJob?.progress ?? 0)}%</span>
              </div>
            </section>
          )}

          {/* ── إحصائيات الحل ── */}
          {solveMeta && (
            <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "المزود المستخدم", value: solveMeta.providerUsed, tone: "text-violet-300" },
                { label: "متوسط الثقة", value: `${Math.round(solveMeta.avgConfidence * 100)}٪`, tone: confColor(solveMeta.avgConfidence) },
                { label: "بانتظار مراجعتك", value: String(solveMeta.needsReviewCount), tone: solveMeta.needsReviewCount ? "text-amber-300" : "text-emerald-300" },
                { label: "زمن الحل", value: `${(solveMeta.durationMs / 1000).toFixed(1)} ث`, tone: "text-cyan-300" },
              ].map((s) => (
                <div key={s.label} className="rounded-2xl border border-white/8 bg-white/[0.03] p-3 text-center">
                  <p className={`font-code text-base font-semibold ${s.tone}`} dir="ltr">{s.value}</p>
                  <p className="mt-1 text-[10px] text-slate-500">{s.label}</p>
                </div>
              ))}
            </section>
          )}

          {/* ── تبويبات: الأسئلة / السجل ── */}
          <section className="glass overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/8 px-5 pt-4">
              <div className="flex gap-5">
                <button onClick={() => setTab("questions")} className={`relative pb-3 text-sm font-bold transition-colors ${tab === "questions" ? "text-white" : "text-slate-500 hover:text-slate-300"}`}>
                  الأسئلة والإجابات {solved && <span className="font-code text-[10px] text-violet-300">({answers.length})</span>}
                  {tab === "questions" && <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-gradient-to-l from-cyan-400 to-violet-500" />}
                </button>
                <button onClick={() => setTab("logs")} className={`relative pb-3 text-sm font-bold transition-colors ${tab === "logs" ? "text-white" : "text-slate-500 hover:text-slate-300"}`}>
                  سجل العمليات <span className="font-code text-[10px] text-slate-600">({logs.length})</span>
                  {tab === "logs" && <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-gradient-to-l from-cyan-400 to-violet-500" />}
                </button>
              </div>
              {tab === "logs" && logs.length > 0 && (
                <button onClick={() => setLogs([])} className="mb-1.5 text-[10px] text-slate-500 hover:text-white">مسح</button>
              )}
            </div>

            {tab === "questions" ? (
              <div className="nice-scroll max-h-[34rem] overflow-y-auto p-4">
                {!solved && (
                  <div className="flex flex-col items-center py-12 text-center">
                    <FlaskConical size={38} className="text-slate-700" />
                    <p className="mt-4 font-bold text-slate-400">لا توجد إجابات بعد</p>
                    <p className="mt-1 max-w-xs text-xs leading-6 text-slate-600">الصق رابط النموذج واضغط <b>Start Solving</b> — ستظهر هنا الأسئلة مجمّعة مع إجابات AI ودرجة ثقة كل واحدة.</p>
                  </div>
                )}
                {solved && (
                  <div className="space-y-3">
                    {answers.map((a) => (
                      <article key={a.index} className={`rounded-2xl border p-4 transition-colors ${a.needsReview ? "border-amber-400/25 bg-amber-500/[0.04]" : "border-white/8 bg-black/25"}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 items-start gap-3">
                            <span className="font-code flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-[11px] font-bold text-slate-300" dir="ltr">{a.index}</span>
                            <div className="min-w-0">
                              <p className="text-[13px] font-semibold leading-6 text-slate-100">{a.question}</p>
                              <span className="mt-1.5 inline-block rounded-md border border-cyan-400/20 bg-cyan-500/8 px-1.5 py-0.5 text-[9px] text-cyan-300">{TYPE_LABEL[a.type] ?? a.type}</span>
                            </div>
                          </div>
                          {/* حلقة الثقة */}
                          <div className="relative flex h-11 w-11 shrink-0 items-center justify-center" title={`ثقة ${Math.round(a.confidence * 100)}٪ — عبر ${a.provider}`}>
                            <svg viewBox="0 0 44 44" className="h-11 w-11 -rotate-90">
                              <circle cx="22" cy="22" r="17" fill="none" stroke="rgba(148,163,184,0.15)" strokeWidth="4" />
                              <circle cx="22" cy="22" r="17" fill="none" stroke={a.confidence >= 0.75 ? "#34d399" : a.confidence >= 0.55 ? "#fbbf24" : "#fb7185"} strokeWidth="4" strokeLinecap="round" strokeDasharray={`${2 * Math.PI * 17}`} strokeDashoffset={`${2 * Math.PI * 17 * (1 - a.confidence)}`} className="transition-all duration-700" />
                            </svg>
                            <span className={`absolute font-code text-[9px] font-semibold ${confColor(a.confidence)}`} dir="ltr">{Math.round(a.confidence * 100)}</span>
                          </div>
                        </div>

                        {/* محرر الإجابة */}
                        <div className="mt-3">
                          {a.type === "checkboxes" && qOptions(a).length > 0 ? (
                            <div className="flex flex-wrap gap-1.5">
                              {qOptions(a).map((opt) => {
                                const on = a.selectedOptions.includes(opt);
                                return (
                                  <button key={opt} onClick={() => toggleCheckbox(a, opt)} className={`rounded-lg border px-2.5 py-1.5 text-[11px] transition-all ${on ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-200" : "border-white/10 text-slate-400 hover:border-white/25"}`}>
                                    {opt}
                                  </button>
                                );
                              })}
                            </div>
                          ) : ["multiple_choice", "dropdown", "linear_scale", "rating"].includes(a.type) && qOptions(a).length > 0 ? (
                            <div className="relative">
                              <select value={a.answer} onChange={(e) => updateAnswer(a.index, { answer: e.target.value, selectedOptions: [e.target.value] })} className="input-dark appearance-none text-[12px]">
                                {qOptions(a).map((o) => <option key={o} value={o}>{o}</option>)}
                              </select>
                              <ChevronDown size={14} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                            </div>
                          ) : a.type === "paragraph" ? (
                            <textarea value={a.answer} onChange={(e) => updateAnswer(a.index, { answer: e.target.value })} rows={2} className="input-dark text-[12px] leading-6" />
                          ) : a.type === "mc_grid" || a.type === "checkbox_grid" ? (
                            <p className="rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2 text-[10.5px] leading-5 text-slate-500">سؤال شبكي — لا تُملأه الأتمتة بأمان. أكمله يدويًا داخل النموذج.</p>
                          ) : (
                            <input value={a.answer} onChange={(e) => updateAnswer(a.index, { answer: e.target.value })} className="input-dark text-[12px]" />
                          )}
                        </div>

                        {settings.showExplanations && (
                          <p className="mt-2 flex items-start gap-1.5 text-[10.5px] leading-5 text-slate-500">
                            <Info size={11} className="mt-0.5 shrink-0 text-slate-600" />{a.explanation}
                          </p>
                        )}
                        {a.needsReview && (
                          <span className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-amber-400/30 bg-amber-500/10 px-2 py-0.5 text-[9.5px] font-semibold text-amber-300">
                            <AlertCircle size={11} />ثقة منخفضة — راجِع قبل التعبئة{settings.fillLowConfidence ? "" : " (سيُتخطى تلقائيًا)"}
                          </span>
                        )}
                      </article>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div ref={logBoxRef} className="term nice-scroll h-[30rem] overflow-y-auto p-4">
                {logs.length === 0 && <p className="text-slate-600">// سجل العمليات سيظهر هنا لحظيًا…</p>}
                {logs.map((l, i) => (
                  <p key={i} className={`term-line-${l.level} whitespace-pre-wrap break-words`}>
                    <span className="text-slate-700">[{fmtTime(l.t)}]</span> {l.msg}
                  </p>
                ))}
                {busy && <span className="inline-block h-3.5 w-2 animate-pulse bg-violet-400/80 align-middle" />}
              </div>
            )}
          </section>

          {/* ── تعبئة النموذج الحقيقي ── */}
          {solved && (
            <section className="glass-strong border-violet-500/20 p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="flex items-center gap-2 font-bold text-white"><ClipboardCheck size={18} className="text-emerald-400" />تعبئة النموذج الحقيقي</h2>
                  <p className="mt-1 max-w-md text-[11px] leading-5 text-slate-500">
                    ستُملأ {fillableAnswers.length} إجابة في النموذج. <b className="text-amber-300">لن يُضغط Submit</b> — ستراجع ثم تقرر.
                  </p>
                </div>
                <span className="chip !border-emerald-400/25 !text-emerald-300"><ShieldCheck size={12} />بدون Submit تلقائي</span>
              </div>

              <div className="mt-4 flex flex-wrap gap-2.5">
                <button onClick={startFillServer} disabled={filling} className="btn-ghost !border-violet-400/30 !bg-violet-500/10 text-xs text-violet-200 hover:!bg-violet-500/20">
                  {filling ? <Loader2 size={15} className="spinner" /> : <Server size={15} />}
                  تعبئة على الخادم (Playwright)
                </button>
                <button onClick={downloadLocalScript} className="btn-primary !px-5 !py-2.5 text-xs">
                  <FileDown size={15} />سكربت التعبئة المحلي
                </button>
                <button onClick={openForm} className="btn-ghost !px-4 text-xs">
                  <ExternalLink size={14} />Resume Form
                </button>
              </div>

              {/* تقدّم التعبئة */}
              {fillJob && (filling || filling === false) && (
                <div className="mt-4">
                  <div className="flex items-center gap-3">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-800"><div className="progress-shine h-full transition-all duration-500" style={{ width: `${fillJob.progress}%` }} /></div>
                    <span className="font-code text-[10px] text-violet-300" dir="ltr">{Math.round(fillJob.progress)}%</span>
                  </div>
                </div>
              )}

              {/* نتيجة التعبئة */}
              {fillResult && (
                <div className={`mt-4 rounded-2xl border p-4 ${fillResult.filled > 0 && fillResult.failed === 0 ? "border-emerald-400/30 bg-emerald-500/8" : "border-amber-400/30 bg-amber-500/8"}`}>
                  <div className="flex flex-wrap items-center gap-4 text-[12px]">
                    <span className="flex items-center gap-1.5 font-bold text-emerald-300"><CheckCircle2 size={15} />{fillResult.filled} نجح</span>
                    <span className="flex items-center gap-1.5 font-bold text-amber-300"><AlertCircle size={15} />{fillResult.failed} يحتاج يدك</span>
                    <span className="flex items-center gap-1.5 text-slate-400"><Save size={14} />{fillResult.saveDetected ? "Autosave مرصود ✓" : "Autosave غير مؤكد"}</span>
                  </div>
                  <p className="mt-2 text-[10.5px] leading-5 text-slate-400">{fillResult.saveHint}</p>
                  {fillResult.failedIndexes.length > 0 && (
                    <p className="mt-1.5 text-[10.5px] text-amber-300/80">الأسئلة المتخطاة: {fillResult.failedIndexes.map((n) => `س${n}`).join("، ")}</p>
                  )}
                  {fillResult.signinRequired && <p className="mt-1.5 text-[10.5px] font-bold text-rose-300">النموذج مقيّد على حساب Google — شغّل السكربت المحلي بمتصفحك ليسجل دخولك طبيعيًا.</p>}
                </div>
              )}

              <div className="mt-4 rounded-xl border border-white/8 bg-black/30 p-3 text-[10.5px] leading-6 text-slate-500">
                <b className="text-slate-300">أي مسار أختار؟</b><br />
                • <b>الخادم:</b> فوري — يعمل للنماذج العامة فقط (لا يملك جلسة Google الخاصة بك، وهذا مقصود).<br />
                • <b>السكربت المحلي:</b> الأفضل — نافذة Chrome بجلستك الحقيقية، وبه تُحفظ المسودة عبر Google Autosave وتُستكمل لاحقًا من نفس الرابط.<br />
                • <b>Resume Form:</b> افتح الرابط في أي وقت — إن وُجدت مسودة سيقترح Google متابعتها تلقائيًا.
              </div>
            </section>
          )}
        </div>

        {/* ═══════════ العمود الجانبي ═══════════ */}
        <aside className="space-y-5">

          {/* جلسة Google */}
          <div className="glass p-5">
            <h3 className="flex items-center justify-between text-xs font-bold uppercase tracking-widest text-slate-500">جلسة Google<Chrome size={14} className="text-slate-600" /></h3>
            <div className="mt-4 flex items-center gap-3">
              {session.picture ? (
                <img src={session.picture} alt="" referrerPolicy="no-referrer" className="h-14 w-14 rounded-2xl border border-white/10 object-cover" />
              ) : (
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-violet-600 text-lg font-bold">{session.name?.charAt(0)}</span>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-white">{session.name}</p>
                <p className="truncate text-[10.5px] text-slate-500" dir="ltr">{session.email}</p>
                <span className="mt-1 inline-flex items-center gap-1.5 rounded-md border border-emerald-400/25 bg-emerald-500/8 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-300"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400 pulse-dot" />{session.demo ? "وضع تجريبي — OAuth غير مضبوط" : "موثّق عبر Google OAuth"}</span>
              </div>
            </div>
            <p className="mt-3 border-t border-white/5 pt-3 text-[10px] leading-5 text-slate-500">
              هويتك تُتحقق عند كل طلب API. جلسة Google التي تُعبئ النموذج <u>لا تخرج من متصفحك أبدًا</u> — الخادم لا يملكها ولا يطلبها.
            </p>
          </div>

          {/* AI Engine */}
          <div className="glass p-5">
            <h3 className="flex items-center justify-between text-xs font-bold uppercase tracking-widest text-slate-500">AI Engine — سلسلة التوافر<BrainCircuit size={14} className="text-violet-400" /></h3>
            <ul className="mt-3 space-y-2 text-[11px]">
              {[
                { n: "APInex — GPT-6 Luna", ok: !!env?.ai.apinexConfigured, okText: `مهيأ — ${env?.ai.apinexModel}`, badText: "غير مهيأ — الاحتياطي يعمل", key: true, primary: true },
                { n: "Gemini 2.5 Flash", ok: !!env?.ai.geminiConfigured, okText: `مهيأ — ${env?.ai.geminiModel}`, badText: "غير مهيأ — تخطي تلقائي", key: true },
                { n: "OpenRouter :free", ok: !!env?.ai.openrouterConfigured, okText: "مهيأ — Llama 3.3 70B", badText: "غير مهيأ — تخطي تلقائي", key: true },
                { n: "Pollinations", ok: true, okText: "متاح مجانًا — بلا مفتاح", badText: "", key: false },
                { n: "Heuristic المحلي", ok: true, okText: "جاهز دائمًا — ثقة منخفضة معلنة", badText: "", key: false },
              ].map((p) => (
                <li key={p.n} className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 ${p.primary ? "border-violet-400/25 bg-violet-500/8" : "border-white/6 bg-black/25"}`}>
                  <span className="flex items-center gap-2 text-slate-300">{p.key ? <KeyRound size={12} className="text-slate-600" /> : <Sparkles size={12} className="text-slate-600" />}{p.n}{p.primary && <span className="rounded-md border border-violet-400/30 bg-violet-500/10 px-1.5 py-0.5 text-[8px] font-bold text-violet-300">المزود الأساسي</span>}</span>
                  <span className={`font-code text-[9px] ${p.ok ? "text-emerald-400" : "text-amber-500"}`} dir="rtl">{p.ok ? p.okText : p.badText}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 flex items-start gap-1.5 text-[9.5px] leading-5 text-slate-600"><Info size={11} className="mt-0.5 shrink-0" />المفاتيح تُقرأ من متغيرات البيئة على الخادم فقط ولا تصل للمتصفح أبدًا. وأي نفاد للحصة ينقل التنفيذ تلقائيًا للمزود التالي في السلسلة.</p>
            {solveMeta && <p className="mt-2 rounded-lg border border-violet-400/20 bg-violet-500/8 px-2.5 py-1.5 text-[10px] text-violet-200">آخر تشغيل: {solveMeta.providerUsed}{solveMeta.modelUsed ? ` · ${solveMeta.modelUsed}` : ""}{solveMeta.quotaLimited ? " · ⚠️ حدث ترحيل بسبب الحصة" : ""}</p>}
          </div>

          {/* Autosave */}
          <div className="glass p-5">
            <h3 className="flex items-center justify-between text-xs font-bold uppercase tracking-widest text-slate-500">Google Forms Autosave<Save size={14} className="text-cyan-400" /></h3>
            <div className="mt-3 rounded-xl border border-cyan-400/15 bg-cyan-500/5 p-3">
              <p className="font-code text-[10px] text-cyan-300">{fillResult ? (fillResult.saveDetected ? "● saveDraft signal — مرصود" : "○ لم تُرصد إشارة حفظ") : "○ بانتظار أول جلسة تعبئة"}</p>
              <p className="mt-1.5 text-[10px] leading-5 text-slate-500">{fillResult?.saveHint ?? "المسودة تُحفظ داخل Google فقط عندما يدعمها النموذج — لا نخدعك برسالة «تم الحفظ» رخيصة."}</p>
            </div>
            <ul className="mt-3 space-y-1.5 text-[10.5px] leading-5 text-slate-500">
              <li>• النماذج القصيرة متعددة الصفحات تُحفظ مسودتها أثناء التعبئة إن فعّلها مالك النموذج.</li>
              <li>• السكربت المحلي = جلستك الحقيقية = أفضل احتمال للمسودة.</li>
              <li>• استكمال لاحق: افتح نفس الرابط بنفس الحساب — Google سيقترح متابعة مسودتك.</li>
              <li>• صلاحية المسودة تحددها Google — وقد تُفقد إذا أوقف المالك النموذج.</li>
            </ul>
          </div>

          {/* الإعدادات */}
          <div className="glass p-5">
            <h3 className="flex items-center justify-between text-xs font-bold uppercase tracking-widest text-slate-500">إعدادات الجلسة<Settings2 size={14} className="text-slate-600" /></h3>
            <label className="mt-3 flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-white/6 bg-black/25 px-3 py-2.5">
              <span className="text-[11px] text-slate-300">عبئ أيضًا الإجابات <b>منخفضة الثقة</b><span className="block text-[9px] text-slate-500">افتراضيًا تُستثنى حتى تراجعها</span></span>
              <button role="switch" aria-checked={settings.fillLowConfidence} onClick={() => persistSettings({ ...settings, fillLowConfidence: !settings.fillLowConfidence })} className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${settings.fillLowConfidence ? "bg-violet-600" : "bg-slate-700"}`}>
                <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-all ${settings.fillLowConfidence ? "right-6" : "right-1"}`} />
              </button>
            </label>
            <label className="mt-2 flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-white/6 bg-black/25 px-3 py-2.5">
              <span className="text-[11px] text-slate-300">اعرض شروحات AI تحت كل إجابة</span>
              <button role="switch" aria-checked={settings.showExplanations} onClick={() => persistSettings({ ...settings, showExplanations: !settings.showExplanations })} className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${settings.showExplanations ? "bg-violet-600" : "bg-slate-700"}`}>
                <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-all ${settings.showExplanations ? "right-6" : "right-1"}`} />
              </button>
            </label>
            <p className="mt-3 flex items-center gap-1.5 text-[9px] text-slate-600"><CloudOff size={11} />الإعدادات والروابط الحديثة تُحفظ في متصفحك فقط — لا تغادر جهازك.</p>
          </div>

          {/* مذكرة استكمال */}
          <div className="rounded-2xl border border-white/8 bg-gradient-to-br from-violet-950/30 to-cyan-950/20 p-5 text-[10.5px] leading-6 text-slate-400">
            <p className="flex items-center gap-2 font-bold text-slate-200"><Undo2 size={13} className="text-violet-300" />عندما تعود لاحقًا</p>
            <ol className="mt-2 list-inside list-decimal space-y-1">
              <li>افتح <b>Resume Form</b> من هنا أو احفظ الرابط في مفضلتك.</li>
              <li>سجّل بنفس الحساب — Google سيكتشف مسودتك ويعرض استكمالها.</li>
              <li>أي سؤال لم تثق فيه الأتمتة ستجده فارغًا — أكمله يدويًا ثم Submit بقرارك.</li>
            </ol>
          </div>
        </aside>
      </div>

      {/* ═══════ Toasts ═══════ */}
      <div className="pointer-events-none fixed bottom-5 left-5 z-50 flex w-[min(92vw,22rem)] flex-col gap-2">
        {toasts.map((t) => (
          <div key={t.id} className={`toast-in pointer-events-auto flex items-start gap-2.5 rounded-xl border px-4 py-3 text-[12px] leading-6 shadow-2xl backdrop-blur-xl ${t.kind === "success" ? "border-emerald-400/30 bg-emerald-950/90 text-emerald-200" : t.kind === "error" ? "border-rose-400/30 bg-rose-950/90 text-rose-200" : "border-cyan-400/30 bg-cyan-950/90 text-cyan-100"}`}>
            {t.kind === "success" ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : t.kind === "error" ? <AlertCircle size={16} className="mt-0.5 shrink-0" /> : <Info size={16} className="mt-0.5 shrink-0" />}
            <span className="min-w-0">{t.msg}</span>
          </div>
        ))}
      </div>
    </main>
  );
}

/* خيارات السؤال — تُرسلها الخريطة الخلفية داخل كل إجابة */
function qOptions(a: AIAnswer): string[] {
  if (a.options && a.options.length) return a.options;
  const bag = new Set<string>();
  a.selectedOptions.forEach((o) => bag.add(o));
  a.answer.split("،").map((s) => s.trim()).filter(Boolean).forEach((s) => bag.add(s));
  return [...bag];
}

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { readForm, FormReadError, type ParsedForm } from "@/lib/forms/parser";
import { solveQuestions } from "@/lib/ai/engine";
import { createJob } from "@/lib/jobs";
import { registerController, releaseController } from "@/lib/controllers";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export interface SolveResultPayload {
  form: Pick<ParsedForm, "id" | "title" | "viewUrl" | "answerableCount" | "sectionTitles" | "totalItems">;
  answers: import("@/lib/ai/engine").AIAnswer[];
  providerUsed: string;
  modelUsed?: string;
  chain: import("@/lib/ai/engine").ProviderChainEntry[];
  durationMs: number;
  quotaLimited: boolean;
  avgConfidence: number;
  needsReviewCount: number;
}

// POST /api/solve — يبدأ مهمة خلفية: تحليل النموذج ثم حله بالذكاء الاصطناعي
// يعيد jobId فورًا؛ تتابع الواجهة التقدم عبر /api/jobs/[id] أو SSE
export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ ok: false, error: { code: "unauthorized", message: "سجّل الدخول أولًا." } }, { status: 401 });

  let body: { url?: string };
  try { body = await req.json(); } catch { body = {}; }
  const url = (body.url ?? "").toString().trim();
  if (!url) return NextResponse.json({ ok: false, error: { code: "invalid_url", message: "أرسِل رابط النموذج." } }, { status: 400 });

  const job = createJob("solve");
  const controller = new AbortController();
  registerController(job.id, controller);

  job.log("info", `بدأت مهمة الحل للمستخدم ${user.email}${user.demo ? " (وضع تجريبي)" : ""}`);
  job.log("info", "لا تُرسل أي بيانات إلى أي طرف — النتائج تبقى في ذاكرتك وجلستك فقط.");

  // مهمة خلفية — لا ننتظرها
  (async () => {
    try {
      job.patch({ step: "التحقق من الرابط وقراءة النموذج…", progress: 4 });
      job.log("info", `التحقق من الرابط: ${url.slice(0, 80)}${url.length > 80 ? "…" : ""}`);
      const form = await readForm(url);
      if (controller.signal.aborted) throw new Error("CANCELLED");

      job.patch({ step: "قراءة الأسئلة وتصنيفها…", progress: 12 });
      job.log("success", `تم فتح النموذج: «${form.title}»`);
      job.log("info", `وجدت ${form.answerableCount} سؤالًا قابلاً للإجابة عبر ${form.sectionTitles.length + 1} قسم/صفحة.`);
      const byType = form.questions.reduce<Record<string, number>>((acc, q) => {
        acc[q.type] = (acc[q.type] ?? 0) + 1;
        return acc;
      }, {});
      job.log("info", `الأنواع: ${Object.entries(byType).map(([t, n]) => `${t}×${n}`).join(" · ")}`);

      job.patch({ step: "الذكاء الاصطناعي يحل الأسئلة…", progress: 22 });
      const t0 = Date.now();
      const solved = await solveQuestions(form.questions, {
        signal: controller.signal,
        onProgress: (done, total, provider) => {
          job.patch({
            step: `الذكاء الاصطناعي يحل الأسئلة… (${done}/${total} عبر ${provider})`,
            progress: 22 + Math.round((done / total) * 66),
          });
        },
      });
      if (controller.signal.aborted) throw new Error("CANCELLED");

      const avg = solved.answers.length
        ? solved.answers.reduce((s, a) => s + a.confidence, 0) / solved.answers.length
        : 0;
      const needsReview = solved.answers.filter((a) => a.needsReview).length;

      job.log("success", `اكتمل الحل عبر المزود: ${solved.providerUsed}${solved.modelUsed ? ` (${solved.modelUsed})` : ""} خلال ${((Date.now() - t0) / 1000).toFixed(1)}ث`);
      if (solved.quotaLimited) job.log("warn", "أحد المزودين أبلغ عن نفاد الحصة المجانية — تم الترحيل للمزود التالي تلقائيًا.");
      if (needsReview > 0) job.log("warn", `${needsReview} إجابة بثقة منخفضة — راجعها قبل التعبئة.`);
      job.log("info", "لن يُضغط زر Submit تلقائيًا. أنت تقرر متى تسلّم النموذج.");

      const optionByIndex = new Map(form.questions.map((q) => [q.index, q.options]));
      const answersWithOptions = solved.answers.map((a) => ({ ...a, options: optionByIndex.get(a.index) ?? [] }));

      const payload: SolveResultPayload = {
        form: {
          id: form.id,
          title: form.title,
          viewUrl: form.viewUrl,
          answerableCount: form.answerableCount,
          sectionTitles: form.sectionTitles,
          totalItems: form.totalItems,
        },
        answers: answersWithOptions,
        providerUsed: solved.providerUsed,
        modelUsed: solved.modelUsed,
        chain: solved.chain,
        durationMs: solved.durationMs,
        quotaLimited: solved.quotaLimited,
        avgConfidence: Math.round(avg * 100) / 100,
        needsReviewCount: needsReview,
      };

      job.patch({ step: "اكتمل — راجع الإجابات ثم عبئ النموذج", progress: 100 });
      job.finish("done", { result: payload });
    } catch (err) {
      if (err instanceof Error && err.message === "CANCELLED") {
        job.log("warn", "أُلغيت المهمة بناءً على طلبك.");
        job.finish("cancelled");
      } else if (err instanceof FormReadError) {
        job.log("error", err.message);
        job.finish("error", { error: err.message });
      } else {
        const msg = err instanceof Error ? err.message : String(err);
        job.log("error", `خطأ غير متوقع: ${msg.slice(0, 200)}`);
        job.finish("error", { error: "تعذر إكمال المهمة — راجع السجل." });
      }
    } finally {
      releaseController(job.id);
    }
  })();

  return NextResponse.json({ ok: true, jobId: job.id });
}

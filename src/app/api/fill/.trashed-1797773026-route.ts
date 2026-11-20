import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { createJob } from "@/lib/jobs";
import { registerController, releaseController } from "@/lib/controllers";
import { fillFormServerSide } from "@/lib/automation/playwright-filler";
import { readForm, FormReadError } from "@/lib/forms/parser";
import type { FillAnswerPayload } from "@/lib/automation/local-script";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// POST /api/fill — تعبئة النموذج الحقيقي عبر Playwright على الخادم (بدون Submit)
export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  let body: { url?: string; answers?: FillAnswerPayload[] } = {};
  try { body = await req.json(); } catch { /* noop */ }

  const url = (body.url ?? "").toString().trim();
  const answers = Array.isArray(body.answers) ? body.answers.filter((a) => a && typeof a.index === "number") : [];
  if (!url) return NextResponse.json({ ok: false, error: "رابط النموذج مطلوب." }, { status: 400 });
  if (answers.length === 0) return NextResponse.json({ ok: false, error: "لا توجد إجابات للتعبئة." }, { status: 400 });

  // تأكّد أن الرابط صالح وموثوق قبل لمسه بالمتصفح
  try {
    await readForm(url);
  } catch (err) {
    if (err instanceof FormReadError) {
      return NextResponse.json({ ok: false, error: err.message, code: err.code }, { status: 400 });
    }
    return NextResponse.json({ ok: false, error: "تعذر قراءة النموذج." }, { status: 400 });
  }

  const job = createJob("fill");
  const controller = new AbortController();
  registerController(job.id, controller);

  job.log("info", `مهمة تعبئة ${answers.length} إجابة — لن يُضغط Submit.`);
  job.log("info", `الحساب: ${user.email}${user.demo ? " (تجريبي)" : ""} — الجلسة على الخادم غير مسجّلة في Google.`);

  (async () => {
    try {
      const result = await fillFormServerSide(job, url, answers);
      if (controller.signal.aborted || job.cancelRequested) {
        job.finish("cancelled", { result });
      } else {
        job.patch({ step: "اكتملت التعبئة — راجع النموذج قبل الإرسال", progress: 100 });
        if (result.signinRequired) {
          job.finish("error", {
            result,
            error: "النموذج يتطلب تسجيل دخول Google — استخدم «سكربت التعبئة المحلي» بجلسة Chrome الخاصة بك.",
          });
        } else {
          job.log("success", `التعبئة جاهزة: ${result.filled} نجح · ${result.failed} فشل · الحفظ: ${result.saveDetected ? "مرصود ✓" : "غير مؤكد"}`);
          job.finish("done", { result });
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      job.log("error", `تعذرت التعبئة: ${msg.slice(0, 220)}`);
      job.finish("error", { error: "تعذر إتمام التعبئة على الخادم. جرّب «سكربت التعبئة المحلي» — يعمل بجلسة Chrome الخاصة بك." });
    } finally {
      releaseController(job.id);
    }
  })();

  return NextResponse.json({ ok: true, jobId: job.id });
}

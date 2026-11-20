// ─────────────────────────────────────────────────────────────────────────────
// تعبئة النموذج عبر Playwright على الخادم (playwright-core + Chromium)
// يعمل للنماذج العامة (بلا تسجيل دخول). النماذج المقيّدة تقود جدار دخول
// Google — نكتشفه ونبلّغ المستخدم بالمسار المحلي بدل تجاوز أي حماية.
// مقدّس: لا نضغط زر Submit أبدًا.
// ─────────────────────────────────────────────────────────────────────────────

import { normalizeArabicLatin } from "@/lib/forms/parser";
import type { Job } from "@/lib/jobs";
import type { FillAnswerPayload } from "@/lib/automation/local-script";

export interface ServerFillResult {
  filled: number;
  failed: number;
  skipped: number;
  failedIndexes: number[];
  saveDetected: boolean;
  saveHint: string;
  signinRequired?: boolean;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function textOf(el: import("playwright-core").ElementHandle): Promise<string> {
  const al = await el.getAttribute("aria-label");
  if (al?.trim()) return al.trim();
  return (await el.innerText().catch(() => "")).trim();
}

function matchScore(target: string, candidate: string): number {
  const a = normalizeArabicLatin(target);
  const b = normalizeArabicLatin(candidate);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.8;
  const at = new Set(a.split(" ").filter((t) => t.length > 1));
  const bt = new Set(b.split(" ").filter((t) => t.length > 1));
  let inter = 0;
  at.forEach((t) => bt.has(t) && inter++);
  const union = new Set([...at, ...bt]).size || 1;
  return inter / union;
}

export async function fillFormServerSide(
  job: Job,
  formUrl: string,
  answers: FillAnswerPayload[]
): Promise<ServerFillResult> {
  const result: ServerFillResult = {
    filled: 0,
    failed: 0,
    skipped: 0,
    failedIndexes: [],
    saveDetected: false,
    saveHint:
      "Autosave يُفعَّل فقط داخل جلسة Google حقيقية للمستخدم. هذا المسار يسجّل الرد كفاعليه عند الضغط اليدوي على Submit من نافذة المراجعة.",
  };

  let chromium: typeof import("playwright-core").chromium;
  try {
    ({ chromium } = await import("playwright-core"));
  } catch {
    job.log("error", "وحدة playwright-core غير مثبتة على الخادم.");
    throw new Error("playwright-core missing");
  }

  let browser: import("playwright-core").Browser | null = null;
  try {
    browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
    job.log("info", "تم تشغيل Chromium (headless) على الخادم.");
  } catch {
    try {
      browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--no-sandbox"] });
      job.log("info", "تم تشغيل Google Chrome المثبّت على الخادم.");
    } catch (err) {
      job.log("error", "تعذر تشغيل أي متصفح على الخادم (Chromium غير مثبت).");
      job.log("info", "الحل: على الخادم نفّذ npx playwright-core install chromium — أو استخدم «سكربت التعبئة المحلي» على جهازك (يُفضَّل).");
      throw new Error(`browser-launch-failed: ${err instanceof Error ? err.message.slice(0, 200) : String(err)}`);
    }
  }

  // رصد ردود الحفظ من Google (saveDraft / proactiveSave) لإثبات Autosave
  let saveNetworkHit = false;

  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      locale: "ar",
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    });
    const page = await context.newPage();
    page.on("response", (res) => {
      const u = res.url();
      if (res.status() < 400 && /savedraft|proactivesave|\/save\b/i.test(u)) saveNetworkHit = true;
    });

    job.patch({ step: "فتح النموذج…", progress: 8 });
    await page.goto(formUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    await sleep(2000);

    if (page.url().includes("accounts.google.com")) {
      result.signinRequired = true;
      job.log("warn", "النموذج يتطلب تسجيل الدخول بحساب Google — لا نملك جلستك على الخادم (ولن نملكها).");
      job.log("info", "الحل الموصى به: حمّل «سكربت التعبئة المحلي» من الأسفل — يعمل بجلسة Chrome الخاصة بك ويحترم Autosave الحقيقي.");
      await context.close();
      return result;
    }

    await page.waitForSelector('[role="listitem"]', { timeout: 15000 }).catch(() => {});
    const total = answers.length;
    if (total === 0) {
      job.log("warn", "لا توجد إجابات قابلة للتعبئة.");
      await context.close();
      return result;
    }

    let pointer = 0;
    let pageNo = 1;

    const clickBest = async (
      scope: import("playwright-core").Locator,
      selector: string,
      target: string
    ): Promise<boolean> => {
      const els = scope.locator(selector);
      const n = await els.count();
      let best = { score: 0, idx: -1, text: "" };
      for (let i = 0; i < n; i++) {
        const text = await textOf((await els.nth(i).elementHandle())!) ?? "";
        const score = matchScore(target, text);
        if (score > best.score) best = { score, idx: i, text };
      }
      if (best.idx !== -1 && best.score >= 0.4) {
        await els.nth(best.idx).click({ timeout: 4000 });
        return true;
      }
      return false;
    };

    while (pointer < total) {
      if (job.cancelRequested) {
        job.log("warn", "تم إيقاف الأتمتة بناءً على طلبك — ما تمت تعبئته يبقى محفوظًا كمسودة إن كان النموذج يدعم Autosave.");
        break;
      }
      const blocks = page.locator('[role="listitem"]');
      const n = await blocks.count();
      if (n === 0) {
        job.log("warn", "لم تُعثر على أسئلة في الصفحة الحالية — ربما انتهت الصفحات.");
        break;
      }
      job.patch({ step: `تعبئة الصفحة ${pageNo}…` });

      for (let i = 0; i < n && pointer < total; i++) {
        if (job.cancelRequested) break;
        const answer = answers[pointer];
        pointer++;
        const block = blocks.nth(i);
        const wanted = (answer.selectedOptions?.length ? answer.selectedOptions : [answer.answer]).filter(Boolean);
        job.log("info", `س${answer.index}: ${answer.question.slice(0, 90)}${answer.question.length > 90 ? "…" : ""}`);

        try {
          let ok = false;
          const type = answer.type;
          if (type === "short_answer" || type === "date" || type === "time" || type === "unknown") {
            const input = block.locator('input[type="text"], input:not([type])').first();
            if ((await input.count()) > 0) { await input.fill(String(answer.answer ?? ""), { timeout: 4000 }); ok = true; }
          } else if (type === "paragraph") {
            const ta = block.locator("textarea").first();
            if ((await ta.count()) > 0) { await ta.fill(String(answer.answer ?? ""), { timeout: 4000 }); ok = true; }
          } else if (type === "dropdown") {
            const listbox = block.locator('[role="listbox"]').first();
            if ((await listbox.count()) > 0) {
              await listbox.click({ timeout: 4000 });
              await sleep(400);
              const options = page.locator('[role="option"]');
              let clicked = 0;
              for (const w of wanted) {
                const on = await options.count();
                let best = { score: 0, idx: -1, text: "" };
                for (let k = 0; k < on; k++) {
                  const text = await textOf((await options.nth(k).elementHandle())!) ?? "";
                  const score = matchScore(w, text);
                  if (score > best.score) best = { score, idx: k, text };
                }
                if (best.idx !== -1 && best.score >= 0.4) { await options.nth(best.idx).click({ timeout: 4000 }); clicked++; }
              }
              ok = clicked > 0;
            }
          } else if (type === "multiple_choice" || type === "linear_scale" || type === "rating") {
            ok = await clickBest(block, '[role="radio"]', String(wanted[0] ?? answer.answer));
          } else if (type === "checkboxes") {
            let count = 0;
            for (const w of wanted) {
              if (await clickBest(block, '[role="checkbox"]', String(w))) count++;
            }
            ok = count > 0;
          } else if (type === "mc_grid" || type === "checkbox_grid") {
            job.log("warn", "سؤال شبكي — يتخطاه المحرك الآلي؛ أكمله يدويًا.");
            ok = false;
          }

          if (ok) {
            result.filled++;
            job.log("success", `    ✓ تمت التعبئة${answer.answer ? ` — ${String(answer.answer).slice(0, 60)}` : ""}`);
          } else {
            result.failed++;
            result.failedIndexes.push(answer.index);
            job.log("warn", `    ✗ تعذرت تعبئته تلقائيًا — راجِعه يدويًا (س${answer.index})`);
          }
        } catch (err) {
          result.failed++;
          result.failedIndexes.push(answer.index);
          job.log("error", `    خطأ: ${err instanceof Error ? err.message.slice(0, 140) : String(err)}`);
        }

        job.patch({ progress: 10 + Math.round((pointer / total) * 78) });
        await sleep(300);
      }

      // الانتقال لصفحة/قسم تالٍ — زر «Next/التالي» فقط، أبدًا Submit
      const nextBtn = page.locator('div[role="button"]').filter({ hasText: /next|التالي/i });
      if ((await nextBtn.count()) > 0 && pointer < total && !job.cancelRequested) {
        await nextBtn.first().click({ timeout: 4000 }).catch(() => {});
        await sleep(1500);
        pageNo++;
        continue;
      }
      break;
    }

    result.skipped = Math.max(0, Math.round(total - pointer));

    // مهلة قصيرة لالتقاط حفظ Google الحقيقي
    await sleep(2500);
    const bodyText = (await page.locator("body").innerText().catch(() => "")) || "";
    result.saveDetected = saveNetworkHit || /saved|تم الحفظ|جارٍ الحفظ|saving/i.test(bodyText);
    result.saveHint = result.saveDetected
      ? "التقطنا إشارة حفظ من Google أثناء الجلسة (طلب saveDraft / مؤشر Saved في الصفحة)."
      : "لم تُلتقط إشارة Autosave صريحة — قد يظهر الحفظ بعد ثوانٍ داخل جلسة Google حقيقية، أو قد لا يكون النموذج يدعم المسوّدات أصلًا.";

    job.patch({ step: "اكتملت التعبئة" });
    await context.close();
    return result;
  } finally {
    await browser?.close().catch(() => {});
  }
}

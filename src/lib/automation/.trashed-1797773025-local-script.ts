// ─────────────────────────────────────────────────────────────────────────────
// مولّد سكربت التعبئة المحلي
// ينتج ملف .mjs مستقلاً يعمل على جهاز المستخدم بجلسة Chrome الخاصة به —
// وهذا هو المسار الوحيد الذي يفعّل مسودة Google Forms الحقيقية (Autosave)
// لأن الخادم لا يملك — ولن يملك — جلسة Google الخاصة بالمستخدم.
// ─────────────────────────────────────────────────────────────────────────────

export interface FillAnswerPayload {
  index: number;
  type: string;
  question: string;
  answer: string;
  selectedOptions: string[];
  needsReview: boolean;
}

export function buildLocalFillScript(formUrl: string, answers: FillAnswerPayload[]): string {
  const payload = JSON.stringify(
    answers.map((a) => ({
      index: a.index,
      type: a.type,
      question: a.question,
      answer: a.answer,
      selectedOptions: a.selectedOptions || [],
    })),
    null,
    2
  );

  return `#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════
// AI Form Solver — Local Filler (سكربت التعبئة المحلي)
// يعمل بجلسة Chrome الخاصة بك: نفس حساب Google ونفس ملفك الشخصي.
// لا يرسل النموذج أبدًا — زر Submit ملك لقرارك وحدك.
//
// المتطلبات:  Node.js 18+   و   Chrome/Edge/Chromium مثبت
// التشغيل:
//   npm install playwright-core        (مرة واحدة — أو: npm i playwright)
//   node ai-form-solver-fill.mjs       (سيفتح نافذة Chrome حقيقية)
//   node ai-form-solver-fill.mjs --profile "C:\\path\\to\\chrome-profile"   (اختياري)
// ════════════════════════════════════════════════════════════════════
import { chromium } from "playwright-core";
import { existsSync, mkdtempSync } from "fs";
import { tmpdir } from "os";
import path from "path";

const FORM_URL = ${JSON.stringify(formUrl)};
const ANSWERS = ${payload};

const profileArgIdx = process.argv.indexOf("--profile");
const userDataDir =
  profileArgIdx !== -1 ? process.argv[profileArgIdx + 1] : mkdtempSync(path.join(tmpdir(), "afs-chrome-"));
const useTempProfile = profileArgIdx === -1;

// تطبيع النص العربي/اللاتيني للمطابقة المرنة
const norm = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/[\\u064B-\\u065F\\u0670]/g, "")
    .replace(/ـ/g, "")
    .replace(/[إأآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\\u0600-\\u06FFa-z0-9 ]+/gi, " ")
    .replace(/\\s+/g, " ")
    .trim();

const matchScore = (target, candidate) => {
  const a = norm(target), b = norm(candidate);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.8;
  const at = new Set(a.split(" ").filter((t) => t.length > 1));
  const bt = new Set(b.split(" ").filter((t) => t.length > 1));
  let inter = 0;
  at.forEach((t) => bt.has(t) && inter++);
  const union = new Set([...at, ...bt]).size || 1;
  return inter / union;
};

async function elementText(el) {
  const al = await el.getAttribute("aria-label");
  if (al && al.trim()) return al.trim();
  const inner = await el.innerText().catch(() => "");
  return inner.trim();
}

async function clickBestOption(scope, selector, target, log) {
  const els = scope.locator(selector);
  const n = await els.count();
  let best = { score: 0, idx: -1, text: "" };
  for (let i = 0; i < n; i++) {
    const text = await elementText(els.nth(i));
    const score = matchScore(target, text);
    if (score > best.score) best = { score, idx: i, text };
  }
  if (best.idx !== -1 && best.score >= 0.4) {
    await els.nth(best.idx).click({ timeout: 5000 });
    log(\`    ✓ تم اختيار: «\${best.text}» (تطابق \${Math.round(best.score * 100)}%)\`);
    return true;
  }
  log(\`    ✗ لم يُعثر على خيار مطابق لـ «\${target}» — تخطيناه\`);
  return false;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fillBlock(block, answer, log) {
  const type = answer.type;
  const wanted = (answer.selectedOptions.length ? answer.selectedOptions : [answer.answer]).filter(Boolean);

  if (type === "short_answer" || type === "date" || type === "time") {
    const input = block.locator('input[type="text"], input:not([type])').first();
    if (await input.count()) { await input.fill(answer.answer, { timeout: 4000 }).catch(() => {}); log("    ✓ تمت تعبئة حقل نصي"); return true; }
    return false;
  }
  if (type === "paragraph") {
    const ta = block.locator("textarea").first();
    if (await ta.count()) { await ta.fill(answer.answer, { timeout: 4000 }).catch(() => {}); log("    ✓ تمت تعبئة فقرة"); return true; }
    return false;
  }
  if (type === "dropdown") {
    const listbox = block.locator('[role="listbox"]').first();
    if (await listbox.count()) {
      await listbox.click({ timeout: 4000 }).catch(() => {});
      await sleep(400);
      const options = block.page().locator('[role="option"]');
      let clicked = 0;
      for (const w of wanted) {
        let best = { score: 0, idx: -1, text: "" };
        const on = await options.count();
        for (let i = 0; i < on; i++) {
          const text = await elementText(options.nth(i));
          const score = matchScore(w, text);
          if (score > best.score) best = { score, idx: i, text };
        }
        if (best.idx !== -1 && best.score >= 0.4) { await options.nth(best.idx).click({ timeout: 4000 }).catch(() => {}); clicked++; log(\`    ✓ القائمة المنسدلة: «\${best.text}»\`); }
      }
      return clicked > 0;
    }
    return false;
  }
  if (type === "multiple_choice" || type === "linear_scale" || type === "rating") {
    return await clickBestOption(block, '[role="radio"]', wanted[0] || answer.answer, log);
  }
  if (type === "checkboxes") {
    let ok = 0;
    for (const w of wanted) {
      if (await clickBestOption(block, '[role="checkbox"]', w, log)) ok++;
    }
    return ok > 0;
  }
  log(\`    – نوع غير مدعوم آليًا (\${type}) — يحتاج مراجعة يدوية\`);
  return false;
}

(async () => {
  console.log("\nAI Form Solver — بدء جلسة التعبئة المحلية\n");
  console.log("النموذج:", FORM_URL);
  console.log("عدد الإجابات المستهدفة:", ANSWERS.length);
  console.log("ملف Chrome الشخصي:", userDataDir, useTempProfile ? "(مؤقت — للنماذج العامة)" : "(دائم — جلستك الحقيقية)");
  console.log("");

  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: "chrome",           // يستخدم Google Chrome المثبت على جهازك
    headless: false,             // نافذة مرئية — أنت تتحكم بالإرسال
    viewport: null,
    args: ["--start-maximized"],
  }).catch(async () =>
    chromium.launchPersistentContext(userDataDir, { headless: false, viewport: null }) // بديل: Chromium المدمج
  );

  const page = context.pages()[0] || (await context.newPage());
  await page.goto(FORM_URL, { waitUntil: "domcontentloaded", timeout: 45000 });
  await sleep(2500);

  if (page.url().includes("accounts.google.com")) {
    console.log("\n⚠ النموذج يطلب تسجيل الدخول بحساب Google.");
    console.log("سجّل دخولك يدويًا في نافذة Chrome المفتوحة، ثم أعد تشغيل السكربت بنفس الأمر.\n");
    // لا نغلق النافذة — المستخدم يكمل التسجيل ثم يعيد التشغيل
    await sleep(10 * 60 * 1000);
    await context.close();
    return;
  }

  let pointer = 0;
  let filled = 0, failed = 0, pageNo = 1;

  while (pointer < ANSWERS.length) {
    const blocks = page.locator('[role="listitem"]');
    const n = await blocks.count();
    if (n === 0) { console.log("لم تُعثر على أسئلة في الصفحة الحالية."); break; }
    console.log(\n    [الصفحة \${pageNo}] \${n} سؤال ظاهر\n    );

    for (let i = 0; i < n && pointer < ANSWERS.length; i++) {
      const answer = ANSWERS[pointer];
      pointer++;
      console.log(\`س\${answer.index}: \${answer.question}\`);
      try {
        const ok = await fillBlock(blocks.nth(i), answer, console.log);
        ok ? filled++ : failed++;
      } catch (err) {
        console.log("    ✗ خطأ:", String(err).slice(0, 120));
        failed++;
      }
      await sleep(350);
    }

    const nextBtn = page.locator('div[role="button"]:has-text("Next"), div[role="button"]:has-text("التالي")');
    if ((await nextBtn.count()) > 0 && pointer < ANSWERS.length) {
      await nextBtn.first().click();
      await sleep(1800);
      pageNo++;
    } else break;
  }

  console.log("\n────────────────────────────────");
  console.log(\`تمت تعبئة: \${filled} سؤال · يحتاج مراجعة: \${failed}\`);
  console.log("ملاحظة: لم يُضغط زر Submit — أنت تقرر متى تسلّمه.");
  console.log("لو كان النموذج يدعم Autosave، احفظ الصورة الظاهرة الآن بالنقر داخل النموذج أو الانتظار ٥ ثوانٍ.");
  console.log("أبقِ نافذة Chrome مفتوحة للمراجعة، ثم أغلقها عندما تنتهي.\n");
  await sleep(30 * 60 * 1000); // أبقِ الجلسة ليكمل Google مسودته
  await context.close();
})().catch((err) => {
  console.error("فشل السكربت:", err);
  process.exit(1);
});
`;
}

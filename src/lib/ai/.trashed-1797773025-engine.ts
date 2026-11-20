// ─────────────────────────────────────────────────────────────────────────────
// AI Form Solver — AI Engine (Provider-agnostic)
// سلسلة التوافر: APInex (GPT-6 Luna — المزود الأساسي) ← Gemini ← OpenRouter ←
// Pollinations (مجاني بلا مفتاح) ← Heuristic محلي (احتياط أخير، لا شبكة)
// أي مزود يمكن تبديله/تعطيله دون لمس باقي المشروع.
// ─────────────────────────────────────────────────────────────────────────────

import OpenAI from "openai";
import { bestOptionMatch, normalizeArabicLatin, type ParsedQuestion } from "@/lib/forms/parser";

export interface AIAnswer {
  index: number;
  question: string;
  type: string;
  answer: string;              // الإجابة النهائية (نص يطابق خيارًا للأسئلة الاختيارية)
  selectedOptions: string[];   // الخيارات المطابقة تمامًا — تستخدمها الأتمتة
  explanation: string;
  confidence: number;          // 0..1
  needsReview: boolean;        // true عندما لا يجرؤ المحرك على الجزم
  provider: string;
}

export interface ProviderChainEntry {
  name: string;
  ok: boolean;
  detail?: string;
}

export interface AISolveResult {
  answers: AIAnswer[];
  providerUsed: string;
  modelUsed?: string;
  chain: ProviderChainEntry[];
  durationMs: number;
  quotaLimited: boolean;
}

export interface SolveOptions {
  signal?: AbortSignal;
  onProgress?: (done: number, total: number, provider: string) => void;
}

const MIN_CONFIDENCE = 0.55;

// ─── بناء الـ Prompt ─────────────────────────────────────────────────────────
// يوجّه الموديل إلى: الفهم أولًا، قراءة كل الخيارات، عدم اختلاق معرفة،
// الإفصاح عن عدم اليقين، الحفاظ على المعرفات والترتيب، وعدم إضافة أسئلة.
const SYSTEM_PROMPT = `أنت خبير أكاديمي تجيب عن أسئلة تعليمية وتدريبية باللغتين العربية والإنجليزية.
خطوات العمل الداخلية (لا تكتبها في الرد):
1) اقرأ كل سؤال بانتباه وافهم ما المطلوب منه بالضبط.
2) في الأسئلة الاختيارية اقرأ جميع الخيارات قبل الاختيار ولا تختلق خيارًا غير موجود.
3) اختر الإجابة المناسبة تمامًا لنوع السؤال، ولو كان السؤال بالعربية أجب بالعربية ما لم تُطلب لغة أخرى.
قواعد صارمة للمخرجات:
- للأسئلة الاختيارية (multiple_choice/dropdown/linear_scale/rating): answer يجب أن تطابق نص خيار واحد حرفيًا من القائمة، وselectedOptions تحتوي ذلك الخيار وحده.
- لأسئلة المربعات (checkboxes): selectedOptions قائمة بكل الخيارات الصحيحة حرفيًا — لا تضف خيارًا غير موجود.
- لأسئلة المقال/القصيرة: answer نص مختصر ودقيق، selectedOptions قائمة فارغة.
- لا تخترع معرفة: إن لم تكن متأكدًا ضع confidence أقل من 0.55 واذكر عدم اليقين في الشرح بدل ادعاء يقين زائف.
- حافظ على index كما ورد — لا تبدل الإجابات بين الأسئلة، ولا تغيّر الترتيب، ولا تضف إجابات لأسئلة غير موجودة في الطلب.
- الشرح سطر واحد مختصر يوضح سبب الإجابة.
- أعِد JSON فقط بالشكل: {"answers":[{"index":number,"answer":string,"selectedOptions":string[],"explanation":string,"confidence":number}]}`;

interface CompactQuestion {
  index: number;
  type: string;
  question: string;
  options?: string[];
  hasOther?: boolean;
}

function buildUserPrompt(batch: CompactQuestion[]): string {
  return `أجب عن الأسئلة التالية ثم أعد JSON فقط (بدون أي نص إضافي):
${JSON.stringify({ questions: batch }, null, 1)}`;
}

// استخراج أول كائن JSON من أي مخرجات نموذج (حتى لو أُحيط بأسوار كود)
function extractJson(text: string): unknown {
  if (!text || !text.trim()) throw new Error("رد فارغ من المزود");
  const fenced = text.replace(/```(?:json)?/gi, "").trim();
  const first = fenced.indexOf("{");
  const last = fenced.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) throw new Error("لا يحتوي الرد على JSON");
  return JSON.parse(fenced.slice(first, last + 1));
}

// إزالة مفتاح المزود من أي رسالة خطأ قبل تسجيلها — المفتاح لا يظهر في السجلات أبدًا
function redactSecrets(msg: string): string {
  let out = msg;
  for (const envName of ["APINEX_API_KEY", "GEMINI_API_KEY", "OPENROUTER_API_KEY"]) {
    const key = process.env[envName];
    if (key) out = out.split(key).join("***");
  }
  return out;
}

// ─── المزودون ────────────────────────────────────────────────────────────────
interface ProviderResult {
  answers: RawAnswer[];
  model: string;
}

interface RawAnswer {
  index: number;
  answer?: string;
  selectedOptions?: string[];
  explanation?: string;
  confidence?: number;
}

type ProviderFn = (batch: CompactQuestion[], signal?: AbortSignal) => Promise<ProviderResult>;

function isValidBatch(o: unknown): o is { answers: RawAnswer[] } {
  return !!o && typeof o === "object" && Array.isArray((o as { answers?: unknown }).answers) && (o as { answers: unknown[] }).answers.length > 0;
}

// إجابة واحدة "قابلة للاستخدام"؟ (نص غير فارغ أو خيار واحد على الأقل)
function isUsableAnswer(a: RawAnswer | undefined | null): boolean {
  if (!a) return false;
  if (typeof a.answer === "string" && a.answer.trim().length > 0) return true;
  return Array.isArray(a.selectedOptions) && a.selectedOptions.some((s) => String(s).trim().length > 0);
}

// الإجابة الفارغة لا تُحسب نجاحًا — وإلا فشل المزود → انتقال للاحتياطي
function assertUsableBatch(parsed: { answers: RawAnswer[] }, providerName: string): { answers: RawAnswer[] } {
  const usable = parsed.answers.filter(isUsableAnswer);
  if (usable.length === 0) {
    throw new Error(`رد ${providerName} فارغ — لا توجد إجابة قابلة للاستخدام`);
  }
  return { answers: parsed.answers };
}

// ─── APInex (المزود الأساسي) — GPT-6 Luna عبر OpenAI-compatible API ──────────
// التوثيق الرسمي: عميل OpenAI الرسمي + baseURL المُعلن من APInex.
// جميع الاستدعاءات من جانب الخادم فقط — المفتاح لا يغادر الخادم أبدًا.
const APINEX_BASE_URL = () => process.env.APINEX_BASE_URL || "https://api.apinex.bond/v1";
const APINEX_MODEL = () => process.env.APINEX_MODEL || "free/gpt-6-luna";

async function callApinex(batch: CompactQuestion[], signal?: AbortSignal): Promise<ProviderResult> {
  const apiKey = process.env.APINEX_API_KEY;
  if (!apiKey) throw new Error("APINEX_API_KEY غير مضبوط");

  const model = APINEX_MODEL();
  // شكل الاتصال الرسمي المطلوب حرفيًا، مع baseURL قابل للضبط محليًا للاختبارات فقط
  const client = new OpenAI({
    apiKey,
    baseURL: APINEX_BASE_URL(),
    timeout: 45_000,      // مهلة مناسبة لـ Vercel functions (maxDuration=300)
    maxRetries: 2,        // إعادة محدودة — ينفذها الـ SDK للأخطاء المؤقتة فقط (5xx/اتصال/429/408)
    defaultHeaders: {
      // Cloudflare أمام APInex قد يحظر العملاء بلا بصمة شبه-متصفح
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    },
  });

  try {
    const completion = await client.chat.completions.create(
      {
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildUserPrompt(batch) },
        ],
        temperature: 0.2,
        response_format: { type: "json_object" }, // JSON منظم — المخرجات لا تكسر التحليل
      },
      { signal },
    );

    const text = completion.choices?.[0]?.message?.content ?? "";
    const parsed = extractJson(text);
    if (!isValidBatch(parsed)) throw new Error("صيغة رد APInex غير متوقعة (ليست مصفوفة answers)");
    assertUsableBatch(parsed, "APInex");
    return { answers: parsed.answers, model };
  } catch (err: unknown) {
    const anyErr = err as { status?: number; message?: string } | null;
    const status = typeof anyErr?.status === "number" ? anyErr.status : undefined;
    // نظّف الرسالة: احذف أي HTML (Cloudflare/403) ولا تسرب سوى نص قصير مفيد
    const rawAny = redactSecrets(anyErr?.message ?? (err instanceof Error ? err.message : String(err)));
    const looksHtml = /<(!doctype|html|head|body|title)/i.test(rawAny);
    const rawMsg = looksHtml
      ? "رد غير متوقع من الجدار السحابي (Cloudflare) — قد يحجب الطلب من هذه الشبكة أو لهذا المفتاح"
      : rawAny.slice(0, 220);

    if (status === 401) throw new Error("مفتاح APInex مرفوض (HTTP 401) — تحقق من APINEX_API_KEY في البيئة");
    if (status === 403) throw new Error(`APInex رفض الطلب (HTTP 403) — ${rawMsg}`);
    if (status === 429) throw new Error("APInex بلغ حد الاستخدام (HTTP 429) — سيتم الانتقال للمزود الاحتياطي");
    if (status !== undefined && status >= 500) throw new Error(`خادم APInex غير متاح مؤقتًا (HTTP ${status})`);
    throw new Error(`APInex: ${rawMsg}`);
  }
}

async function callGemini(batch: CompactQuestion[], signal?: AbortSignal): Promise<ProviderResult> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY غير مضبوط");
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: "POST",
      signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: "user", parts: [{ text: buildUserPrompt(batch) }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 8192, responseMimeType: "application/json" },
      }),
    }
  );

  if (res.status === 429) throw new Error("حصة Gemini المجانية انتهت مؤقتًا (429)");
  if (res.status === 400 || res.status === 403) throw new Error(`مفتاح Gemini مرفوض (HTTP ${res.status})`);
  if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`);

  const data = await res.json();
  const text: string = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p?.text ?? "").join("") ?? "";
  const parsed = extractJson(text);
  if (!isValidBatch(parsed)) throw new Error("صيغة رد Gemini غير متوقعة");
  assertUsableBatch(parsed, "Gemini");
  return { answers: parsed.answers, model };
}

async function callOpenRouter(batch: CompactQuestion[], signal?: AbortSignal): Promise<ProviderResult> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("OPENROUTER_API_KEY غير مضبوط");
  const model = process.env.OPENROUTER_MODEL || "meta-llama/llama-3.3-70b-instruct:free";

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${key}`,
      "HTTP-Referer": process.env.NEXTAUTH_URL || "https://ai-form-solver.local",
      "X-Title": "AI Form Solver",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(batch) },
      ],
    }),
  });

  if (res.status === 429) throw new Error("حصة OpenRouter المجانية انتهت مؤقتًا (429)");
  if (!res.ok) throw new Error(`OpenRouter HTTP ${res.status}`);

  const data = await res.json();
  const text: string = data?.choices?.[0]?.message?.content ?? "";
  const parsed = extractJson(text);
  if (!isValidBatch(parsed)) throw new Error("صيغة رد OpenRouter غير متوقعة");
  assertUsableBatch(parsed, "OpenRouter");
  return { answers: parsed.answers, model };
}

async function callPollinations(batch: CompactQuestion[], signal?: AbortSignal): Promise<ProviderResult> {
  const res = await fetch("https://text.pollinations.ai/", {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(batch) },
      ],
      model: process.env.POLLINATIONS_MODEL || "openai",
      jsonMode: true,
      private: true,
      referrer: "ai-form-solver",
    }),
  });

  if (res.status === 429) throw new Error("Pollinations مشغول حاليًا (429) — حاول بعد دقيقة");
  if (!res.ok) throw new Error(`Pollinations HTTP ${res.status}`);

  const raw = await res.text();
  const parsed = extractJson(raw);
  if (!isValidBatch(parsed)) throw new Error("صيغة رد Pollinations غير متوقعة");
  assertUsableBatch(parsed, "Pollinations");
  return { answers: parsed.answers, model: process.env.POLLINATIONS_MODEL || "openai" };
}

// احتياطي محلي — يجيب بتحليل كلمات مفتاحية، ويُعلن دائمًا ثقة منخفضة
function callHeuristic(batch: CompactQuestion[]): ProviderResult {
  const answers: RawAnswer[] = batch.map((q) => {
    if (q.options && q.options.length) {
      const { option } = bestOptionMatch(q.question, q.options);
      return {
        index: q.index,
        answer: option ?? q.options[0],
        selectedOptions: [option ?? q.options[0]],
        explanation: "إجابة احتياطية (تحليل كلمات مفتاحية محلي) — راجِعها قبل التعبئة.",
        confidence: 0.35,
      };
    }
    return {
      index: q.index,
      answer: "راجع هذه الإجابة يدويًا — تعذر الوصول إلى نموذج ذكاء اصطناعي حاليًا.",
      selectedOptions: [],
      explanation: "تم التشغيل دون مزود AI (الشبكات غير متاحة).",
      confidence: 0.2,
    };
  });
  return { answers, model: "heuristic-local" };
}

const PROVIDERS: { name: string; fn: ProviderFn; requiresEnv?: string }[] = [
  { name: "apinex", fn: callApinex, requiresEnv: "APINEX_API_KEY" }, // الأساسي — GPT-6 Luna
  { name: "gemini", fn: callGemini, requiresEnv: "GEMINI_API_KEY" },
  { name: "openrouter", fn: callOpenRouter, requiresEnv: "OPENROUTER_API_KEY" },
  { name: "pollinations", fn: callPollinations },
];

// ─── المطابقة والتحقق بعد الحل ──────────────────────────────────────────────
function toAiAnswer(q: ParsedQuestion, raw: RawAnswer | undefined, provider: string): AIAnswer {
  const type = q.type;
  const isChoice = q.options.length > 0;
  let answer = (raw?.answer ?? "").toString().trim();
  let selected = (raw?.selectedOptions ?? []).map((s) => String(s).trim()).filter(Boolean);
  let confidence = typeof raw?.confidence === "number" && Number.isFinite(raw.confidence) ? raw.confidence : 0.5;
  confidence = Math.min(1, Math.max(0, confidence));
  let needsReview = confidence < MIN_CONFIDENCE;

  if (isChoice) {
    // طابق كل خيار مختار مع نص خيار حقيقي
    const matched: string[] = [];
    const pool = selected.length ? selected : answer ? [answer] : [];
    for (const cand of pool) {
      const { option, score } = bestOptionMatch(cand, q.options);
      if (option && score >= 0.45 && !matched.includes(option)) matched.push(option);
    }
    if (type === "checkboxes" || type === "checkbox_grid") {
      selected = matched;
      answer = matched.join("، ");
      if (!matched.length) needsReview = true;
    } else {
      if (matched.length) {
        selected = [matched[0]];
        answer = matched[0];
      } else {
        // لم تُطابق الإجابة أي خيار → لا نجزم
        const fb = bestOptionMatch(q.title, q.options);
        selected = fb.option && fb.score >= 0.6 ? [fb.option] : [];
        answer = fb.option && fb.score >= 0.6 ? fb.option : answer || q.options[0];
        needsReview = true;
        confidence = Math.min(confidence, 0.4);
      }
    }
    if (selected.length === 0) needsReview = true;
  } else {
    selected = [];
    if (!answer || answer.length < 2) {
      answer = "تعذر توليد إجابة واثقة لهذا السؤال — راجعه يدويًا.";
      needsReview = true;
      confidence = Math.min(confidence, 0.3);
    }
  }

  return {
    index: q.index,
    question: q.title,
    type,
    answer,
    selectedOptions: selected,
    explanation: (raw?.explanation ?? "لا يوجد شرح متاح.").toString().slice(0, 400),
    confidence: Math.round(confidence * 100) / 100,
    needsReview,
    provider,
  };
}

// ─── المحرك الرئيسي ─────────────────────────────────────────────────────────
export async function solveQuestions(
  questions: ParsedQuestion[],
  opts: SolveOptions = {}
): Promise<AISolveResult> {
  const started = Date.now();
  const answerable = questions.filter((q) => q.type !== "unknown");
  const finalAnswers: AIAnswer[] = new Array(answerable.length);
  const chain: ProviderChainEntry[] = [];
  let providerUsed = "heuristic";
  let modelUsed: string | undefined = "heuristic-local";
  let quotaLimited = false;

  const BATCH = 6;
  for (let offset = 0; offset < answerable.length; offset += BATCH) {
    if (opts.signal?.aborted) throw new Error("CANCELLED");
    const slice = answerable.slice(offset, offset + BATCH);
    const batch: CompactQuestion[] = slice.map((q) => ({
      index: q.index,
      type: q.type,
      question: q.title,
      ...(q.options.length ? { options: q.options } : {}),
      ...(q.hasOther ? { hasOther: true } : {}),
    }));

    let solved = false;
    for (const provider of PROVIDERS) {
      if (opts.signal?.aborted) throw new Error("CANCELLED");
      if (provider.requiresEnv && !process.env[provider.requiresEnv]) {
        chain.push({ name: provider.name, ok: false, detail: `${provider.requiresEnv} غير مضبوط — تم التخطي` });
        continue;
      }
      try {
        const timeout = AbortSignal.timeout(45_000);
        let linked = timeout;
        if (opts.signal) {
          const outer = opts.signal;
          const bridge = new AbortController();
          const fail = () => bridge.abort();
          if (outer.aborted) bridge.abort();
          else {
            outer.addEventListener("abort", fail, { once: true });
            timeout.addEventListener("abort", fail, { once: true });
          }
          linked = bridge.signal;
        }
        const result = await provider.fn(batch, linked);
        const byIndex = new Map(result.answers.map((a) => [a.index, a]));
        slice.forEach((q, i) => {
          const raw = byIndex.get(q.index) ?? result.answers[i];
          finalAnswers[offset + i] = toAiAnswer(q, raw, provider.name);
        });
        chain.push({ name: provider.name, ok: true, detail: `نجحت دفعة ${offset / BATCH + 1} (${result.model})` });
        providerUsed = provider.name;
        modelUsed = result.model;
        solved = true;
        opts.onProgress?.(Math.min(offset + slice.length, answerable.length), answerable.length, provider.name);
        break;
      } catch (err) {
        const msg = redactSecrets(err instanceof Error ? err.message : String(err));
        if (/429|حصة|quota|حد الاستخدام/i.test(msg)) quotaLimited = true;
        chain.push({ name: provider.name, ok: false, detail: msg.slice(0, 160) });
      }
    }

    if (!solved) {
      const fallback = callHeuristic(batch);
      slice.forEach((q, i) => {
        finalAnswers[offset + i] = toAiAnswer(q, fallback.answers[i], "heuristic");
      });
      chain.push({ name: "heuristic", ok: true, detail: "تم استخدام المحلل المحلي الاحتياطي" });
      opts.onProgress?.(Math.min(offset + slice.length, answerable.length), answerable.length, "heuristic");
    }
  }

  return {
    answers: finalAnswers,
    providerUsed,
    modelUsed,
    chain,
    durationMs: Date.now() - started,
    quotaLimited,
  };
}

// فحص جاهزية المزودين (لبطاقة الحالة في اللوحة)
export function providerStatus() {
  return {
    apinex: { configured: !!process.env.APINEX_API_KEY, model: APINEX_MODEL(), note: "المزود الأساسي — GPT-6 Luna", baseURL: APINEX_BASE_URL() },
    gemini: { configured: !!process.env.GEMINI_API_KEY, model: process.env.GEMINI_MODEL || "gemini-2.5-flash" },
    openrouter: { configured: !!process.env.OPENROUTER_API_KEY, model: process.env.OPENROUTER_MODEL || "meta-llama/llama-3.3-70b-instruct:free" },
    pollinations: { configured: true, model: process.env.POLLINATIONS_MODEL || "openai", note: "مجاني بدون مفتاح" },
    heuristic: { configured: true, note: "يعمل دون إنترنت — ثقة منخفضة" },
  };
}

// مُصدَّر للاختبارات فقط (غير مستخدم في الإنتاج) — يتيح اختبار callApinex معزولًا
export { callApinex, extractJson, isValidBatch, isUsableAnswer };

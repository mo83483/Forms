// ─────────────────────────────────────────────────────────────────────────────
// AI Form Solver — Google Forms Reader
// قراءة وتحليل نماذج Google Forms من جهة الخادم (Server-side)
// لا يستخدم أي قاعدة بيانات · لا يخزن أي محتوى للنماذج
// ─────────────────────────────────────────────────────────────────────────────

export type FormQuestionType =
  | "short_answer"
  | "paragraph"
  | "multiple_choice"
  | "dropdown"
  | "checkboxes"
  | "linear_scale"
  | "date"
  | "time"
  | "rating"
  | "mc_grid"
  | "checkbox_grid"
  | "unknown";

export interface ParsedQuestion {
  index: number; // الترتيب بين الأسئلة القابلة للإجابة (1-based)
  itemId: number | null;
  entryId: string | null; // entry.NNN — يُستخدم مع هواتف التعبئة الآلية
  title: string;
  type: FormQuestionType;
  typeCode: number;
  options: string[];
  hasOther: boolean;
  page: number; // رقم الصفحة/القسم
}

export interface ParsedForm {
  id: string;
  title: string;
  viewUrl: string;
  answerUrl: string; // رابط formResponse الرسمي (يظهر في الوثائق فقط — لا يُستدعى هنا)
  questions: ParsedQuestion[];
  sectionTitles: string[];
  totalItems: number;
  answerableCount: number;
}

export type FormReadErrorCode =
  | "invalid_url"
  | "untrusted_host"
  | "not_found"
  | "auth_required"
  | "closed"
  | "unreadable"
  | "network"
  | "timeout";

export class FormReadError extends Error {
  code: FormReadErrorCode;
  constructor(code: FormReadErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

export interface FormInput {
  kind: "id" | "short";
  id?: string;
  shortUrl?: string;
}

// ─── 1) التحقق من الرابط وتجهيزه ────────────────────────────────────────────
const ID_RE = /^[A-Za-z0-9_-]{20,}$/;

export function normalizeFormInput(raw: string): FormInput {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new FormReadError("invalid_url", "لم يتم إدخال أي رابط. الصق رابط Google Forms أولًا.");
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new FormReadError("invalid_url", "الرابط غير صالح. تأكد من نسخ الرابط كاملًا من Google Forms.");
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new FormReadError("invalid_url", "الرابط يجب أن يبدأ بـ https://");
  }

  const host = url.hostname.toLowerCase();

  // روابط الاختصار الخاصة بـ Google Forms (forms.gle) — تُحل عند الجلب
  if (host === "forms.gle" || host === "goo.gl") {
    return { kind: "short", shortUrl: `https://${host}${url.pathname}` };
  }

  // docs.google.com فقط — رفض أي مضيف آخر (حماية)
  if (host !== "docs.google.com") {
    throw new FormReadError(
      "untrusted_host",
      "هذا الرابط ليس رابط Google Forms موثوقًا. النطاق المسموح: docs.google.com"
    );
  }

  // /forms/d/e/<ID>/viewform | /forms/d/e/<ID>/edit | /forms/d/<ID>
  const m =
    url.pathname.match(/\/forms\/d\/e\/([A-Za-z0-9_-]+)/) ||
    url.pathname.match(/\/forms\/d\/([A-Za-z0-9_-]+)/);
  if (!m || !ID_RE.test(m[1])) {
    throw new FormReadError(
      "invalid_url",
      "تعذر استخراج معرّف النموذج من الرابط. استخدم رابط «إرسال/مشاركة» من Google Forms."
    );
  }
  return { kind: "id", id: m[1] };
}

export function canonicalViewUrl(id: string): string {
  return `https://docs.google.com/forms/d/e/${id}/viewform?usp=sf_link`;
}

// ─── 2) جلب HTML النموذج ────────────────────────────────────────────────────
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

async function resolveShortLink(shortUrl: string): Promise<string> {
  const res = await fetchWithTimeout(shortUrl, 10000);
  const final = res.url || "";
  const m = final.match(/\/forms\/d\/e\/([A-Za-z0-9_-]+)/) || final.match(/\/forms\/d\/([A-Za-z0-9_-]+)/);
  if (!m) {
    throw new FormReadError("not_found", "تعذر تحليل رابط الاختصار — قد يكون النموذج محذوفًا أو الرابط قديمًا.");
  }
  return m[1];
}

async function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  try {
    return await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(ms),
      headers: {
        "User-Agent": UA,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "ar,en;q=0.9,en-US;q=0.8",
        "Cache-Control": "no-cache",
      },
    });
  } catch (err: unknown) {
    const name = err instanceof Error ? err.name : "";
    if (name === "TimeoutError" || name === "AbortError") {
      throw new FormReadError("timeout", "انتهت مهلة الاتصال بخادم Google. تحقق من الشبكة وحاول مجددًا.");
    }
    throw new FormReadError("network", "تعذر الاتصال بخادم Google Forms. تحقق من الشبكة وحاول مجددًا.");
  }
}

// استخرج مصفوفة JS المضمّنة FB_PUBLIC_LOAD_DATA_ من HTML (مع مراعاة النصوص والفواصل)
function extractFbPublicLoadData(html: string): unknown[] | null {
  const marker = "FB_PUBLIC_LOAD_DATA_";
  const mi = html.indexOf(marker);
  if (mi === -1) return null;

  const start = html.indexOf("[", mi);
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let quote = "";
  let escape = false;

  for (let i = start; i < html.length; i++) {
    const ch = html[i];

    if (inString) {
      if (escape) { escape = false; continue; }
      if (ch === "\\") { escape = true; continue; }
      if (ch === quote) { inString = false; }
      continue;
    }
    if (ch === '"' || ch === "'") { inString = true; quote = ch; continue; }
    if (ch === "[") depth++;
    else if (ch === "]") {
      depth--;
      if (depth === 0) {
        const raw = html.slice(start, i + 1);
        try {
          return JSON.parse(raw) as unknown[];
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

// ─── 3) تحليل البنية ────────────────────────────────────────────────────────
// الأكواد الموثقة من المجتمع لأنواع أسئلة Google Forms:
// 0 short · 1 paragraph · 2 راديو(اختيار) · 3 قائمة منسدلة · 4 مربعات اختيار
// 5 مقياس خطي · 7 شبكة اختيار · 8 فاصل قسم / شبكة مربعات · 9 تاريخ · 10 وقت · 18 تقييم
const HAS_OPTIONS_CODES = new Set([2, 3, 4, 5, 7, 8, 18]);

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function optionText(opt: unknown): string {
  const arr = asArray(opt);
  const t = asString(arr[0]);
  return t || "(خيار بالصورة)";
}

function classify(code: number, hasOptions: boolean): FormQuestionType {
  switch (code) {
    case 0: return "short_answer";
    case 1: return "paragraph";
    case 2: return "multiple_choice";
    case 3: return "dropdown";
    case 4: return "checkboxes";
    case 5: return "linear_scale";
    case 7: return hasOptions ? "mc_grid" : "unknown";
    case 8: return hasOptions ? "checkbox_grid" : "unknown"; // الفاصل بلا خيارات يُستبعد مبكرًا
    case 9: return "date";
    case 10: return "time";
    case 18: return hasOptions ? "rating" : "linear_scale";
    default:
      if (hasOptions) return "multiple_choice";
      return "unknown";
  }
}

export interface ReadFormResult {
  form: ParsedForm;
}

export async function readForm(rawUrl: string): Promise<ParsedForm> {
  const input = normalizeFormInput(rawUrl);
  const id = input.kind === "short" ? await resolveShortLink(input.shortUrl!) : input.id!;

  const viewUrl = canonicalViewUrl(id);
  const res = await fetchWithTimeout(viewUrl.replace("?usp=sf_link", "?embedded=true"), 15000);
  const finalUrl = res.url || "";

  if (finalUrl.includes("accounts.google.com") || finalUrl.includes("ServiceLogin")) {
    throw new FormReadError(
      "auth_required",
      "هذا النموذج مقيّد على حسابات محددة — افتحه بحسابك من زر «فتح النموذج» وسجّل دخولك، ثم استخدم أداة الأتمتة المحلية."
    );
  }
  if (!res.ok) {
    throw new FormReadError("not_found", `تعذر الوصول إلى النموذج (HTTP ${res.status}). قد يكون محذوفًا أو الرابط خاطئًا.`);
  }

  const html = await res.text();

  // اكتشاف النماذج المغلقة / التي تتطلب الوصول قبل محاولة التحليل
  const sample = html.slice(0, 60000);
  if (/form is no longer accepting|no longer accepting responses|لم يعد يقبل الردود/i.test(sample)) {
    throw new FormReadError("closed", "هذا النموذج لم يعد يقبل الردود (متوقف).");
  }
  if (/You need access|request access|بحاجة إلى إذن الوصول|Sign in to continue/i.test(sample) && !html.includes("FB_PUBLIC_LOAD_DATA_")) {
    throw new FormReadError(
      "auth_required",
      "النموذج مقيّد على مستخدمين محددين. افتحه بحسابك المصرّح له عبر زر «فتح النموذج» ثم استخدم الأتمتة المحلية بجلستك."
    );
  }

  const fb = extractFbPublicLoadData(html);
  if (!fb) {
    throw new FormReadError(
      "unreadable",
      "تعذر قراءة الأسئلة من الصفحة. قد تكون بنية النموذج غير مدعومة — جرّب فتحه يدويًا للتأكد."
    );
  }

  // بنية Google: fb[1][1] = مصفوفة العناصر · fb[1][8] / fb[1][0] = العنوان
  const top = asArray(fb[1]);
  const items = asArray(top[1]);
  const title =
    (typeof top[8] === "string" && top[8].trim()) ||
    (typeof top[0] === "string" && top[0].trim()) ||
    "Google Form";

  const questions: ParsedQuestion[] = [];
  const sectionTitles: string[] = [];
  let page = 1;
  let order = 0;

  for (const rawItem of items) {
    const item = asArray(rawItem);
    if (!item.length) continue;

    const typeCode = typeof item[3] === "number" ? item[3] : -1;
    const itemTitle = asString(item[1]);
    const qContainer = asArray(item[4]);

    if (typeCode === 8 && qContainer.length === 0) {
      // فاصل قسم / صفحة جديدة
      page += 1;
      if (itemTitle) sectionTitles.push(itemTitle);
      continue;
    }

    const hasOptions = qContainer.some((q) => asArray(asArray(q)[1]).length > 0);
    if (typeCode !== 0 && typeCode !== 1 && typeCode !== 9 && typeCode !== 10 && !HAS_OPTIONS_CODES.has(typeCode) && !hasOptions) {
      continue; // عناصر زخرفية (صور/فيديو بدون سؤال)
    }

    if (!itemTitle && qContainer.length === 0) continue;

    for (const rawQ of qContainer.length ? qContainer : [null]) {
      const q = asArray(rawQ);
      const rawEntry = q[0];
      const entryId =
        typeof rawEntry === "number" ? String(rawEntry) : /^\d+$/.test(asString(rawEntry)) ? asString(rawEntry) : null;
      const options = asArray(q[1]).map(optionText).filter(Boolean);
      const restLabels = options.map((o) => o.toLowerCase());
      const hasOther = restLabels.some((o) => o === "other" || o === "other:" || o.startsWith("other") || o.includes("أخرى"));

      const rowTitle = asString(q[3]) || itemTitle || "سؤال بدون عنوان";
      const qType = classify(typeCode, options.length > 0);
      if (qType === "unknown" && options.length === 0 && typeCode !== 0 && typeCode !== 1 && typeCode !== 9 && typeCode !== 10) {
        continue; // نوع غير مدعوم تمامًا — تجاهله بدل عرضه كـ «سؤال» زائف
      }

      order += 1;
      questions.push({
        index: order,
        itemId: typeof item[0] === "number" ? item[0] : null,
        entryId,
        title: rowTitle,
        type: qType === "unknown" ? "short_answer" : qType,
        typeCode,
        options,
        hasOther,
        page,
      });
    }
  }

  if (questions.length === 0) {
    throw new FormReadError(
      "unreadable",
      "تم فتح النموذج لكن لم يُعثر على أسئلة قابلة للإجابة. قد يكون نموذج تسجيل فقط — افتحه يدويًا للتحقق."
    );
  }

  return {
    id,
    title: title as string,
    viewUrl,
    answerUrl: `https://docs.google.com/forms/d/e/${id}/formResponse`,
    questions,
    sectionTitles,
    totalItems: items.length,
    answerableCount: questions.length,
  };
}

// ─── 4) تطبيع النص للمطابقة الضبابية (يُستخدم من المحرك والتعبئة) ───────────
export function normalizeArabicLatin(s: string): string {
  return s
    .toLowerCase()
    .replace(/[ً-ٰٟ]/g, "") // تشكيل عربي
    .replace(/ـ/g, "") // تطويل
    .replace(/[إأآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[“”"'`«»()[\]{}.,;:!?؟،؛.\-–—_/\\|&@#*+=<>~^%$]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// أفضل تطابق تقريبي بين إجابة نصية وخيارات السؤال
export function bestOptionMatch(answer: string, options: string[]): { option: string | null; score: number } {
  if (!options.length) return { option: null, score: 0 };
  const na = normalizeArabicLatin(answer);
  if (!na) return { option: null, score: 0 };

  let best: { option: string | null; score: number } = { option: null, score: 0 };
  const aTokens = new Set(na.split(" ").filter((t) => t.length > 1));

  for (const opt of options) {
    const no = normalizeArabicLatin(opt);
    if (!no) continue;
    if (no === na) return { option: opt, score: 1 };
    if (na.includes(no) || no.includes(na)) {
      const s = Math.min(no.length, na.length) / Math.max(no.length, na.length);
      if (s > best.score) best = { option: opt, score: Math.max(0.8, s) };
      continue;
    }
    const oTokens = new Set(no.split(" ").filter((t) => t.length > 1));
    let inter = 0;
    aTokens.forEach((t) => { if (oTokens.has(t)) inter++; });
    const union = new Set([...aTokens, ...oTokens]).size || 1;
    const jaccard = inter / union;
    if (jaccard > best.score) best = { option: opt, score: jaccard };
  }
  return best;
}

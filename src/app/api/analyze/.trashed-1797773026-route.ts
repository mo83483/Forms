import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { readForm, FormReadError } from "@/lib/forms/parser";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/analyze — التحقق من رابط النموذج وقراءة أسئلته (بدون AI)
export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ ok: false, error: { code: "unauthorized", message: "سجّل الدخول أولًا." } }, { status: 401 });

  let body: { url?: string };
  try { body = await req.json(); } catch { body = {}; }

  const url = (body.url ?? "").toString().trim();
  if (!url) return NextResponse.json({ ok: false, error: { code: "invalid_url", message: "أرسِل رابط النموذج." } }, { status: 400 });

  try {
    const form = await readForm(url);
    return NextResponse.json({ ok: true, form });
  } catch (err) {
    if (err instanceof FormReadError) {
      const status = err.code === "auth_required" ? 403 : err.code === "invalid_url" || err.code === "untrusted_host" ? 400 : 502;
      return NextResponse.json({ ok: false, error: { code: err.code, message: err.message } }, { status });
    }
    console.error("[analyze] unexpected:", err);
    return NextResponse.json({ ok: false, error: { code: "unknown", message: "خطأ غير متوقع أثناء قراءة النموذج." } }, { status: 500 });
  }
}

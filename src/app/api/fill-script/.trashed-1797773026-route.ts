import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { buildLocalFillScript, type FillAnswerPayload } from "@/lib/automation/local-script";

export const dynamic = "force-dynamic";

// POST /api/fill-script — يولّد سكربت .mjs يعمل على جهاز المستخدم بجلسة Chrome
export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  let body: { url?: string; answers?: FillAnswerPayload[] } = {};
  try { body = await req.json(); } catch { /* noop */ }

  const url = (body.url ?? "").toString().trim();
  const answers = Array.isArray(body.answers) ? body.answers : [];
  if (!url.startsWith("https://docs.google.com/forms") && !url.startsWith("https://forms.gle/")) {
    return NextResponse.json({ ok: false, error: "رابط غير موثوق — يجب أن يكون رابط Google Forms." }, { status: 400 });
  }

  const script = buildLocalFillScript(url, answers);
  return new NextResponse(script, {
    status: 200,
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Content-Disposition": 'attachment; filename="ai-form-solver-fill.mjs"',
      "Cache-Control": "no-store",
    },
  });
}

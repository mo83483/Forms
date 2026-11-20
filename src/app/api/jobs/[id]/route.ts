import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getJob, requestCancel } from "@/lib/jobs";
import { abortJob } from "@/lib/controllers";

export const dynamic = "force-dynamic";

// GET /api/jobs/[id]?action=snapshot — الحالة الكاملة
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const { id } = await ctx.params;
  const job = getJob(id);
  if (!job) return NextResponse.json({ ok: false, error: "job not found or expired" }, { status: 404 });
  return NextResponse.json({ ok: true, job: job.snapshot() });
}

// POST /api/jobs/[id] { action: "cancel" } — إيقاف فوري
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const { id } = await ctx.params;

  let body: { action?: string } = {};
  try { body = await req.json(); } catch { /* noop */ }

  if (body.action === "cancel") {
    const job = getJob(id);
    if (!job) return NextResponse.json({ ok: false, error: "job not found" }, { status: 404 });
    const ok = requestCancel(id);
    abortJob(id);
    return NextResponse.json({ ok });
  }
  return NextResponse.json({ ok: false, error: "unknown action" }, { status: 400 });
}

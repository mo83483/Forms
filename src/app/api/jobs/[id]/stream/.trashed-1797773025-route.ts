import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { getJob } from "@/lib/jobs";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// GET /api/jobs/[id]/stream — بث حي للتقدم والسجلات (SSE)
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user) return new Response("unauthorized", { status: 401 });
  const { id } = await ctx.params;
  const job = getJob(id);
  if (!job) return new Response("job not found", { status: 404 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          closed = true;
        }
      };

      send("snapshot", job.snapshot());

      const unsubscribe = job.subscribe((snap) => {
        send("snapshot", snap);
        if (snap.status !== "running") {
          send("done", snap);
          cleanup();
        }
      });

      const heartbeat = setInterval(() => {
        if (job.status === "running") send("ping", { t: Date.now() });
      }, 15000);

      const cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
        try { controller.close(); } catch { /* already closed */ }
      };

      req.signal.addEventListener("abort", cleanup);

      // أمان: أغلق بعد 5 دقائق كحد أقصى
      setTimeout(cleanup, 5 * 60 * 1000);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
      Connection: "keep-alive",
    },
  });
}

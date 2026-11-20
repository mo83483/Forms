import { NextResponse } from "next/server";
import { getSession, googleOAuthConfigured } from "@/lib/session";
import { providerStatus } from "@/lib/ai/engine";

export const dynamic = "force-dynamic";

// GET /api/status — قدرات البيئة الحالية للوحة التحكم (لا أسرار تُكشف)
export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const providers = providerStatus();
  return NextResponse.json({
    ok: true,
    googleOAuth: googleOAuthConfigured(),
    demoMode: !googleOAuthConfigured(),
    ai: {
      apinexConfigured: providers.apinex.configured,
      apinexModel: providers.apinex.model,
      geminiConfigured: providers.gemini.configured,
      geminiModel: providers.gemini.model,
      openrouterConfigured: providers.openrouter.configured,
      pollinations: "free-no-key",
      order: ["apinex", "gemini", "openrouter", "pollinations", "heuristic"].filter((p) =>
        p === "apinex"
          ? providers.apinex.configured
          : p === "gemini"
            ? providers.gemini.configured
            : p === "openrouter"
              ? providers.openrouter.configured
              : true
      ),
    },
    automation: {
      serverPlaywright: {
        module: true,
        note: "يتطلب متصفح Chromium مثبتًا على الخادم (npx playwright-core install chromium) — يعمل للنماذج العامة",
      },
      localScript: {
        available: true,
        note: "الأفضل: سكربت محلي يعمل بجلسة Chrome الخاصة بك — يفعّل Autosave الحقيقي",
      },
    },
    storage: "no-database · sessions are cookie-based, jobs live in memory only",
  });
}

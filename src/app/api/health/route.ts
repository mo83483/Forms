import { NextResponse } from "next/server";
import { googleOAuthConfigured } from "@/lib/session";
import { providerStatus } from "@/lib/ai/engine";

export const dynamic = "force-dynamic";

// GET /api/health — فحص صحة الخدمة (بلا قاعدة بيانات عمدًا)
export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "AI Form Solver",
    version: "1.0.0",
    time: new Date().toISOString(),
    database: "none (by design)",
    checks: {
      googleOAuth: googleOAuthConfigured() ? "configured" : "demo-mode",
      aiProviders: providerStatus(),
      automation: "playwright-core module ready; Chromium binary required on host for server-side fill",
    },
  });
}

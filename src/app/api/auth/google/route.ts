import { NextRequest, NextResponse } from "next/server";
import { googleOAuthConfigured, googleAuthUrl, newOAuthState, demoProfile, createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";

export const dynamic = "force-dynamic";

// GET /api/auth/google — يبدأ تدفق تسجيل الدخول
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;

  if (!googleOAuthConfigured()) {
    // OAuth غير مضبوط بعد → وضع تجريبي واضح (بدون كلمات مرور)
    const token = createSessionToken(demoProfile());
    const res = NextResponse.redirect(new URL("/dashboard?welcome=demo", origin));
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    return res;
  }

  const state = newOAuthState();
  const res = NextResponse.redirect(googleAuthUrl(origin, state));
  res.cookies.set("afs_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });
  return res;
}

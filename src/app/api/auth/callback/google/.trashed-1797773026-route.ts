import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForProfile, createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";

export const dynamic = "force-dynamic";

// GET /api/auth/callback/google — Google يُعيد المستخدم إلى هنا بعد الموافقة
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const url = req.nextUrl;
  const error = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const savedState = req.cookies.get("afs_oauth_state")?.value;

  const fail = (reason: string) =>
    NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(reason)}`, origin));

  if (error) return fail("أُلغيت عملية تسجيل الدخول من Google.");
  if (!code) return fail("لم يصل رمز التفويض من Google.");
  if (!savedState || !state || savedState !== state) {
    return fail("رمز الحماية (state) غير مطابق — أعد المحاولة.");
  }

  try {
    const profile = await exchangeCodeForProfile(code, origin);
    const token = createSessionToken({ ...profile, demo: false });
    const res = NextResponse.redirect(new URL("/dashboard?welcome=google", origin));
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    res.cookies.set("afs_oauth_state", "", { path: "/", maxAge: 0 });
    return res;
  } catch (err) {
    console.error("[auth] google callback failed:", err);
    return fail("تعذر إتمام تسجيل الدخول عبر Google. تحقق من إعدادات OAuth في Google Cloud Console.");
  }
}

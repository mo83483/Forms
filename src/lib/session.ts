// ─────────────────────────────────────────────────────────────────────────────
// AI Form Solver — جلسات آمنة بدون قاعدة بيانات ولا مكتبات خارجية
// تذكرة الجلسة = payload موقّع بـ HMAC-SHA256 (httpOnly, SameSite=Lax, 7 أيام)
// رهن أمان: رموز Google نفسها لا تُخزَّن ولا تصل للواجهة أبدًا — تُستخدم
// لحظيًا فقط لجلب بيانات الملف الشخصي ثم تُرمى.
// ─────────────────────────────────────────────────────────────────────────────

import { createHmac, timingSafeEqual, randomBytes } from "crypto";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "afs_session";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 أيام

export interface SessionUser {
  sub: string;
  name: string;
  email: string;
  picture?: string;
  demo: boolean;
}

interface Payload extends SessionUser {
  iat: number;
  exp: number;
}

function secret(): string {
  return process.env.SESSION_SECRET || process.env.NEXTAUTH_SECRET || "afs-dev-secret-change-me-in-production";
}

const b64url = (buf: Buffer | string) =>
  Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");

const fromB64url = (s: string) => Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");

function sign(data: string): string {
  return b64url(createHmac("sha256", secret()).update(data).digest());
}

export function createSessionToken(user: SessionUser): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: Payload = { ...user, iat: now, exp: now + MAX_AGE };
  const body = b64url(JSON.stringify(payload));
  return `${body}.${sign(body)}`;
}

export function verifySessionToken(token: string): SessionUser | null {
  const dot = token.lastIndexOf(".");
  if (dot === -1) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = sign(body);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const payload = JSON.parse(fromB64url(body).toString("utf8")) as Payload;
    if (typeof payload.exp !== "number" || payload.exp * 1000 < Date.now()) return null;
    if (!payload.email) return null;
    return { sub: payload.sub, name: payload.name, email: payload.email, picture: payload.picture, demo: !!payload.demo };
  } catch {
    return null;
  }
}

// للاستخدام داخل Route Handlers / Server Components
export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  return verifySessionToken(raw);
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  };
}

// ─── Google OAuth ────────────────────────────────────────────────────────────
export function googleOAuthConfigured(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function googleAuthUrl(origin: string, state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: `${origin}/api/auth/callback/google`,
    response_type: "code",
    scope: "openid email profile", // لا صلاحيات إضافية عمداً
    access_type: "online",
    include_granted_scopes: "false",
    prompt: "select_account",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export function newOAuthState(): string {
  return b64url(randomBytes(24));
}

export interface GoogleProfile {
  sub: string;
  name: string;
  email: string;
  picture?: string;
}

export async function exchangeCodeForProfile(code: string, origin: string): Promise<GoogleProfile> {
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: `${origin}/api/auth/callback/google`,
      grant_type: "authorization_code",
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!tokenRes.ok) {
    throw new Error(`Google token exchange failed: HTTP ${tokenRes.status}`);
  }
  const token = (await tokenRes.json()) as { access_token?: string };
  if (!token.access_token) throw new Error("Google لم يُرجع access_token");

  // جلب الملف الشخصي ثم التخلص من access_token — لا يُخزَّن أبدًا
  const profileRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${token.access_token}` },
    signal: AbortSignal.timeout(15000),
  });
  if (!profileRes.ok) throw new Error(`Google userinfo failed: HTTP ${profileRes.status}`);
  const p = (await profileRes.json()) as { sub?: string; name?: string; email?: string; picture?: string };
  if (!p.sub || !p.email) throw new Error("Google لم يُرجع بيانات الملف الشخصي");
  return { sub: p.sub, name: p.name || p.email.split("@")[0], email: p.email, picture: p.picture };
}

// حساب تجريبي يُستخدم فقط عندما لا تُضبط مفاتيح Google بعد (موثّق في الواجهة)
export function demoProfile(): SessionUser {
  return {
    sub: "demo-user",
    name: "مستخدم تجريبي",
    email: "demo@aiformsolver.app",
    picture: undefined,
    demo: true,
  };
}

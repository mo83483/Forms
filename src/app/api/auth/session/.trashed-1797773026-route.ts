import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

// GET /api/auth/session — بيانات الجلسة الحالية (آمنة — بلا رموز)
export async function GET() {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  return NextResponse.json({
    authenticated: true,
    user: { name: user.name, email: user.email, picture: user.picture ?? null, demo: user.demo },
  });
}

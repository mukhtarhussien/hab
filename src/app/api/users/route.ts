import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSession, SESSION_COOKIE } from "@/lib/auth-server";
import { ensureSchema, getSql } from "@/lib/db";


export async function GET() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ error: "سجّل دخولك أولاً." }, { status: 401 });
  try {
    const session = await getSession(token);
    if (!session) return NextResponse.json({ error: "انتهت جلسة الدخول." }, { status: 401 });
    await ensureSchema();
    const users = await getSql()`SELECT id::text AS id, username FROM users WHERE id <> ${session.id} ORDER BY username`;
    return NextResponse.json({ users });
  } catch (error) {
    console.error("User list query failed:", error);
    return NextResponse.json({ error: "تعذّر تحميل الحسابات." }, { status: 503 });
  }
}

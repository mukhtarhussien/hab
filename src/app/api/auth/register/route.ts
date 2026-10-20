import { NextResponse } from "next/server";
import { createSession, makePasswordHash, SESSION_COOKIE } from "@/lib/auth-server";
import { ensureSchema, getSql } from "@/lib/db";


export async function POST(request: Request) {
  try {
    const { username: rawUsername, password } = await request.json();
    const username = typeof rawUsername === "string" ? rawUsername.trim().toLowerCase() : "";
    if (!/^[a-z0-9_]{3,32}$/.test(username) || typeof password !== "string" || password.length < 10 || password.length > 200) {
      return NextResponse.json({ error: "استخدم اسماً من 3 إلى 32 حرفاً إنجليزياً أو رقماً، وكلمة مرور من 10 أحرف على الأقل." }, { status: 400 });
    }
    await ensureSchema();
    const sql = getSql();
    const passwordHash = await makePasswordHash(password);
    const inserted = await sql`INSERT INTO users (username, password_hash)
      VALUES (${username}, ${passwordHash}) ON CONFLICT (username) DO NOTHING RETURNING id, username`;
    if (!inserted[0]) return NextResponse.json({ error: "اسم المستخدم مستخدم من قبل." }, { status: 409 });
    const session = await createSession(String(inserted[0].id));
    const response = NextResponse.json({ user: { id: String(inserted[0].id), username: inserted[0].username } }, { status: 201 });
    response.cookies.set(SESSION_COOKIE, session.token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", expires: session.expiresAt });
    return response;
  } catch (error) {
    console.error("Account registration failed:", error);
    return NextResponse.json({ error: process.env.DATABASE_URL ? "تعذّر إنشاء الحساب حالياً." : "إعداد DATABASE_URL مطلوب لتفعيل الحسابات." }, { status: 503 });
  }
}

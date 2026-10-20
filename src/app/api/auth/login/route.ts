import { NextResponse } from "next/server";
import { createSession, verifyPassword, SESSION_COOKIE } from "@/lib/auth-server";
import { ensureSchema, getSql } from "@/lib/db";


export async function POST(request: Request) {
  try {
    const { username: rawUsername, password } = await request.json();
    const username = typeof rawUsername === "string" ? rawUsername.trim().toLowerCase() : "";
    if (!username || typeof password !== "string") return NextResponse.json({ error: "أدخل اسم المستخدم وكلمة المرور." }, { status: 400 });
    await ensureSchema();
    const sql = getSql();
    const rows = await sql`SELECT id, username, password_hash FROM users WHERE username = ${username} LIMIT 1`;
    const user = rows[0];
    if (!user || !(await verifyPassword(password, String(user.password_hash)))) {
      return NextResponse.json({ error: "اسم المستخدم أو كلمة المرور غير صحيحة." }, { status: 401 });
    }
    const session = await createSession(String(user.id));
    const response = NextResponse.json({ user: { id: String(user.id), username: user.username } });
    response.cookies.set(SESSION_COOKIE, session.token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", expires: session.expiresAt });
    return response;
  } catch (error) {
    console.error("Login failed:", error);
    return NextResponse.json({ error: process.env.DATABASE_URL ? "تعذّر تسجيل الدخول حالياً." : "إعداد DATABASE_URL مطلوب لتفعيل الحسابات." }, { status: 503 });
  }
}

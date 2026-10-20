import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSession, SESSION_COOKIE } from "@/lib/auth-server";


export async function GET() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ user: null });
  try {
    const user = await getSession(token);
    return NextResponse.json({ user: user ? { id: String(user.id), username: user.username } : null });
  } catch (error) {
    console.error("Session lookup failed:", error);
    return NextResponse.json({ error: "تعذّر التحقق من الجلسة." }, { status: 503 });
  }
}

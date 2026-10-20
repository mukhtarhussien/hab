import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { hashToken, SESSION_COOKIE } from "@/lib/auth-server";
import { getSql } from "@/lib/db";


export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    try {
      await getSql()`DELETE FROM sessions WHERE token_hash = ${hashToken(token)}`;
    } catch (error) {
      console.error("Logout session cleanup failed:", error);
    }
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
  return response;
}

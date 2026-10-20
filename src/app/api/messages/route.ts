import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSession, SESSION_COOKIE } from "@/lib/auth-server";
import { ensureSchema, getSql } from "@/lib/db";


async function authenticatedUser() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? getSession(token) : null;
}

export async function GET(request: Request) {
  try {
    const user = await authenticatedUser();
    if (!user) return NextResponse.json({ error: "سجّل دخولك أولاً." }, { status: 401 });
    const recipientId = new URL(request.url).searchParams.get("with");
    if (!recipientId || !/^\d+$/.test(recipientId)) return NextResponse.json({ error: "المحادثة المطلوبة غير صالحة." }, { status: 400 });
    await ensureSchema();
    const messages = await getSql()`SELECT id::text AS id, sender_id::text AS "senderId", recipient_id::text AS "recipientId", body AS text, created_at AS "createdAt"
      FROM messages WHERE (sender_id = ${user.id} AND recipient_id = ${recipientId})
      OR (sender_id = ${recipientId} AND recipient_id = ${user.id}) ORDER BY created_at ASC, id ASC`;
    return NextResponse.json({ messages });
  } catch (error) {
    console.error("Message query failed:", error);
    return NextResponse.json({ error: "تعذّر تحميل الرسائل." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await authenticatedUser();
    if (!user) return NextResponse.json({ error: "سجّل دخولك أولاً." }, { status: 401 });
    const { recipientId, text: rawText } = await request.json();
    const text = typeof rawText === "string" ? rawText.trim() : "";
    if (!/^\d+$/.test(String(recipientId ?? "")) || String(recipientId) === String(user.id) || !text || text.length > 10000) {
      return NextResponse.json({ error: "الرسالة أو المستلم غير صالح." }, { status: 400 });
    }
    await ensureSchema();
    const rows = await getSql()`INSERT INTO messages (sender_id, recipient_id, body)
      SELECT ${user.id}, id, ${text} FROM users WHERE id = ${recipientId}
      RETURNING id::text AS id, sender_id::text AS "senderId", recipient_id::text AS "recipientId", body AS text, created_at AS "createdAt"`;
    if (!rows[0]) return NextResponse.json({ error: "هذا الحساب غير موجود." }, { status: 404 });
    return NextResponse.json({ message: rows[0] }, { status: 201 });
  } catch (error) {
    console.error("Message insert failed:", error);
    return NextResponse.json({ error: "تعذّر إرسال الرسالة." }, { status: 503 });
  }
}

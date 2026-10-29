
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSession, SESSION_COOKIE } from "@/lib/auth-server";
import { ensureSchema, getSql } from "@/lib/db";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

async function authenticatedUser() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? getSession(token) : null;
}

export async function GET(request: Request) {
  try {
    const user = await authenticatedUser();

    if (!user) {
      return NextResponse.json(
        { error: "سجّل دخولك أولاً." },
        { status: 401 }
      );
    }

    const recipientId = new URL(request.url).searchParams.get("with");

    if (!recipientId || !UUID_RE.test(recipientId)) {
      return NextResponse.json(
        { error: "المحادثة المطلوبة غير صالحة." },
        { status: 400 }
      );
    }

    await ensureSchema();

    const messages = await getSql()`
      SELECT
        id::text AS id,
        sender_id::text AS "senderId",
        recipient_id::text AS "recipientId",
        body AS text,
        attachment_url AS "attachmentUrl",
        attachment_type AS "attachmentType",
        attachment_name AS "attachmentName",
        attachment_size AS "attachmentSize",
        created_at AS "createdAt"
      FROM messages
      WHERE
        (sender_id = ${user.id} AND recipient_id = ${recipientId})
        OR
        (sender_id = ${recipientId} AND recipient_id = ${user.id})
      ORDER BY created_at ASC, id ASC
    `;

    return NextResponse.json({ messages });
  } catch (error) {
    console.error("Message query failed:", error);

    return NextResponse.json(
      { error: "تعذّر تحميل الرسائل." },
      { status: 503 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await authenticatedUser();

    if (!user) {
      return NextResponse.json(
        { error: "سجّل دخولك أولاً." },
        { status: 401 }
      );
    }

    const payload = await request.json();

    const recipientId = payload?.recipientId;
    const text =
      typeof payload?.text === "string"
        ? payload.text.trim()
        : "";

    const attachmentUrl =
      typeof payload?.attachmentUrl === "string"
        ? payload.attachmentUrl
        : null;

    const attachmentType =
      typeof payload?.attachmentType === "string"
        ? payload.attachmentType
        : null;

    const attachmentName =
      typeof payload?.attachmentName === "string"
        ? payload.attachmentName.slice(0, 180)
        : null;

    const attachmentSize = Number(payload?.attachmentSize);
    const hasAttachment = Boolean(attachmentUrl);

    if (
      !UUID_RE.test(String(recipientId ?? "")) ||
      String(recipientId) === String(user.id) ||
      (!text && !hasAttachment) ||
      text.length > 10000
    ) {
      return NextResponse.json(
        { error: "الرسالة أو المستلم غير صالح." },
        { status: 400 }
      );
    }

    if (hasAttachment) {
      let url: URL;

      try {
        url = new URL(attachmentUrl!);
      } catch {
        return NextResponse.json(
          { error: "رابط الصورة غير صالح." },
          { status: 400 }
        );
      }

      if (
        url.protocol !== "https:" ||
        !url.hostname.endsWith(".public.blob.vercel-storage.com") ||
        !IMAGE_TYPES.has(attachmentType ?? "") ||
        !Number.isSafeInteger(attachmentSize) ||
        attachmentSize < 1 ||
        attachmentSize > 5 * 1024 * 1024
      ) {
        return NextResponse.json(
          { error: "بيانات الصورة غير صالحة." },
          { status: 400 }
        );
      }
    }

    await ensureSchema();

    const rows = await getSql()`
      INSERT INTO messages (
        sender_id,
        recipient_id,
        body,
        attachment_url,
        attachment_type,
        attachment_name,
        attachment_size
      )
      SELECT
        ${user.id},
        id,
        ${text},
        ${attachmentUrl},
        ${attachmentType},
        ${attachmentName},
        ${hasAttachment ? attachmentSize : null}
      FROM users
      WHERE id = ${recipientId}
      RETURNING
        id::text AS id,
        sender_id::text AS "senderId",
        recipient_id::text AS "recipientId",
        body AS text,
        attachment_url AS "attachmentUrl",
        attachment_type AS "attachmentType",
        attachment_name AS "attachmentName",
        attachment_size AS "attachmentSize",
        created_at AS "createdAt"
    `;

    if (!rows[0]) {
      return NextResponse.json(
        { error: "هذا الحساب غير موجود." },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { message: rows[0] },
      { status: 201 }
    );
  } catch (error) {
    console.error("Message insert failed:", error);

    return NextResponse.json(
      { error: "تعذّر إرسال الرسالة." },
      { status: 503 }
    );
  }
}

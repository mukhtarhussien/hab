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
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

async function authenticatedUser() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? getSession(token) : null;
}

export async function GET(request: Request) {
  try {
    const user = await authenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "سجّل دخولك أولاً." }, { status: 401 });
    }

    const requestUrl = new URL(request.url);
    const imageId = requestUrl.searchParams.get("image");
    await ensureSchema();

    if (imageId) {
      if (!UUID_RE.test(imageId)) {
        return NextResponse.json({ error: "الصورة المطلوبة غير صالحة." }, { status: 400 });
      }

      const images = await getSql()`
        SELECT attachment_data AS data, attachment_type AS type
        FROM messages
        WHERE id = ${imageId}
          AND attachment_data IS NOT NULL
          AND (sender_id = ${user.id} OR recipient_id = ${user.id})
        LIMIT 1
      `;
      const image = images[0];
      if (!image) {
        return NextResponse.json({ error: "الصورة غير موجودة." }, { status: 404 });
      }

      return new Response(Buffer.from(String(image.data), "base64"), {
        headers: {
          "Content-Type": String(image.type),
          "Cache-Control": "private, max-age=3600",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }

    const recipientId = requestUrl.searchParams.get("with");
    if (!recipientId || !UUID_RE.test(recipientId)) {
      return NextResponse.json({ error: "المحادثة المطلوبة غير صالحة." }, { status: 400 });
    }

    const messages = await getSql()`
      SELECT
        id::text AS id,
        sender_id::text AS "senderId",
        recipient_id::text AS "recipientId",
        body AS text,
        CASE WHEN attachment_data IS NOT NULL
          THEN '/api/messages?image=' || id::text
          ELSE attachment_url
        END AS "attachmentUrl",
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
    return NextResponse.json({ error: "تعذّر تحميل الرسائل." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await authenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "سجّل دخولك أولاً." }, { status: 401 });
    }

    let recipientId: unknown;
    let rawText: unknown;
    let image: File | null = null;

    if ((request.headers.get("content-type") ?? "").includes("multipart/form-data")) {
      const form = await request.formData();
      recipientId = form.get("recipientId");
      rawText = form.get("text");
      const file = form.get("file");
      image = file instanceof File && file.size > 0 ? file : null;
    } else {
      const payload = (await request.json()) as { recipientId?: unknown; text?: unknown };
      recipientId = payload.recipientId;
      rawText = payload.text;
    }

    const text = typeof rawText === "string" ? rawText.trim() : "";
    const attachmentType = image?.type ?? null;
    const attachmentName = image?.name.slice(0, 180) ?? null;
    const attachmentSize = image?.size ?? null;

    if (
      typeof recipientId !== "string" ||
      !UUID_RE.test(recipientId) ||
      recipientId === String(user.id) ||
      (!text && !image) ||
      text.length > 10000
    ) {
      return NextResponse.json({ error: "الرسالة أو المستلم غير صالح." }, { status: 400 });
    }

    if (image && (!IMAGE_TYPES.has(image.type) || image.size > MAX_IMAGE_SIZE)) {
      return NextResponse.json(
        { error: "اختر صورة JPG أو PNG أو WebP أو GIF بحجم لا يتجاوز 5 MB." },
        { status: 415 }
      );
    }

    const attachmentData = image
      ? Buffer.from(await image.arrayBuffer()).toString("base64")
      : null;

    await ensureSchema();
    const rows = await getSql()`
      INSERT INTO messages (
        sender_id,
        recipient_id,
        body,
        attachment_url,
        attachment_type,
        attachment_name,
        attachment_size,
        attachment_data
      )
      SELECT
        ${user.id},
        id,
        ${text},
        ${null},
        ${attachmentType},
        ${attachmentName},
        ${attachmentSize},
        ${attachmentData}
      FROM users
      WHERE id = ${recipientId}
      RETURNING
        id::text AS id,
        sender_id::text AS "senderId",
        recipient_id::text AS "recipientId",
        body AS text,
        CASE WHEN attachment_data IS NOT NULL
          THEN '/api/messages?image=' || id::text
          ELSE attachment_url
        END AS "attachmentUrl",
        attachment_type AS "attachmentType",
        attachment_name AS "attachmentName",
        attachment_size AS "attachmentSize",
        created_at AS "createdAt"
    `;

    if (!rows[0]) {
      return NextResponse.json({ error: "هذا الحساب غير موجود." }, { status: 404 });
    }

    return NextResponse.json({ message: rows[0] }, { status: 201 });
  } catch (error) {
    console.error("Message insert failed:", error);
    return NextResponse.json({ error: "تعذّر إرسال الرسالة." }, { status: 503 });
  }
}

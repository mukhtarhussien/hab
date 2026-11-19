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
        SELECT encode(image.image_data, 'base64') AS data, image.mime_type AS type
        FROM message_images AS image
        JOIN messages AS message ON message.id = image.message_id
        WHERE message.id = ${imageId}
          AND (message.sender_id = ${user.id} OR message.recipient_id = ${user.id})
        LIMIT 1
      `;
      const image = images[0];
      if (!image) {
        return NextResponse.json({ error: "الصورة غير موجودة." }, { status: 404 });
      }

      return new Response(Buffer.from(String(image.data), "base64"), {
        headers: {
          "Content-Type": String(image.type),
          "Cache-Control": "private, no-store",
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
        messages.id::text AS id,
        messages.sender_id::text AS "senderId",
        messages.recipient_id::text AS "recipientId",
        messages.body AS text,
        CASE WHEN image.message_id IS NOT NULL
          THEN '/api/messages?image=' || messages.id::text
          ELSE NULL
        END AS "attachmentUrl",
        image.mime_type AS "attachmentType",
        image.file_name AS "attachmentName",
        image.file_size AS "attachmentSize",
        messages.created_at AS "createdAt"
      FROM messages
      LEFT JOIN message_images AS image ON image.message_id = messages.id
      WHERE
        (sender_id = ${user.id} AND recipient_id = ${recipientId})
        OR
        (sender_id = ${recipientId} AND recipient_id = ${user.id})
      ORDER BY messages.created_at ASC, messages.id ASC
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
      WITH new_message AS (
        INSERT INTO messages (sender_id, recipient_id, body)
        SELECT ${user.id}, id, ${text}
        FROM users
        WHERE id = ${recipientId}
        RETURNING
          id,
          sender_id,
          recipient_id,
          body,
          created_at
      ), new_image AS (
        INSERT INTO message_images (
          message_id,
          image_data,
          mime_type,
          file_name,
          file_size
        )
        SELECT
          id,
          decode(${attachmentData}, 'base64'),
          ${attachmentType},
          ${attachmentName},
          ${attachmentSize}
        FROM new_message
        WHERE ${Boolean(image)}
        RETURNING message_id
      )
      SELECT
        message.id::text AS id,
        message.sender_id::text AS "senderId",
        message.recipient_id::text AS "recipientId",
        message.body AS text,
        CASE WHEN image.message_id IS NOT NULL
          THEN '/api/messages?image=' || message.id::text
          ELSE NULL
        END AS "attachmentUrl",
        CASE WHEN image.message_id IS NOT NULL THEN ${attachmentType} ELSE NULL END AS "attachmentType",
        CASE WHEN image.message_id IS NOT NULL THEN ${attachmentName} ELSE NULL END AS "attachmentName",
        CASE WHEN image.message_id IS NOT NULL THEN ${attachmentSize} ELSE NULL END AS "attachmentSize",
        message.created_at AS "createdAt"
      FROM new_message AS message
      LEFT JOIN new_image AS image ON image.message_id = message.id
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

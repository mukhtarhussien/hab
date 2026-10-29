
import { put } from "@vercel/blob";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSession, SESSION_COOKIE } from "@/lib/auth-server";

export const runtime = "nodejs";

const MAX_SIZE = 5 * 1024 * 1024;
const TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export async function POST(request: Request) {
  try {
    const token = (await cookies()).get(SESSION_COOKIE)?.value;
    const user = token ? await getSession(token) : null;

    if (!user) {
      return NextResponse.json(
        { error: "سجّل دخولك أولاً." },
        { status: 401 }
      );
    }

    const form = await request.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "اختر صورة أولاً." },
        { status: 400 }
      );
    }

    if (!TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "صيغة الصورة غير مدعومة." },
        { status: 415 }
      );
    }

    if (file.size < 1 || file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "الحد الأقصى لحجم الصورة هو 5 MB." },
        { status: 413 }
      );
    }

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json(
        { error: "تخزين الصور غير مهيأ." },
        { status: 503 }
      );
    }

    const extension =
      file.type === "image/jpeg"
        ? "jpg"
        : file.type.split("/")[1];

    const blob = await put(
      `chat-images/${user.id}/${randomUUID()}.${extension}`,
      file,
      {
        access: "public",
        addRandomSuffix: false,
        contentType: file.type,
      }
    );

    return NextResponse.json(
      {
        url: blob.url,
        contentType: file.type,
        name: file.name.slice(0, 180),
        size: file.size,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Image upload failed:", error);

    return NextResponse.json(
      { error: "تعذّر رفع الصورة." },
      { status: 503 }
    );
  }
}

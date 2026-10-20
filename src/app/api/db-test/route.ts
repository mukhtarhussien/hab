import { connection, NextResponse } from "next/server";
import { ensureSchema, getSql } from "@/lib/db";


export async function GET() {
  await connection();
  try {
    await ensureSchema();
    const rows = await getSql()`SELECT NOW() AS server_time`;
    return NextResponse.json({ connected: true, serverTime: rows[0].server_time });
  } catch (error) {
    console.error("Neon connection failed:", error);
    return NextResponse.json({ connected: false, error: process.env.DATABASE_URL ? "Database connection failed" : "DATABASE_URL is not configured" }, { status: 503 });
  }
}

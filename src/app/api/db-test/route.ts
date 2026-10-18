import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    const result = await sql`SELECT NOW() AS server_time`;

    return NextResponse.json({
      connected: true,
      serverTime: result[0].server_time,
    });
  } catch (error) {
    console.error("Neon connection failed:", error);

    return NextResponse.json(
      { connected: false, error: "Database connection failed" },
      { status: 500 }
    );
  }
}

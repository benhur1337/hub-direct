import { NextRequest, NextResponse } from "next/server";
import { publishDue } from "@/lib/publish";
import { same } from "@/lib/auth";

export const maxDuration = 300;

// Vercel Cron sends `Authorization: Bearer $CRON_SECRET`.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !same(req.headers.get("authorization") ?? "", "Bearer " + secret))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Without Meta configured nothing can publish; skip the query so Neon can scale to zero.
  if (!process.env.META_APP_ID) return NextResponse.json({ processed: 0 });
  return NextResponse.json({ processed: await publishDue() });
}

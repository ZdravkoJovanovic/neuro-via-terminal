import { NextResponse } from "next/server";
import { fetchQuickCheckJSON } from "@/app/lib/quick-check";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const data = await fetchQuickCheckJSON();
  const filename = `quick_check_${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

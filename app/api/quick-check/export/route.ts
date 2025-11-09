import { NextResponse } from "next/server";
// ↓ Typen exportieren
export type QuickCheckDoc = { text: string; href: string };

// ↓ optionaler Alias, falls alter Code noch fetchQuickCheck importiert


export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const data = await fetchQuickCheck();
  const filename = `quick_check_${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
function fetchQuickCheck() {
  throw new Error("Function not implemented.");
}


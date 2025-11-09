import { NextResponse } from "next/server";
import { scrapeProject5 } from "@/app/lib/project5-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BASE = "https://project-5.at";

export async function GET(req: Request) {
  const cookie = process.env.PROJECT5_COOKIE || "";
  if (!cookie) {
    return NextResponse.json({ error: "PROJECT5_COOKIE fehlt" }, { status: 400 });
  }

  const url = new URL(req.url);
  const maxLeads = url.searchParams.get("max") ? Number(url.searchParams.get("max")) : undefined;

  const data = await scrapeProject5({
    listUrl: `${BASE}/leads.php`, // ggf. anpassen
    baseUrl: BASE,
    cookie,
    delayMs: 500,
    maxLeads,
  });

  const filename = `project5_pdf_links_${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

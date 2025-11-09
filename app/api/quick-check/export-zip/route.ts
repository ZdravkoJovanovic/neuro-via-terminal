// app/api/quick-check/export-zip/route.ts
import { NextResponse } from "next/server";
import { fetchQuickCheckJSON } from "@/app/lib/quick-check";
import JSZip from "jszip";

export const runtime = "nodejs"
export const dynamic = "force-dynamic";

export async function GET() {
  const cookie = process.env.PROJECT5_COOKIE || "";
  const qc = await fetchQuickCheckJSON();

  const zip = new JSZip();

  // JSON hinein
  const qcJson = new TextEncoder().encode(JSON.stringify(qc, null, 2));
  zip.file("quick_check.json", qcJson); // Uint8Array ok

  // PDFs laden → als Uint8Array einpacken
  const tryUrls = new Set<string>(qc.pdfUrls || []);
  qc.docsByRow?.forEach((row) => row.forEach((d) => tryUrls.add(d.href)));

  for (const url of tryUrls) {
    try {
      const res = await fetch(url, { headers: { Cookie: cookie } });
      const ct = (res.headers.get("content-type") || "").toLowerCase();
      if (!ct.includes("application/pdf")) continue;

      const ab = await res.arrayBuffer();              // ArrayBuffer
      zip.file(
        new URL(url).pathname.split("/").pop() || `document.pdf`,
        new Uint8Array(ab),                            // <-- statt Buffer
        { binary: true }
      );
    } catch {
      /* ignore */
    }
  }

  // ZIP als ArrayBuffer erzeugen
  const zipAb = await zip.generateAsync({ type: "arraybuffer" }); // <-- kein nodebuffer

  // Direkt ArrayBuffer (BodyInit) zurückgeben
  const filename = `quick_check_${new Date().toISOString().replace(/[:.]/g, "-")}.zip`;
  return new NextResponse(zipAb, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

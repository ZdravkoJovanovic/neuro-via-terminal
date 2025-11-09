// lib/quick-check.ts
import { load } from "cheerio";

const BASE = "https://project-5.at";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

const norm = (href?: string | null) => (href ? new URL(href, BASE).toString() : null);

export async function fetchQuickCheckJSON() {
  const cookie = process.env.PROJECT5_COOKIE;
  if (!cookie) throw new Error("PROJECT5_COOKIE fehlt (.env.local)");

  const res = await fetch(`${BASE}/quick_check.php`, {
    headers: { Cookie: cookie, "User-Agent": UA },
  });
  const html = await res.text();
  const $ = load(html);

  const title = $("h1,h2,.title").first().text().trim() || "Quick Check";

  const table = $("table").first();
  const headers =
    table.find("thead th").map((_, th) => $(th).text().trim()).get();

  const bodyRows = table.find("tbody tr").length
    ? table.find("tbody tr")
    : table.find("tr").slice(1);

  const rows: string[][] = [];
  const docsByRow: { text: string; href: string }[][] = [];
  const pdfSet = new Set<string>();

  bodyRows.each((_, tr) => {
    const $tr = $(tr);
    const tds = $tr.find("td");

    // Datenzeile
    const row = tds.map((__, td) => $(td).text().trim()).get();
    if (!row.length) return;
    rows.push(row);

    // Links (PDF/QuickCheck/Formular)
    const links: { text: string; href: string }[] = [];
    $tr.find('a[href]').each((__, a) => {
      const hrefAbs = norm($(a).attr("href"));
      if (!hrefAbs) return;

      const txt = $(a).text().trim();
      const isPdfHref = /\.pdf(\b|$)/i.test(hrefAbs);
      const isKeyword =
        /pdf|formular|quick ?check/i.test(txt) || /formular/i.test(hrefAbs);

      if (isPdfHref || isKeyword) {
        links.push({ text: txt || (hrefAbs.split("/").pop() || "Dokument"), href: hrefAbs });
        if (isPdfHref || /pdf/i.test(txt)) pdfSet.add(hrefAbs);
      }
    });
    docsByRow.push(links);
  });

  const pdfUrls = Array.from(pdfSet);
  return { title, headers, rows, count: rows.length, pdfUrls, docsByRow };
}

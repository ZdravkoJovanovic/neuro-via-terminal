// lib/leads.ts
import { load } from "cheerio";
import setCookie, { splitCookiesString } from "set-cookie-parser"

const BASE = "https://project-5.at";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

export async function fetchLeads() {
  // Falls fixer Cookie vorhanden → Login überspringen
  let cookieHeader = process.env.PROJECT5_COOKIE || "";

  if (!cookieHeader) {
    if (!process.env.PROJECT5_USER || !process.env.PROJECT5_PASS) {
      throw new Error("PROJECT5_USER/PROJECT5_PASS fehlen (.env.local).");
    }

    // 1) Login-Form holen
    const r1 = await fetch(`${BASE}/login.php?url=%2Fleads.php`, {
      headers: { "User-Agent": UA },
    });
    const html = await r1.text();
    const $ = load(html);
    const form = $("form").first();
    const action = new URL(form.attr("action") || "/login.php", BASE).toString();

    // 2) Felder füllen (inkl. versteckte Inputs / CSRF)
    const fields: Record<string, string> = {};
    form.find('input[name]').each((_, el) => {
      const name = $(el).attr("name")!;
      if (/user|email/i.test(name)) fields[name] = process.env.PROJECT5_USER!;
      else if (/pass/i.test(name)) fields[name] = process.env.PROJECT5_PASS!;
      else fields[name] = $(el).attr("value") || "";
    });

    // 3) Login absenden
    const r2 = await fetch(action, {
      method: "POST",
      headers: {
        "User-Agent": UA,
        "Content-Type": "application/x-www-form-urlencoded",
        Referer: `${BASE}/login.php?url=%2Fleads.php`,
      },
      body: new URLSearchParams(fields),
      redirect: "manual",
    });

    // 4) Cookies einsammeln
    const sc = splitCookiesString(r2.headers.get("set-cookie") || "");
    const cookies = setCookie.parse(sc);
    cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
    if (!cookieHeader) throw new Error("Login fehlgeschlagen (keine Cookies).");
  }

  // 5) Leads-Seite laden
  const r3 = await fetch(`${BASE}/leads.php`, {
    headers: { "User-Agent": UA, Cookie: cookieHeader },
  });
  const html2 = await r3.text();
  const $2 = load(html2);

  // 6) Tabelle → JSON
  const headers = $2("table thead th")
    .map((_, th) => $2(th).text().trim())
    .get();
  const rows: string[][] = [];
  $2("table tbody tr").each((_, tr) => {
    const row = $2(tr)
      .find("td")
      .map((_, td) => $2(td).text().trim())
      .get();
    if (row.length) rows.push(row);
  });

  return { headers, rows, count: rows.length };
}
// lib/project5-pdf.ts
import { load } from "cheerio";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

const LEAD_LINK_PATTERNS = [
  /lead_bearbeiten\.php/i,
  /leads?_bearbeiten\.php/i,
  /lead.*detail/i,
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function normalizeUrl(baseUrl: string, href?: string | null): string | null {
  if (!href) return null;
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return null;
  }
}

function extractLeadId(u: string): string | null {
  try {
    const url = new URL(u);
    const id = url.searchParams.get("id");
    if (id) return id;
    const last = url.pathname.split("/").pop() || "";
    return last || null;
  } catch {
    return null;
  }
}

async function fetchDom(url: string, cookie: string) {
  const res = await fetch(url, { headers: { Cookie: cookie, "User-Agent": UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status} für ${url}`);
  const html = await res.text();
  return load(html);
}

export async function extractContactsFromMain(listUrl: string, baseUrl: string, cookie: string) {
  const $ = await fetchDom(listUrl, cookie);
  const contacts: { leadUrl: string; leadId: string | null }[] = [];

  $("table tbody tr").each((_, tr) => {
    const $tr = $(tr);
    const aTags = $tr.find("a[href]");
    for (const el of aTags.toArray()) {
      const href = $(el).attr("href") || "";
      if (LEAD_LINK_PATTERNS.some((re) => re.test(href))) {
        const full = normalizeUrl(baseUrl, href);
        if (full) {
          contacts.push({ leadUrl: full, leadId: extractLeadId(full) });
          break; // pro Zeile erster Treffer reicht
        }
      }
    }
  });

  return contacts;
}

export async function extractPdfLinksFromLead(leadUrl: string, baseUrl: string, cookie: string) {
  const $ = await fetchDom(leadUrl, cookie);
  const set = new Set<string>();

  // Methode 1: href enthält .pdf
  $('a[href*=".pdf"]').each((_, a) => {
    const u = normalizeUrl(baseUrl, $(a).attr("href"));
    if (u) set.add(u);
  });

  // Methode 2: Linktext mit Keywords
  $("a[href]").each((_, a) => {
    const txt = $(a).text().toLowerCase();
    if (txt.includes("pdf") || txt.includes("formular") || txt.includes("quickcheck") || txt.includes("quick check")) {
      const u = normalizeUrl(baseUrl, $(a).attr("href"));
      if (u) set.add(u);
    }
  });

  // Methode 3: href enthält "formular"
  $('a[href*="formular"]').each((_, a) => {
    const u = normalizeUrl(baseUrl, $(a).attr("href"));
    if (u) set.add(u);
  });

  return Array.from(set);
}

export async function scrapeProject5({
  listUrl,
  baseUrl,
  cookie,
  delayMs = 500,
  maxLeads,
}: {
  listUrl: string;
  baseUrl: string;
  cookie: string;
  delayMs?: number;
  maxLeads?: number;
}) {
  const contacts = await extractContactsFromMain(listUrl, baseUrl, cookie);
  const out: {
    leadUrl: string;
    leadId: string | null;
    pdfLinks: string[] | null;
  }[] = [];

  const batch = maxLeads ? contacts.slice(0, maxLeads) : contacts;

  for (let i = 0; i < batch.length; i++) {
    const c = batch[i];
    try {
      const pdfs = await extractPdfLinksFromLead(c.leadUrl, baseUrl, cookie);
      out.push({ leadUrl: c.leadUrl, leadId: c.leadId, pdfLinks: pdfs.length ? pdfs : null });
    } catch (e) {
      out.push({ leadUrl: c.leadUrl, leadId: c.leadId, pdfLinks: null });
    }
    if (i < batch.length - 1) await sleep(delayMs);
  }

  return {
    total: contacts.length,
    processed: out.length,
    items: out,
  };
}

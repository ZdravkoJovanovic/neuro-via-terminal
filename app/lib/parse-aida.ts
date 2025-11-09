export type AidaCustomer = {
  index: number;
  headerName: string;
  customerNumber?: string;
  nameField?: string;
  phonePrivate?: string;
  phoneOffice?: string;
  phone?: string;        // generisch für "Telefon:"
  mobile1?: string;
  mobile2?: string;
  fax?: string;
  email?: string;
  street?: string;
};

const HEADER_BLOCK_RE = /---\s*(\d+)\.\s*(.*?)\s*---([\s\S]*?)(?=\n---\s*\d+\.|$)/g;

// Viele Schreibweisen abdecken (Groß/Klein, Punkte, Umlaute, Synonyme)
const KEY_PATTERNS: Array<{ re: RegExp; to: keyof AidaCustomer }> = [
  { re: /^(kunden(?:-?\s*nr\.?|nummer))$/i,                          to: "customerNumber" },
  { re: /^(name|name[-\s]?feld)$/i,                                  to: "nameField" },
  { re: /^(tel(?:efon)?\.?\s*(privat|pvt|prv))$/i,                   to: "phonePrivate" },
  { re: /^(tel(?:efon)?\.?\s*(büro|buero|office|firma|arbeit))$/i,   to: "phoneOffice" },
  { re: /^(telefon|tel\.)$/i,                                        to: "phone" },
  { re: /^((mobil|handy)\s*1?)$/i,                                   to: "mobile1" },
  { re: /^((mobil|handy)\s*2)$/i,                                    to: "mobile2" },
  { re: /^(fax)$/i,                                                  to: "fax" },
  { re: /^(e-?mail|email)$/i,                                        to: "email" },
  { re: /^(straße|strasse|str\.?)$/i,                                to: "street" },
];

function mapKey(rawKey: string): keyof AidaCustomer | undefined {
  const k = rawKey.replace(/\s+/g, " ").replace(/\.$/, "").trim();
  for (const { re, to } of KEY_PATTERNS) if (re.test(k)) return to;
  return undefined;
}

// "Key: Wert" – erlaubt ., -, /, () in Keys; Werte dürfen leer beginnen (Fortsetzungszeilen folgen)
const KV_RE = /^([A-Za-zÄÖÜäöüß.\-()\/\s]+):\s*(.*)$/;

export function parseAidaTxt(raw: string): AidaCustomer[] {
  let text = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\u00A0/g, " ");
  const out: AidaCustomer[] = [];

  let m: RegExpExecArray | null;
  while ((m = HEADER_BLOCK_RE.exec(text)) !== null) {
    const index = Number(m[1]);
    const headerName = (m[2] || "").trim();
    const body = m[3] || "";

    const rec: AidaCustomer = { index, headerName };
    let lastKey: keyof AidaCustomer | undefined;

    for (const rawLine of body.split("\n")) {
      const line = rawLine.trim();
      if (!line || line === "...") continue;

      const kv = line.match(KV_RE);
      if (kv) {
        const mapped = mapKey(kv[1]);
        const val = (kv[2] || "").trim();
        if (mapped) {
          // Neuer Schlüssel – vorhandenes anhängen (mehrere Nummern)
          if ((rec as any)[mapped]) {
            (rec as any)[mapped] = `${(rec as any)[mapped]} ${val}`.trim();
          } else {
            (rec as any)[mapped] = val || undefined;
          }
          lastKey = mapped;
        } else {
          lastKey = undefined;
        }
        continue;
      }

      // Fortsetzungszeile (z. B. Nummer bricht in nächste Zeile um)
      if (lastKey) {
        const prev = (rec as any)[lastKey] ?? "";
        (rec as any)[lastKey] = `${prev} ${line}`.trim();
      }
    }

    // leichte Säuberung: doppelte Spaces, Schrägstriche etc.
    for (const k of Object.keys(rec) as (keyof AidaCustomer)[]) {
      if (typeof (rec as any)[k] === "string") {
        (rec as any)[k] = (rec as any)[k]
          .replace(/\s{2,}/g, " ")
          .replace(/\s*\/\s*/g, " / ")
          .trim();
      }
    }

    out.push(rec);
  }

  out.sort((a, b) => a.index - b.index);
  return out;
}

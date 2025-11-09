"use client";

import * as React from "react";
import { useCallback, useMemo, useRef, useState } from "react";

type Customer = {
  index: number;
  headerName: string;
  customerNumber?: string;
  nameField?: string;
  phonePrivate?: string;
  phoneOffice?: string;
  phone?: string;   // generisch "Telefon:"
  mobile1?: string;
  mobile2?: string;
  fax?: string;
  email?: string;
  street?: string;
  // evtl. weitere Keys vom Parser sind erlaubt
  [key: string]: unknown;
};

const LABEL: Record<string, string> = {
  customerNumber: "Kundennummer",
  nameField: "Name-Feld",
  phonePrivate: "Tel. privat",
  phoneOffice: "Tel. Büro",
  phone: "Telefon",
  mobile1: "Mobil 1",
  mobile2: "Mobil 2",
  fax: "Fax",
  email: "E-Mail",
  street: "Straße",
};

const ORDER: string[] = [
  "customerNumber",
  "nameField",
  "phonePrivate",
  "phoneOffice",
  "phone",
  "mobile1",
  "mobile2",
  "fax",
  "email",
  "street",
];

const PHONE_KEYS = new Set(["phonePrivate", "phoneOffice", "phone", "mobile1", "mobile2", "fax"]);
const HIDE_KEYS = new Set(["index", "headerName"]);

/* ---------- Monochrome Token-Farben ---------- */
const PALETTE = ["#e7e7e7","#d6d6d6","#c4c4c4","#b3b3b3","#a1a1a1","#8f8f8f","#7d7d7d","#6b6b6b","#595959","#474747","#363636"];
function hashStr(s: string): number { let h = 2166136261>>>0; for (let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619);} return h>>>0; }
function tone(token: string){ return PALETTE[hashStr(token)%PALETTE.length]; }

/* Nummern im Freitext zu einzelnen Tokens extrahieren (robust, +/()/.-/space erlaubt) */
function extractNumberTokens(text: string): string[] {
  const re = /\+?\d[\d\s().\/-]*\d/g;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const t = m[0].replace(/\s{2,}/g, " ").trim();
    if (t.length >= 5) out.push(t);
  }
  // de-dupe, Reihenfolge beibehalten
  return Array.from(new Set(out));
}

/* E-Mails extrahieren (falls mehrere im Feld) */
function extractEmails(text: string): string[] {
  const re = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
  const out = text.match(re) || [];
  return Array.from(new Set(out.map((s) => s.trim())));
}

/* Nummern im Text farblich hervorheben (für Einzeiler wie Kundennummer) */
function renderNumberedInline(text: string): Array<string | React.ReactNode> {
  const re = /(\d[\d\s/().-]*\d)/g;
  const parts: Array<string | React.ReactNode> = [];
  let last = 0, m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const [match] = m; const start = m.index;
    if (start > last) parts.push(text.slice(last, start));
    parts.push(<span key={start} style={{ color: tone(match) }}>{match}</span>);
    last = start + match.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export default function UploadClient() {
  const [rows, setRows] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setError(null); setLoading(true);
    try {
      const fd = new FormData(); fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setRows((data.records || []) as Customer[]);
    } catch (e: any) { setError(e?.message || "Upload fehlgeschlagen"); }
    finally { setLoading(false); }
  };

  const onDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) await handleFile(f);
  }, []);
  const onSelectFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) await handleFile(f);
  };

  const filtered = useMemo(() => {
    if (!q) return rows;
    const s = q.toLowerCase();
    return rows.filter((r) =>
      Object.entries(r)
        .filter(([k,v]) => !HIDE_KEYS.has(k) && v != null)
        .some(([,v]) => String(v).toLowerCase().includes(s))
    );
  }, [rows, q]);

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a");
    a.href = url; a.download = "kunden.json"; a.click(); URL.revokeObjectURL(url);
  };
  const exportCSV = () => {
    // dynamisch alle Keys sammeln (außer index/headerName)
    const allKeys = Array.from(new Set(filtered.flatMap(r => Object.keys(r).filter(k => !HIDE_KEYS.has(k))))).sort();
    const header = ["#", "Header-Name", ...allKeys.map(k => LABEL[k] ?? k)];
    const lines = [header.join(",")];
    for (const r of rows) {
      const vals = ["index","headerName",...allKeys].map((k) => `"${String((r as any)[k] ?? "").replaceAll('"','""')}"`);
      lines.push(vals.join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a");
    a.href = url; a.download = "kunden.csv"; a.click(); URL.revokeObjectURL(url);
  };

  const isEmpty = (v: unknown) => !v || String(v).trim() === "";

  /* Rendert EIN Feld (Label links, Werte rechts). Nummern-/E-Mail-Felder als Chips nebeneinander. */
  function FieldRow({ k, v }: { k: string; v: string }) {
    const label = LABEL[k] ?? k;
    const isPhone = PHONE_KEYS.has(k);
    const isEmail = k === "email";
    const chips = isPhone ? extractNumberTokens(v) : isEmail ? extractEmails(v) : null;

    return (
      <div className="flex gap-2">
        <div className="w-36 text-neutral-400 text-xs">{label}</div>
        <div className="flex-1 text-neutral-100 text-sm leading-snug break-words">
          {chips ? (
            <div className="flex flex-wrap gap-1">
              {chips.map((t, i) => (
                <span
                  key={i}
                  className="chip border px-2 py-0.5 text-xs"
                  style={{ borderColor: tone(t), color: tone(t) }}
                  title={t}
                >
                  {t}
                </span>
              ))}
            </div>
          ) : (
            <span>{k === "customerNumber" ? renderNumberedInline(v) : v}</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <section className="grid gap-4">
      {/* Upload-Zeile */}
      <div onDrop={onDrop} onDragOver={(e) => e.preventDefault()}
           className="border border-neutral-800 bg-neutral-950 text-neutral-200 p-6 text-center">
        <div className="mb-1 tracking-wide">Datei hierher ziehen</div>
        <div className="text-neutral-500 text-xs mb-4">oder auswählen</div>
        <div className="flex items-center justify-center gap-2">
          <button className="btn border border-neutral-600 bg-black px-4 py-2 text-neutral-100"
                  onClick={() => inputRef.current?.click()}>
            DATEI WÄHLEN
          </button>
          <button className="btn border border-neutral-600 bg-white/0 px-4 py-2 text-neutral-200" onClick={exportCSV}>
            CSV
          </button>
          <button className="btn border border-neutral-600 bg-white/0 px-4 py-2 text-neutral-200" onClick={exportJSON}>
            JSON
          </button>
        </div>
        <input ref={inputRef} type="file" accept=".txt" onChange={onSelectFile} className="hidden" />
      </div>

      {/* Suche / Count */}
      <div className="flex items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Suche: Name, Nummer, E-Mail, Straße…"
          className="input border border-neutral-700 bg-neutral-900 text-neutral-100 px-3 py-2 w-full placeholder:text-neutral-500"
        />
        <div className="text-xs text-neutral-500 tabular-nums">{filtered.length} / {rows.length}</div>
      </div>

      {loading && <div className="h-1 w-full bg-neutral-900"><div className="h-1 w-1/3 bg-neutral-200 animate-pulse" /></div>}
      {error && <div className="text-red-400 text-sm">{error}</div>}

      {/* Karten-Liste */}
      <div className="grid gap-3">
        {filtered.map((r) => {
          // 1) bekannte Keys in definierter Reihenfolge
          const known = ORDER
            .filter((k) => !isEmpty((r as any)[k]))
            .map((k) => [k, String((r as any)[k])] as const);
          // 2) zusätzliche (unbekannte) Keys, die nicht leer sind
          const extras = Object.entries(r)
            .filter(([k, v]) => !HIDE_KEYS.has(k) && !ORDER.includes(k) && !isEmpty(v))
            .map(([k, v]) => [k, String(v)] as const);

          const all = [...known, ...extras];

          return (
            <div key={`${r.index}-${r.headerName}`} className="border border-neutral-800 bg-neutral-950 px-4 py-3">
              {/* Kopf */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="text-xs" style={{ color: tone(String(r.index)) }}>#{r.index}</div>
                  <div className="text-neutral-100 text-base font-medium leading-tight">{r.headerName || "—"}</div>
                </div>
                <div className="shrink-0 flex items-center gap-2">{/* Platz für Buttons */}</div>
              </div>

              {/* Felder (alle untereinander; Nummern/E-Mails als Chips nebeneinander) */}
              {all.length > 0 && (
                <div className="mt-3 grid gap-1.5">
                  {all.map(([k, v]) => (
                    <FieldRow key={k} k={k} v={v} />
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {!filtered.length && (
          <div className="border border-neutral-800 bg-neutral-950 px-4 py-6 text-center text-neutral-500">
            Keine Treffer.
          </div>
        )}
      </div>
    </section>
  );
}

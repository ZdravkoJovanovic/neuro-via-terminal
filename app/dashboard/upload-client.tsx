"use client";

import * as React from "react";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Virtuoso } from "react-virtuoso";

/* ===== Datentyp ===== */
type Customer = {
  index: number;
  headerName: string;          // echter Name aus Header
  customerNumber?: string;
  nameField?: string;
  phonePrivate?: string;
  phoneOffice?: string;
  phone?: string;
  mobile1?: string;
  mobile2?: string;
  fax?: string;
  email?: string;
  street?: string;
  [key: string]: unknown;
};

type Kind = "company" | "private" | "unknown";
type Lead = Customer & { id: string; kind: Kind; search: string };

/* ===== Labels / Ordnung ===== */
const LABEL: Record<string, string> = {
  customerNumber: "Kundennummer",
  nameField: "Name",
  phonePrivate: "Tel. privat",
  phoneOffice: "Tel. Büro",
  phone: "Telefon",
  mobile1: "Mobil 1",
  mobile2: "Mobil 2",
  fax: "Fax",
  email: "E-Mail",
  street: "Straße",
};
const ORDER: string[] = ["customerNumber","phonePrivate","phoneOffice","phone","mobile1","mobile2","fax","email","street"];
const PHONE_KEYS = new Set(["phonePrivate","phoneOffice","phone","mobile1","mobile2","fax"]);
const HIDE_KEYS = new Set(["index","headerName"]);

/* ===== Nummern-Farben (ohne Blau) ===== */
const PALETTE = ["#e7e7e7","#d6d6d6","#c4c4c4","#b3b3b3","#a1a1a1","#8f8f8f","#7d7d7d","#6b6b6b","#595959","#474747","#363636"];
const hashStr = (s: string) => { let h = 2166136261>>>0; for (let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619);} return h>>>0; };
const tone = (t: string) => PALETTE[hashStr(t)%PALETTE.length];

/* ===== Helpers (nur für sichtbare Items dank Virtualisierung) ===== */
function extractNumberTokens(text: string): string[] {
  const re = /\+?\d[\d\s().\/-]*\d/g; const out: string[] = []; let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) { const t = m[0].replace(/\s{2,}/g," ").trim(); if (t.length>=5) out.push(t); }
  return Array.from(new Set(out));
}
function extractEmails(text: string): string[] {
  const re = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi; return Array.from(new Set((text.match(re)||[]).map(s=>s.trim())));
}
function renderNumberedInline(text: string): Array<string | React.ReactNode> {
  const re = /(\d[\d\s/().-]*\d)/g; const parts: Array<string|React.ReactNode>=[]; let last=0, m:RegExpExecArray|null;
  while ((m = re.exec(text))){ const [match]=m; const start=m.index; if (start>last) parts.push(text.slice(last,start));
    parts.push(<span key={start} style={{color: tone(match)}}>{match}</span>); last=start+match.length; }
  if (last<text.length) parts.push(text.slice(last)); return parts;
}
const isEmpty = (v: unknown) => !v || String(v).trim()==="";

/* ===== Klassifikation einmalig berechnen ===== */
const COMPANY_LEGAL_RE = new RegExp(String.raw`\b(`+[
  "gmbh","ag","kg","og","mbh","eg","verein","stiftung","e\\.?u\\.?",
  "gbr","ohg","kgaa","se","ltd","llc","inc","plc","llp","corp\\.?","co\\.?",
  "s\\.?a\\.?","s\\.?p\\.?a\\.?","sarl","bv","nv","ab","oy","as","kft","a\\.s\\.","s\\.r\\.o\\.","oü","oyj"
].join("|")+String.raw`)\b`,"i");
const COMPANY_KEYWORDS = ["holding","gruppe","group","solutions","consulting","services","service","gastro","bau","logistik","trans","immobilien","auto","apotheke","praxis","hotel","restaurant","versicherung","bank","sparkasse","finanz","it","media","kassensysteme","management","partners","center","zentrum","shop","gbr","ohg"];
const FREE_EMAIL_DOMAINS = new Set(["gmail.com","googlemail.com","yahoo.com","outlook.com","hotmail.com","live.com","icloud.com","me.com","gmx.at","gmx.net","gmx.de","web.de","aon.at","chello.at","proton.me","protonmail.com","mail.ru","yandex.ru","yandex.com","zoho.com"]);
const firstEmailDomain = (e?: string) => e?.toLowerCase().match(/@([^>\s;]+)/)?.[1]?.replace(/[>\)]$/,"");
const isCompanyName = (name: string) => !!name && (COMPANY_LEGAL_RE.test(name) || COMPANY_KEYWORDS.some(k=>name.toLowerCase().includes(k)) || /\d/.test(name) || /[\/&]/.test(name));
const isLikelyPerson = (name: string) => !!name && !isCompanyName(name) && !(/\d|\/|&/.test(name)) && name.trim().split(/\s+/).length<=4 && name.split(/\s+/).every(p=>/^[A-Za-zÀ-ÖØ-öø-ÿ'´`-]+$/.test(p));
const classifyRow = (r: Customer): Kind => {
  const name = r.headerName||""; if (isCompanyName(name)) return "company"; if (isLikelyPerson(name)) return "private";
  const dom = firstEmailDomain(r.email); if (dom){ if (FREE_EMAIL_DOMAINS.has(dom)) return "private"; if (dom.includes(".")) return "company"; }
  return "unknown";
};
/* Name-Feld nur zeigen, wenn ≠ Header & kein Müll */
const effectiveNameField = (row: Customer) => {
  const nf = String(row.nameField||"").trim(); if (!nf) return undefined;
  if (/fsales|kundensuche/i.test(nf)) return undefined; if (nf===row.headerName) return undefined; return nf;
};

/* ===== Aktionen (persistiert) ===== */
type ActionKey = "abgehoben" | "mailbox" | "ungueltig" | "termin" | "callback";
type LeadActions = Record<ActionKey, boolean>;
type ActionsState = Record<string, LeadActions>;
const ACTIONS: { key: ActionKey; label: string }[] = [
  { key: "abgehoben", label: "Abgehoben" },
  { key: "mailbox",   label: "Mailbox" },
  { key: "ungueltig", label: "Ungültige Nummer" },
  { key: "termin",    label: "Termin" },
  { key: "callback",  label: "Nochmal anrufen" },
];
const ACTIVE_COLORS: Record<ActionKey, { bg: string; border: string; fg: string }> = {
  abgehoben: { bg: "#16a34a", border: "#16a34a", fg: "#ffffff" },
  mailbox:   { bg: "#f59e0b", border: "#f59e0b", fg: "#111111" },
  ungueltig: { bg: "#dc2626", border: "#dc2626", fg: "#ffffff" },
  termin:    { bg: "#7c3aed", border: "#7c3aed", fg: "#ffffff" },
  callback:  { bg: "#84cc16", border: "#84cc16", fg: "#111111" },
};
const btnBase = "border text-xs px-2 py-1 select-none";
const btnCls = (active: boolean, key: ActionKey) => active
  ? { className: btnBase, style: { backgroundColor: ACTIVE_COLORS[key].bg, borderColor: ACTIVE_COLORS[key].border, color: ACTIVE_COLORS[key].fg } }
  : { className: btnBase, style: { backgroundColor: "#ffffff", borderColor: "#cfcfcf", color: "#111111" } };

/* ===== UI ===== */
type Mode = "all" | "private" | "company";

export default function UploadClient() {
  const [rows, setRows] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const dq = useDeferredValue(q);             // Debounce im Renderpfad
  const [mode, setMode] = useState<Mode>("all");
  const [actions, setActions] = useState<ActionsState>({});
  const fileRef = useRef<HTMLInputElement>(null);

  // Actions persistieren
  useEffect(()=>{ try{ const raw=localStorage.getItem("leadActions"); if(raw) setActions(JSON.parse(raw)); }catch{} },[]);
  useEffect(()=>{ try{ localStorage.setItem("leadActions", JSON.stringify(actions)); }catch{} },[actions]);

  const handleToggle = (id: string, key: ActionKey) => {
    setActions(prev => {
      const current = prev[id] || { abgehoben:false, mailbox:false, ungueltig:false, termin:false, callback:false };
      return { ...prev, [id]: { ...current, [key]: !current[key] } };
    });
  };

  const handleFile = async (file: File) => {
    setError(null); setLoading(true);
    try {
      const fd = new FormData(); fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const src = (data.records || []) as Customer[];

      // Vorberechnung: id, kind, search (einmalig)
      const norm: Lead[] = src.map((r) => {
        const id = `${r.index}-${r.headerName}`;
        const kind = classifyRow(r);
        const search = [
          r.headerName, r.customerNumber, r.nameField, r.phonePrivate, r.phoneOffice, r.phone,
          r.mobile1, r.mobile2, r.fax, r.email, r.street
        ].filter(Boolean).join(" ").toLowerCase();
        return { ...r, id, kind, search };
      });
      setRows(norm);
    } catch (e: any) {
      setError(e?.message || "Upload fehlgeschlagen");
    } finally {
      setLoading(false);
    }
  };

  const onDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) await handleFile(f);
  }, []);
  const onSelectFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (f) await handleFile(f);
  };

  // Filter (schnell: nutzt vorab berechnetes .search)
  const filtered = useMemo(() => {
    const s = dq.trim().toLowerCase();
    let arr = s ? rows.filter(r => r.search.includes(s)) : rows;
    if (mode !== "all") arr = arr.filter(r => (mode === "company" ? r.kind==="company" : r.kind==="private"));
    return arr;
  }, [rows, dq, mode]);

  const counts = useMemo(() => {
    let c=0,p=0; for (const r of rows){ if (r.kind==="company") c++; else if (r.kind==="private") p++; }
    return { company:c, private:p, all: rows.length };
  }, [rows]);

  const modeBtn = (active: boolean) =>
    `px-3 py-1 text-xs border ${active ? "bg-neutral-200 text-neutral-900 border-neutral-200" : "bg-transparent text-neutral-200 border-neutral-700"}`;

  /* Einzelkarte (memoisiert) */
  const Card = React.useMemo(() => {
    type Props = { row: Lead; act: LeadActions; onToggle: (k: ActionKey)=>void };
    const Comp = React.memo(({ row, act, onToggle }: Props) => {
      const indexColor = tone(String(row.index));
      // Liste der Felder bauen
      const known = ORDER.filter(k => !isEmpty((row as any)[k])).map(k => [k, String((row as any)[k])] as const);
      const extras = Object.entries(row)
        .filter(([k,v]) => !HIDE_KEYS.has(k) && !ORDER.includes(k) && k!=="id" && k!=="kind" && k!=="search" && k!=="nameField" && !isEmpty(v))
        .map(([k,v]) => [k, String(v)] as const);
      const list: Array<readonly [string,string]> = [];
      const nf = effectiveNameField(row); if (nf) list.push(["nameField", nf]);
      list.push(...known, ...extras);

      return (
        <div className="border border-neutral-800 bg-neutral-950 px-4 py-3">
          {/* Kopf */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="text-xs" style={{ color: indexColor }}>#{row.index}</div>
              <div className="text-neutral-100 text-base font-medium leading-tight">{row.headerName || "—"}</div>
            </div>
            {/* Aktionen rechts */}
            <div className="shrink-0 flex flex-wrap items-center justify-end gap-2">
              {ACTIONS.map(({ key, label }) => {
                const cfg = btnCls(!!act[key], key);
                return (
                  <button key={key} className={cfg.className} style={cfg.style} onClick={() => onToggle(key)} title={label}>
                    {label}
                  </button>
                );
              })}
              <span
                className="chip border px-2 py-0.5 text-[11px] uppercase tracking-wide"
                style={{ borderColor: row.kind==="company" ? "#d6d6d6" : "#8f8f8f", color: row.kind==="company" ? "#d6d6d6" : "#8f8f8f" }}
              >
                {row.kind==="company" ? "COMPANY" : row.kind==="private" ? "PRIVAT" : "UNBEKANNT"}
              </span>
            </div>
          </div>

          {/* Felder */}
          {list.length>0 && (
            <div className="mt-3 grid gap-1.5">
              {list.map(([k,v]) => {
                const label = LABEL[k] ?? k;
                const isPhone = PHONE_KEYS.has(k);
                const isEmail = k==="email";
                const chips = isPhone ? extractNumberTokens(v) : isEmail ? extractEmails(v) : null;
                return (
                  <div key={k} className="flex gap-2">
                    <div className="w-36 text-neutral-400 text-xs">{label}</div>
                    <div className="flex-1 text-neutral-100 text-sm leading-snug break-words">
                      {chips ? (
                        <div className="flex flex-wrap gap-1">
                          {chips.map((t,i)=>(
                            <span key={i} className="chip border px-2 py-0.5 text-xs" style={{ borderColor: tone(t), color: tone(t) }}>{t}</span>
                          ))}
                        </div>
                      ) : (
                        <span>{k==="customerNumber" ? renderNumberedInline(v) : v}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      );
    }, (prev, next) => {
      // Re-render nur wenn sich die Aktionen des Leads oder row.id geändert haben
      const a=prev.act, b=next.act;
      return prev.row.id===next.row.id && a.abgehoben===b.abgehoben && a.mailbox===b.mailbox && a.ungueltig===b.ungueltig && a.termin===b.termin && a.callback===b.callback;
    });
    return Comp;
  }, []);

  return (
    <section className="grid gap-4">
      {/* Upload */}
      <div onDrop={onDrop} onDragOver={(e)=>e.preventDefault()} className="border border-neutral-800 bg-neutral-950 text-neutral-200 p-6 text-center">
        <div className="mb-1 tracking-wide">Datei hierher ziehen</div>
        <div className="text-neutral-500 text-xs mb-4">oder auswählen</div>
        <div className="flex items-center justify-center gap-2">
          <button className="btn border border-neutral-600 bg-black px-4 py-2 text-neutral-100" onClick={()=>fileRef.current?.click()}>DATEI WÄHLEN</button>
          <button className="btn border border-neutral-600 bg-white/0 px-4 py-2 text-neutral-200" onClick={()=>{
            // Export CSV/JSON aus Platzgründen ausgelassen – gleiche Implementierung wie vorher möglich
            alert("Export ist im großen Datensatz optional – sag mir, was du brauchst (CSV/JSON).");
          }}>EXPORT</button>
        </div>
        <input ref={fileRef} type="file" accept=".txt" onChange={onSelectFile} className="hidden" />
      </div>

      {/* Suche + Filter */}
      <div className="flex flex-wrap items-center gap-2">
        <input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Suche: Name, Nummer, E-Mail, Straße…"
               className="input border border-neutral-700 bg-neutral-900 text-neutral-100 px-3 py-2 flex-1 min-w-[240px] placeholder:text-neutral-500" />
        <div className="flex">
          <button className={modeBtn(mode==="all")} onClick={()=>setMode("all")}>ALLE ({counts.all})</button>
          <button className={modeBtn(mode==="private")} onClick={()=>setMode("private")}>PRIVAT ({counts.private})</button>
          <button className={modeBtn(mode==="company")} onClick={()=>setMode("company")}>COMPANY ({counts.company})</button>
        </div>
      </div>

      {loading && <div className="h-1 w-full bg-neutral-900"><div className="h-1 w-1/3 bg-neutral-200 animate-pulse" /></div>}
      {error && <div className="text-red-400 text-sm">{error}</div>}

      {/* Virtuelle Liste (flüssig bei 10k+) */}
      <div className="border border-neutral-800">
        <Virtuoso
          data={filtered}
          style={{ height: "70vh" }}
          increaseViewportBy={{ top: 600, bottom: 800 }}
          itemContent={(i, row) => {
            const id = row.id;
            const act = actions[id] || { abgehoben:false, mailbox:false, ungueltig:false, termin:false, callback:false };
            const onToggle = (k: ActionKey) => handleToggle(id, k);
            return <Card row={row} act={act} onToggle={onToggle} />;
          }}
        />
      </div>
    </section>
  );
}

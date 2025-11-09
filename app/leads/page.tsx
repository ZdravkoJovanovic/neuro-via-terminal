// app/leads/page.tsx
export default function LeadsPage() {
  return (
    <div className="min-h-dvh grid place-items-center">
      <div className="flex gap-3">
        <a href="/api/leads/export" className="px-4 py-2 border border-neutral-800 bg-white !bg-white text-black !text-black appearance-none">
          Leads JSON
        </a>
        <a href="/api/quick-check/export-json" className="px-4 py-2 border border-neutral-800 bg-white !bg-white text-black !text-black appearance-none">
          Quick-Check JSON (inkl. PDF-Links)
        </a>
      </div>
    </div>
  );
}

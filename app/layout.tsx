import "./globals.css";

export const metadata = {
  title: "TXT ➜ CRM Parser",
  description: "Monochrome Upload Console",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body className="min-h-dvh">
        <header className="border-b border-neutral-800 bg-black text-neutral-100">
          <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="font-semibold tracking-wider">CRM·CONSOLE</div>
              <div className="chip px-2 py-0.5 text-[11px] border border-neutral-700 text-neutral-300">TXT IMPORT</div>
            </div>
            <div className="text-[12px] text-neutral-400">Monochrom · Kantig · No Blue</div>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}

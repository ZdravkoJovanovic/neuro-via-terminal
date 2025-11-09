"use client";

import UploadClient from "./dashboard/upload-client";

export default function Page() {
  return (
    <div className="grid gap-4">
      <div className="grid gap-1">
        <h1 className="text-[22px] font-semibold tracking-wide">TXT → CRM Parser</h1>
        <p className="text-neutral-400 text-sm">
          Drag & Drop <code className="text-neutral-200">.txt</code> – wir parsen kundenrelevante Felder.
        </p>
      </div>
      <UploadClient />
    </div>
  );
}

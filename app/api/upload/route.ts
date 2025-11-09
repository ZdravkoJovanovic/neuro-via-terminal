import { NextResponse } from "next/server";
import { parseAidaTxt } from "@/app/lib/parse-aida";
// Falls Alias nicht greift:  import { parseAidaTxt } from "../../../lib/parse-aida";

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "file missing" }, { status: 400 });
    }
    const text = await (file as File).text();
    const records = parseAidaTxt(text);
    return NextResponse.json({ count: records.length, records });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "parse error" }, { status: 500 });
  }
}

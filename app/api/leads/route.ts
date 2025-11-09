// app/api/leads/route.ts
import { NextResponse } from "next/server";
import { fetchLeads } from "@/app/lib/leads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await fetchLeads();
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

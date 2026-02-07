import { NextResponse } from "next/server";
import { getResearchFiles } from "@/lib/research";

export const dynamic = "force-dynamic";

export async function GET() {
  const files = getResearchFiles();
  return NextResponse.json(files);
}

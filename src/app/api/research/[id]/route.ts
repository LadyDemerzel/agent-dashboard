import { NextResponse } from "next/server";
import { getResearchFiles, getResearchContent } from "@/lib/research";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const files = getResearchFiles();
  const file = files.find((f) => f.id === id);

  if (!file) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const content = getResearchContent(id);

  return NextResponse.json({ ...file, content });
}

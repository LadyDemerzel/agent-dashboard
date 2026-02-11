import { NextRequest, NextResponse } from "next/server";
import { getResearchFiles } from "@/lib/research";
import { generateDiff } from "@/lib/versions";
import path from "path";

const RESEARCH_DIR = path.join(
  process.env.HOME || "/Users/ittaisvidler",
  "tenxsolo",
  "business",
  "market-research",
  "deliverables"
);

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const fromVersion = parseInt(searchParams.get("from") || "", 10);
  const toVersion = parseInt(searchParams.get("to") || "", 10);

  const files = getResearchFiles();
  const file = files.find((f) => f.id === id);

  if (!file) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (isNaN(fromVersion) || isNaN(toVersion)) {
    return NextResponse.json(
      { error: "Invalid version parameters. Use ?from=X&to=Y" },
      { status: 400 }
    );
  }

  const filePath = path.join(RESEARCH_DIR, file.filename);
  const diff = generateDiff(filePath, fromVersion, toVersion);

  if (!diff) {
    return NextResponse.json(
      { error: "Could not generate diff. Versions may not exist." },
      { status: 404 }
    );
  }

  return NextResponse.json(diff);
}

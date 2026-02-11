import { NextRequest, NextResponse } from "next/server";
import { getXPost } from "@/lib/xposts";
import { generateDiff } from "@/lib/versions";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const fromVersion = parseInt(searchParams.get("from") || "", 10);
  const toVersion = parseInt(searchParams.get("to") || "", 10);

  const post = getXPost(id);

  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  if (isNaN(fromVersion) || isNaN(toVersion)) {
    return NextResponse.json(
      { error: "Invalid version parameters. Use ?from=X&to=Y" },
      { status: 400 }
    );
  }

  const diff = generateDiff(post.filePath, fromVersion, toVersion);

  if (!diff) {
    return NextResponse.json(
      { error: "Could not generate diff. Versions may not exist." },
      { status: 404 }
    );
  }

  return NextResponse.json(diff);
}

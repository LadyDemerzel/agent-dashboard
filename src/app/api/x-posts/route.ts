import { NextResponse } from "next/server";
import { getXPosts } from "@/lib/xposts";

export const dynamic = "force-dynamic";

export async function GET() {
  const posts = getXPosts();
  return NextResponse.json(posts);
}

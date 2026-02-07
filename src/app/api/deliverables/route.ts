import { NextRequest, NextResponse } from "next/server";
import { getDeliverables } from "@/lib/files";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const agent = searchParams.get("agent") || undefined;

  const deliverables = getDeliverables(agent);
  return NextResponse.json(deliverables);
}
